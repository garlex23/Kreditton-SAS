require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { calcularPreEvaluacion, PARAMETROS } = require('./scoring');
const { generarDiagnostico } = require('./aiDiagnosis');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ── Validación básica ────────────────────────────────────────────────────────

const CAMPOS_REQUERIDOS = [
  'tipo_cliente', 'tipo_documento', 'numero_documento', 'nombre_completo',
  'telefono', 'email', 'perfil_financiero', 'ingresos', 'score_credito',
  'valor_inmueble', 'monto_solicitado', 'tipo_inmueble', 'subtipo_inmueble',
  'plazo_meses', 'documentacion',
];

function validar(body) {
  const errores = [];
  for (const campo of CAMPOS_REQUERIDOS) {
    if (body[campo] === undefined || body[campo] === null || body[campo] === '') {
      errores.push(`Campo requerido: ${campo}`);
    }
  }
  if (body.tipo_cliente === 'B2B' && !body.nombre_aliado) {
    errores.push('nombre_aliado es requerido para clientes B2B');
  }
  if (body.ingresos <= 0) errores.push('ingresos debe ser mayor a 0');
  if (body.valor_inmueble <= 0) errores.push('valor_inmueble debe ser mayor a 0');
  if (body.monto_solicitado <= 0) errores.push('monto_solicitado debe ser mayor a 0');
  if (body.monto_solicitado >= body.valor_inmueble) {
    errores.push('monto_solicitado no puede ser mayor o igual al valor del inmueble');
  }
  if (body.plazo_meses < 60 || body.plazo_meses > 240) {
    errores.push('plazo_meses debe estar entre 60 y 240');
  }
  if (body.score_credito < 300 || body.score_credito > 900) {
    errores.push('score_credito debe estar entre 300 y 900');
  }
  return errores;
}

// ── Rutas ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  res.json(db.stats());
});

app.get('/api/parametros', (req, res) => {
  res.json(PARAMETROS);
});

app.get('/api/prospectos', (req, res) => {
  const { viabilidad, tipo_cliente, estado } = req.query;
  const lista = db.listar({ viabilidad, tipo_cliente, estado });
  res.json(lista);
});

app.post('/api/prospectos', async (req, res) => {
  const errores = validar(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: errores });
  }

  const input = {
    tipo_cliente: req.body.tipo_cliente,
    nombre_aliado: req.body.nombre_aliado || null,
    tipo_documento: req.body.tipo_documento,
    numero_documento: String(req.body.numero_documento),
    nombre_completo: req.body.nombre_completo,
    telefono: req.body.telefono,
    email: req.body.email,
    perfil_financiero: req.body.perfil_financiero,
    ingresos: Number(req.body.ingresos),
    score_credito: Number(req.body.score_credito),
    reportes_negativos: Boolean(req.body.reportes_negativos),
    valor_inmueble: Number(req.body.valor_inmueble),
    monto_solicitado: Number(req.body.monto_solicitado),
    tipo_inmueble: req.body.tipo_inmueble,
    subtipo_inmueble: req.body.subtipo_inmueble,
    plazo_meses: Number(req.body.plazo_meses),
    documentacion: req.body.documentacion,
    observaciones: req.body.observaciones || null,
  };

  const evaluacion = calcularPreEvaluacion({
    ingresos: input.ingresos,
    scoreCredito: input.score_credito,
    valorInmueble: input.valor_inmueble,
    montoSolicitado: input.monto_solicitado,
    subtipo_inmueble: input.subtipo_inmueble,
    plazoMeses: input.plazo_meses,
    documentacion: input.documentacion,
    reportesNegativos: input.reportes_negativos,
  });

  let diagnosticoIA = { diagnostico: null, recomendacion: null };
  try {
    diagnosticoIA = await generarDiagnostico(input, evaluacion);
  } catch (err) {
    console.error('Error generando diagnóstico IA:', err.message);
  }

  const id = db.insertar({
    fecha_registro: new Date().toISOString(),
    ...input,
    tasa_mv: evaluacion.tasa_mv,
    cuota_sin_seguro: evaluacion.cuota_sin_seguro,
    seguro_vida: evaluacion.seguro_vida,
    seguro_incendio: evaluacion.seguro_incendio,
    cuota_total: evaluacion.cuota_total,
    cuota_maxima: evaluacion.cuota_maxima,
    ltv: evaluacion.ltv,
    ingreso_minimo_requerido: evaluacion.ingreso_minimo_requerido,
    score_interno: evaluacion.score_interno,
    detalle_score: evaluacion.detalle_score,
    viabilidad: evaluacion.viabilidad,
    factores_clasificacion: evaluacion.factores_clasificacion,
    diagnostico_ia: diagnosticoIA.diagnostico,
    recomendacion_asesor: diagnosticoIA.recomendacion,
  });

  const creado = db.obtener(id);
  res.status(201).json(creado);
});

app.get('/api/prospectos/:id', (req, res) => {
  const prospecto = db.obtener(Number(req.params.id));
  if (!prospecto) return res.status(404).json({ error: 'Prospecto no encontrado' });
  res.json(prospecto);
});

app.patch('/api/prospectos/:id/estado', (req, res) => {
  const { estado, asesor_asignado, notas_internas } = req.body;
  const ESTADOS_VALIDOS = ['nuevo', 'en_revision', 'asignado', 'cerrado'];
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}` });
  }
  const ok = db.actualizarEstado(Number(req.params.id), { estado, asesor_asignado, notas_internas });
  if (!ok) return res.status(400).json({ error: 'No hay campos para actualizar' });
  res.json(db.obtener(Number(req.params.id)));
});

// ── Arranque ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Kreditton API corriendo en http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY no configurada — diagnóstico IA en modo demo');
  }
});
