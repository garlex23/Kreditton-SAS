require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { calcularPreEvaluacion, PARAMETROS } = require('./scoring');
const { generarDiagnostico } = require('./aiDiagnosis');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ── Validaciones ──────────────────────────────────────────────────────────────

// Campos mínimos del formulario externo (Tally / cliente)
const CAMPOS_EXTERNOS = [
  'tipo_cliente', 'tipo_documento', 'numero_documento', 'nombre_completo',
  'telefono', 'email', 'perfil_financiero', 'ingresos',
];

function validarExterno(body) {
  const errores = [];
  for (const c of CAMPOS_EXTERNOS) {
    if (body[c] === undefined || body[c] === null || body[c] === '')
      errores.push(`Campo requerido: ${c}`);
  }
  if (body.tipo_cliente === 'B2B' && !body.nombre_aliado)
    errores.push('nombre_aliado es requerido para clientes B2B');
  if (Number(body.ingresos) <= 0)
    errores.push('ingresos debe ser mayor a 0');
  return errores;
}

// Campos requeridos para ejecutar una evaluación
const CAMPOS_EVALUACION = [
  'ingresos', 'score_credito',
  'valor_inmueble', 'monto_solicitado', 'tipo_inmueble', 'subtipo_inmueble',
  'plazo_meses', 'documentacion',
];

function validarEvaluacion(body) {
  const errores = [];
  for (const c of CAMPOS_EVALUACION) {
    if (body[c] === undefined || body[c] === null || body[c] === '')
      errores.push(`Campo requerido: ${c}`);
  }
  if (Number(body.ingresos) <= 0)        errores.push('ingresos debe ser mayor a 0');
  if (Number(body.valor_inmueble) <= 0)   errores.push('valor_inmueble debe ser mayor a 0');
  if (Number(body.monto_solicitado) <= 0) errores.push('monto_solicitado debe ser mayor a 0');
  if (Number(body.monto_solicitado) >= Number(body.valor_inmueble))
    errores.push('monto_solicitado no puede ser mayor o igual al valor del inmueble');
  if (Number(body.plazo_meses) < 60 || Number(body.plazo_meses) > 240)
    errores.push('plazo_meses debe estar entre 60 y 240');
  if (Number(body.score_credito) < 300 || Number(body.score_credito) > 900)
    errores.push('score_credito debe estar entre 300 y 900');
  return errores;
}

const ESTADOS_VALIDOS = ['pendiente_validacion', 'en_revision', 'asignado', 'cerrado'];

// ── Rutas ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', (_req, res) => res.json(db.stats()));
app.get('/api/parametros', (_req, res) => res.json(PARAMETROS));

// Búsqueda por documento (detección de duplicados)
app.get('/api/prospectos/buscar', (req, res) => {
  const { numero_documento } = req.query;
  if (!numero_documento) return res.status(400).json({ error: 'Falta numero_documento' });
  res.json(db.buscarPorDocumento(String(numero_documento).trim()) || null);
});

// Listar con filtros
app.get('/api/prospectos', (req, res) => {
  const { viabilidad, tipo_cliente, estado, buscar, sin_evaluar } = req.query;
  res.json(db.listar({ viabilidad, tipo_cliente, estado, buscar, sin_evaluar }));
});

// Crear prospecto — formulario externo (Tally / cliente / aliado)
// Acepta datos del cliente. Kreditton completa los internos desde el expediente.
app.post('/api/prospectos', (req, res) => {
  const errores = validarExterno(req.body);
  if (errores.length > 0)
    return res.status(400).json({ error: 'Datos inválidos', detalles: errores });

  const numDoc = String(req.body.numero_documento).trim();
  const existente = db.buscarPorDocumento(numDoc);
  if (existente) {
    return res.status(409).json({
      error: 'duplicate',
      mensaje: `Ya existe un expediente para el documento ${numDoc}.`,
      prospecto_existente: existente,
    });
  }

  const id = db.insertar({
    tipo_cliente:             req.body.tipo_cliente,
    nombre_aliado:            req.body.nombre_aliado || null,
    tipo_documento:           req.body.tipo_documento,
    numero_documento:         numDoc,
    nombre_completo:          req.body.nombre_completo,
    telefono:                 req.body.telefono,
    email:                    req.body.email,
    perfil_financiero:        req.body.perfil_financiero,
    empresa_actual:           req.body.empresa_actual || null,
    ingresos:                 Number(req.body.ingresos),
    otros_ingresos:           Number(req.body.otros_ingresos || 0),
    obligaciones_mensuales:   Number(req.body.obligaciones_mensuales || 0),
    valor_inmueble:           req.body.valor_inmueble ? Number(req.body.valor_inmueble) : null,
    monto_solicitado:         req.body.monto_solicitado ? Number(req.body.monto_solicitado) : null,
    cuota_inicial_disponible: req.body.cuota_inicial_disponible ? Number(req.body.cuota_inicial_disponible) : null,
    tipo_inmueble:            req.body.tipo_inmueble || null,
    subtipo_inmueble:         req.body.subtipo_inmueble || null,
    plazo_meses:              req.body.plazo_meses ? Number(req.body.plazo_meses) : null,
    documentos_adjuntos:      req.body.documentos_adjuntos || [],
  });

  res.status(201).json(db.obtener(id));
});

// Obtener por ID
app.get('/api/prospectos/:id', (req, res) => {
  const p = db.obtener(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
  res.json(p);
});

// Actualizar datos del prospecto (identidad, campos del cliente, gestión interna)
app.patch('/api/prospectos/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = db.obtener(id);
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });

  if (req.body.numero_documento && req.body.numero_documento !== p.numero_documento) {
    const otro = db.buscarPorDocumento(String(req.body.numero_documento).trim());
    if (otro && otro.id !== id)
      return res.status(409).json({ error: 'El número de documento ya existe en otro expediente' });
  }

  if (req.body.estado && !ESTADOS_VALIDOS.includes(req.body.estado))
    return res.status(400).json({ error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}` });

  db.actualizarProspecto(id, req.body);
  res.json(db.obtener(id));
});

// Ejecutar preevaluación o recálculo (crea nueva evaluación en el historial)
app.post('/api/prospectos/:id/evaluar', async (req, res) => {
  const id = Number(req.params.id);
  const p = db.obtener(id);
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });

  const errores = validarEvaluacion(req.body);
  if (errores.length > 0)
    return res.status(400).json({ error: 'Datos inválidos', detalles: errores });

  const input = {
    ingresos:               Number(req.body.ingresos),
    otros_ingresos:         Number(req.body.otros_ingresos || 0),
    obligaciones_mensuales: Number(req.body.obligaciones_mensuales || 0),
    score_credito:          Number(req.body.score_credito),
    reportes_negativos:     Boolean(req.body.reportes_negativos),
    valor_inmueble:         Number(req.body.valor_inmueble),
    monto_solicitado:       Number(req.body.monto_solicitado),
    tipo_inmueble:          req.body.tipo_inmueble,
    subtipo_inmueble:       req.body.subtipo_inmueble,
    plazo_meses:            Number(req.body.plazo_meses),
    documentacion:          req.body.documentacion,
    observaciones:          req.body.observaciones || null,
    motivo_recalculo:       req.body.motivo_recalculo || null,
  };

  const evaluacion = calcularPreEvaluacion({
    ingresos:               input.ingresos,
    otrosIngresos:          input.otros_ingresos,
    obligacionesMensuales:  input.obligaciones_mensuales,
    scoreCredito:           input.score_credito,
    valorInmueble:          input.valor_inmueble,
    montoSolicitado:        input.monto_solicitado,
    subtipo_inmueble:       input.subtipo_inmueble,
    plazoMeses:             input.plazo_meses,
    documentacion:          input.documentacion,
    reportesNegativos:      input.reportes_negativos,
  });

  let diagnosticoIA = { diagnostico: null, recomendacion: null };
  try {
    diagnosticoIA = await generarDiagnostico({ ...p, ...input }, evaluacion);
  } catch (err) {
    console.error('Error diagnóstico IA:', err.message);
  }

  db.crearEvaluacion(id, {
    ...input,
    tasa_mv:                  evaluacion.tasa_mv,
    cuota_sin_seguro:         evaluacion.cuota_sin_seguro,
    seguro_vida:              evaluacion.seguro_vida,
    seguro_incendio:          evaluacion.seguro_incendio,
    cuota_total:              evaluacion.cuota_total,
    cuota_maxima:             evaluacion.cuota_maxima,
    carga_maxima:             evaluacion.carga_maxima,
    carga_total:              evaluacion.carga_total,
    ltv:                      evaluacion.ltv,
    ingreso_minimo_requerido: evaluacion.ingreso_minimo_requerido,
    score_interno:            evaluacion.score_interno,
    detalle_score:            evaluacion.detalle_score,
    viabilidad:               evaluacion.viabilidad,
    factores_clasificacion:   evaluacion.factores_clasificacion,
    diagnostico_ia:           diagnosticoIA.diagnostico,
    recomendacion_asesor:     diagnosticoIA.recomendacion,
  });

  // Avanzar estado automáticamente si sigue en pendiente_validacion
  if (p.estado === 'pendiente_validacion') {
    db.actualizarProspecto(id, { estado: 'en_revision' });
  }

  res.status(201).json(db.obtener(id));
});

// Historial de evaluaciones
app.get('/api/prospectos/:id/evaluaciones', (req, res) => {
  const p = db.obtener(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Prospecto no encontrado' });
  res.json(db.listarEvaluaciones(Number(req.params.id)));
});

// Cambio de estado (alias)
app.patch('/api/prospectos/:id/estado', (req, res) => {
  const id = Number(req.params.id);
  const { estado, asesor_asignado, notas_internas } = req.body;
  if (estado && !ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}` });
  const ok = db.actualizarEstado(id, { estado, asesor_asignado, notas_internas });
  if (!ok) return res.status(400).json({ error: 'No hay campos para actualizar' });
  res.json(db.obtener(id));
});

// ── Arranque ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kreditton API corriendo en http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY)
    console.warn('⚠️  ANTHROPIC_API_KEY no configurada — diagnóstico IA en modo demo');
});
