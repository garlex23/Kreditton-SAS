const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kreditton.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Migración v1 → v2 (tabla única → prospectos + evaluaciones) ──────────────
function migrarV1() {
  const cols = db.pragma('table_info(prospectos)').map(c => c.name);
  if (cols.length === 0) return;
  if (!cols.includes('score_credito')) return;
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evaluaciones'").get()) return;

  console.log('🔄 Migrando BD v1 → v2…');
  db.pragma('foreign_keys = OFF');
  db.exec('ALTER TABLE prospectos RENAME TO _prospectos_v1');
  crearTablas();

  const viejos = db.prepare('SELECT * FROM _prospectos_v1').all();
  const stmtP = db.prepare(`
    INSERT INTO prospectos (id, fecha_registro, tipo_cliente, nombre_aliado, tipo_documento,
      numero_documento, nombre_completo, telefono, email, perfil_financiero, ingresos,
      estado, asesor_asignado, notas_internas)
    VALUES (@id, @fecha_registro, @tipo_cliente, @nombre_aliado, @tipo_documento,
      @numero_documento, @nombre_completo, @telefono, @email, @perfil_financiero, @ingresos,
      @estado, @asesor_asignado, @notas_internas)`);
  const stmtE = db.prepare(`
    INSERT INTO evaluaciones (prospecto_id, fecha_evaluacion, numero_evaluacion,
      ingresos, score_credito, reportes_negativos, valor_inmueble, monto_solicitado,
      tipo_inmueble, subtipo_inmueble, plazo_meses, documentacion, observaciones,
      tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima,
      ltv, ingreso_minimo_requerido, score_interno, detalle_score, viabilidad,
      factores_clasificacion, diagnostico_ia, recomendacion_asesor)
    VALUES (@prospecto_id, @fecha_evaluacion, 1,
      @ingresos, @score_credito, @reportes_negativos, @valor_inmueble, @monto_solicitado,
      @tipo_inmueble, @subtipo_inmueble, @plazo_meses, @documentacion, @observaciones,
      @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima,
      @ltv, @ingreso_minimo_requerido, @score_interno, @detalle_score, @viabilidad,
      @factores_clasificacion, @diagnostico_ia, @recomendacion_asesor)`);

  db.transaction(() => {
    for (const v of viejos) {
      stmtP.run({ ...v, estado: v.estado === 'nuevo' ? 'pendiente_validacion' : v.estado });
      const ei = stmtE.run({ prospecto_id: v.id, fecha_evaluacion: v.fecha_registro, ...v });
      db.prepare('UPDATE prospectos SET evaluacion_activa_id = ? WHERE id = ?').run(ei.lastInsertRowid, v.id);
    }
  })();
  db.exec('DROP TABLE _prospectos_v1');
  db.pragma('foreign_keys = ON');
  console.log(`✅ v1→v2 completada: ${viejos.length} prospectos.`);
}

// ── Migración v2 → v3 (nuevos campos + estado pendiente_validacion) ───────────
function migrarV2() {
  const cols = db.pragma('table_info(prospectos)').map(c => c.name);
  if (cols.length === 0) return;
  if (cols.includes('empresa_actual')) return; // ya es v3

  const evTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evaluaciones'").get();
  if (!evTable) return; // no es v2 todavía

  console.log('🔄 Migrando BD v2 → v3…');
  db.pragma('foreign_keys = OFF');

  db.exec('ALTER TABLE prospectos RENAME TO _prospectos_v2');
  db.exec('ALTER TABLE evaluaciones RENAME TO _evaluaciones_v2');
  crearTablas();

  const vPros = db.prepare('SELECT * FROM _prospectos_v2').all();
  const stmtP = db.prepare(`
    INSERT INTO prospectos (id, fecha_registro, tipo_cliente, nombre_aliado, tipo_documento,
      numero_documento, nombre_completo, telefono, email, perfil_financiero, ingresos,
      estado, asesor_asignado, notas_internas, evaluacion_activa_id)
    VALUES (@id, @fecha_registro, @tipo_cliente, @nombre_aliado, @tipo_documento,
      @numero_documento, @nombre_completo, @telefono, @email, @perfil_financiero, @ingresos,
      @estado, @asesor_asignado, @notas_internas, @evaluacion_activa_id)`);

  const colsEval = db.pragma('table_info(_evaluaciones_v2)').map(c => c.name);
  const stmtE = db.prepare(`
    INSERT INTO evaluaciones (id, prospecto_id, fecha_evaluacion, numero_evaluacion, motivo_recalculo,
      ingresos, score_credito, reportes_negativos, valor_inmueble, monto_solicitado,
      tipo_inmueble, subtipo_inmueble, plazo_meses, documentacion, observaciones,
      tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima,
      ltv, ingreso_minimo_requerido, score_interno, detalle_score, viabilidad,
      factores_clasificacion, diagnostico_ia, recomendacion_asesor)
    VALUES (@id, @prospecto_id, @fecha_evaluacion, @numero_evaluacion, @motivo_recalculo,
      @ingresos, @score_credito, @reportes_negativos, @valor_inmueble, @monto_solicitado,
      @tipo_inmueble, @subtipo_inmueble, @plazo_meses, @documentacion, @observaciones,
      @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima,
      @ltv, @ingreso_minimo_requerido, @score_interno, @detalle_score, @viabilidad,
      @factores_clasificacion, @diagnostico_ia, @recomendacion_asesor)`);

  db.transaction(() => {
    for (const p of vPros) {
      stmtP.run({ ...p, estado: p.estado === 'nuevo' ? 'pendiente_validacion' : p.estado });
    }
    const vEvals = db.prepare('SELECT * FROM _evaluaciones_v2').all();
    for (const e of vEvals) stmtE.run(e);
  })();

  db.exec('DROP TABLE _evaluaciones_v2');
  db.exec('DROP TABLE _prospectos_v2');
  db.pragma('foreign_keys = ON');
  console.log(`✅ v2→v3 completada: ${vPros.length} prospectos.`);
}

// ── Definición de tablas (v3) ─────────────────────────────────────────────────
function crearTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_registro TEXT NOT NULL,

      -- Origen
      tipo_cliente TEXT NOT NULL CHECK(tipo_cliente IN ('B2B','B2C')),
      nombre_aliado TEXT,

      -- Identidad (cliente llena en Tally)
      tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('CC','CE','PA')),
      numero_documento TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL,

      -- Perfil financiero (cliente llena en Tally)
      perfil_financiero TEXT NOT NULL CHECK(perfil_financiero IN ('empleado','independiente','pensionado')),
      empresa_actual TEXT,
      ingresos REAL NOT NULL,
      otros_ingresos REAL NOT NULL DEFAULT 0,
      obligaciones_mensuales REAL NOT NULL DEFAULT 0,

      -- Solicitud de crédito (cliente llena en Tally)
      valor_inmueble REAL,
      monto_solicitado REAL,
      cuota_inicial_disponible REAL,
      tipo_inmueble TEXT CHECK(tipo_inmueble IN ('nuevo','usado')),
      subtipo_inmueble TEXT CHECK(subtipo_inmueble IN ('apartamento','casa')),
      plazo_meses INTEGER,

      -- Documentos adjuntos (JSON array: [{tipo, nombre, url}])
      documentos_adjuntos TEXT,

      -- Gestión interna Kreditton
      estado TEXT NOT NULL DEFAULT 'pendiente_validacion'
        CHECK(estado IN ('pendiente_validacion','en_revision','asignado','cerrado')),
      asesor_asignado TEXT,
      notas_internas TEXT,

      evaluacion_activa_id INTEGER
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospecto_id INTEGER NOT NULL REFERENCES prospectos(id),
      fecha_evaluacion TEXT NOT NULL,
      numero_evaluacion INTEGER NOT NULL DEFAULT 1,
      motivo_recalculo TEXT,

      -- Snapshot de inputs (reproducibilidad)
      ingresos REAL NOT NULL,
      otros_ingresos REAL NOT NULL DEFAULT 0,
      obligaciones_mensuales REAL NOT NULL DEFAULT 0,
      score_credito INTEGER NOT NULL,
      reportes_negativos INTEGER NOT NULL DEFAULT 0,
      valor_inmueble REAL NOT NULL,
      monto_solicitado REAL NOT NULL,
      tipo_inmueble TEXT NOT NULL,
      subtipo_inmueble TEXT NOT NULL,
      plazo_meses INTEGER NOT NULL,
      documentacion TEXT NOT NULL,
      observaciones TEXT,

      -- Resultados financieros
      tasa_mv REAL,
      cuota_sin_seguro REAL,
      seguro_vida REAL,
      seguro_incendio REAL,
      cuota_total REAL,
      cuota_maxima REAL,
      carga_maxima REAL,
      carga_total REAL,
      ltv REAL,
      ingreso_minimo_requerido REAL,

      -- Score y viabilidad
      score_interno INTEGER,
      detalle_score TEXT,
      viabilidad TEXT CHECK(viabilidad IN ('Alta','Media','Baja')),
      factores_clasificacion TEXT,

      -- IA
      diagnostico_ia TEXT,
      recomendacion_asesor TEXT
    )
  `);
}

// Ejecutar migraciones en orden
migrarV1();
migrarV2();
crearTablas();

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsearFila(row) {
  if (!row) return null;
  return {
    ...row,
    reportes_negativos: row.reportes_negativos === 1,
    detalle_score: row.detalle_score ? JSON.parse(row.detalle_score) : [],
    factores_clasificacion: row.factores_clasificacion ? JSON.parse(row.factores_clasificacion) : [],
    documentos_adjuntos: row.documentos_adjuntos ? JSON.parse(row.documentos_adjuntos) : [],
  };
}

const SQL_PROSPECTO = `
  SELECT
    p.id, p.fecha_registro, p.tipo_cliente, p.nombre_aliado,
    p.tipo_documento, p.numero_documento, p.nombre_completo, p.telefono, p.email,
    p.perfil_financiero, p.empresa_actual, p.ingresos, p.otros_ingresos,
    p.obligaciones_mensuales, p.valor_inmueble, p.monto_solicitado,
    p.cuota_inicial_disponible, p.tipo_inmueble, p.subtipo_inmueble, p.plazo_meses,
    p.documentos_adjuntos,
    p.estado, p.asesor_asignado, p.notas_internas, p.evaluacion_activa_id,
    e.id              AS eval_id,
    e.numero_evaluacion,
    e.fecha_evaluacion,
    e.motivo_recalculo,
    e.score_credito,
    e.reportes_negativos,
    e.otros_ingresos  AS eval_otros_ingresos,
    e.obligaciones_mensuales AS eval_obligaciones,
    e.documentacion,
    e.observaciones,
    e.tasa_mv,
    e.cuota_sin_seguro,
    e.seguro_vida,
    e.seguro_incendio,
    e.cuota_total,
    e.cuota_maxima,
    e.carga_maxima,
    e.carga_total,
    e.ltv,
    e.ingreso_minimo_requerido,
    e.score_interno,
    e.detalle_score,
    e.viabilidad,
    e.factores_clasificacion,
    e.diagnostico_ia,
    e.recomendacion_asesor
  FROM prospectos p
  LEFT JOIN evaluaciones e ON e.id = p.evaluacion_activa_id
`;

// ── Insertar prospecto (datos externos Tally / formulario cliente) ────────────
function insertar(datos) {
  const info = db.prepare(`
    INSERT INTO prospectos (
      fecha_registro, tipo_cliente, nombre_aliado,
      tipo_documento, numero_documento, nombre_completo, telefono, email,
      perfil_financiero, empresa_actual, ingresos, otros_ingresos, obligaciones_mensuales,
      valor_inmueble, monto_solicitado, cuota_inicial_disponible,
      tipo_inmueble, subtipo_inmueble, plazo_meses,
      documentos_adjuntos, estado
    ) VALUES (
      @fecha_registro, @tipo_cliente, @nombre_aliado,
      @tipo_documento, @numero_documento, @nombre_completo, @telefono, @email,
      @perfil_financiero, @empresa_actual, @ingresos, @otros_ingresos, @obligaciones_mensuales,
      @valor_inmueble, @monto_solicitado, @cuota_inicial_disponible,
      @tipo_inmueble, @subtipo_inmueble, @plazo_meses,
      @documentos_adjuntos, @estado
    )
  `).run({
    fecha_registro: new Date().toISOString(),
    tipo_cliente: datos.tipo_cliente,
    nombre_aliado: datos.nombre_aliado || null,
    tipo_documento: datos.tipo_documento,
    numero_documento: datos.numero_documento,
    nombre_completo: datos.nombre_completo,
    telefono: datos.telefono,
    email: datos.email,
    perfil_financiero: datos.perfil_financiero,
    empresa_actual: datos.empresa_actual || null,
    ingresos: datos.ingresos || 0,
    otros_ingresos: datos.otros_ingresos || 0,
    obligaciones_mensuales: datos.obligaciones_mensuales || 0,
    valor_inmueble: datos.valor_inmueble || null,
    monto_solicitado: datos.monto_solicitado || null,
    cuota_inicial_disponible: datos.cuota_inicial_disponible || null,
    tipo_inmueble: datos.tipo_inmueble || null,
    subtipo_inmueble: datos.subtipo_inmueble || null,
    plazo_meses: datos.plazo_meses || null,
    documentos_adjuntos: datos.documentos_adjuntos ? JSON.stringify(datos.documentos_adjuntos) : null,
    estado: datos.estado || 'pendiente_validacion',
  });
  return info.lastInsertRowid;
}

// ── Buscar por documento (detección de duplicados) ────────────────────────────
function buscarPorDocumento(numero_documento) {
  return parsearFila(db.prepare(`${SQL_PROSPECTO} WHERE p.numero_documento = ?`).get(numero_documento));
}

// ── Actualizar campos del prospecto ───────────────────────────────────────────
function actualizarProspecto(id, campos) {
  const COLS = [
    'tipo_cliente', 'nombre_aliado', 'tipo_documento', 'numero_documento',
    'nombre_completo', 'telefono', 'email', 'perfil_financiero', 'empresa_actual',
    'ingresos', 'otros_ingresos', 'obligaciones_mensuales',
    'valor_inmueble', 'monto_solicitado', 'cuota_inicial_disponible',
    'tipo_inmueble', 'subtipo_inmueble', 'plazo_meses',
    'documentos_adjuntos',
    'estado', 'asesor_asignado', 'notas_internas',
  ];
  const sets = [], vals = [];
  for (const k of COLS) {
    if (!(k in campos)) continue;
    if (k === 'documentos_adjuntos' && typeof campos[k] !== 'string') {
      sets.push(`${k} = ?`); vals.push(JSON.stringify(campos[k]));
    } else {
      sets.push(`${k} = ?`); vals.push(campos[k]);
    }
  }
  if (sets.length === 0) return false;
  vals.push(id);
  db.prepare(`UPDATE prospectos SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return true;
}

// ── Crear nueva evaluación y marcarla como activa ─────────────────────────────
function crearEvaluacion(prospectoId, datos) {
  const { n } = db.prepare('SELECT COUNT(*) as n FROM evaluaciones WHERE prospecto_id = ?').get(prospectoId);

  const info = db.prepare(`
    INSERT INTO evaluaciones (
      prospecto_id, fecha_evaluacion, numero_evaluacion, motivo_recalculo,
      ingresos, otros_ingresos, obligaciones_mensuales,
      score_credito, reportes_negativos, valor_inmueble, monto_solicitado,
      tipo_inmueble, subtipo_inmueble, plazo_meses, documentacion, observaciones,
      tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima,
      carga_maxima, carga_total, ltv, ingreso_minimo_requerido,
      score_interno, detalle_score, viabilidad, factores_clasificacion,
      diagnostico_ia, recomendacion_asesor
    ) VALUES (
      @prospecto_id, @fecha_evaluacion, @numero_evaluacion, @motivo_recalculo,
      @ingresos, @otros_ingresos, @obligaciones_mensuales,
      @score_credito, @reportes_negativos, @valor_inmueble, @monto_solicitado,
      @tipo_inmueble, @subtipo_inmueble, @plazo_meses, @documentacion, @observaciones,
      @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima,
      @carga_maxima, @carga_total, @ltv, @ingreso_minimo_requerido,
      @score_interno, @detalle_score, @viabilidad, @factores_clasificacion,
      @diagnostico_ia, @recomendacion_asesor
    )
  `).run({
    ...datos,
    prospecto_id: prospectoId,
    fecha_evaluacion: new Date().toISOString(),
    numero_evaluacion: n + 1,
    motivo_recalculo: datos.motivo_recalculo || null,
    reportes_negativos: datos.reportes_negativos ? 1 : 0,
    otros_ingresos: datos.otros_ingresos || 0,
    obligaciones_mensuales: datos.obligaciones_mensuales || 0,
    carga_maxima: datos.carga_maxima || null,
    carga_total: datos.carga_total || null,
    detalle_score: JSON.stringify(datos.detalle_score),
    factores_clasificacion: JSON.stringify(datos.factores_clasificacion),
  });

  db.prepare('UPDATE prospectos SET evaluacion_activa_id = ? WHERE id = ?')
    .run(info.lastInsertRowid, prospectoId);

  return info.lastInsertRowid;
}

// ── Historial ─────────────────────────────────────────────────────────────────
function listarEvaluaciones(prospectoId) {
  return db.prepare('SELECT * FROM evaluaciones WHERE prospecto_id = ? ORDER BY numero_evaluacion DESC')
    .all(prospectoId).map(parsearFila);
}

// ── Listar con filtros ────────────────────────────────────────────────────────
function listar(filtros = {}) {
  let sql = SQL_PROSPECTO + ' WHERE 1=1';
  const params = [];
  if (filtros.viabilidad)   { sql += ' AND e.viabilidad = ?';   params.push(filtros.viabilidad); }
  if (filtros.tipo_cliente) { sql += ' AND p.tipo_cliente = ?'; params.push(filtros.tipo_cliente); }
  if (filtros.estado)       { sql += ' AND p.estado = ?';       params.push(filtros.estado); }
  if (filtros.sin_evaluar === 'true') sql += ' AND p.evaluacion_activa_id IS NULL';
  if (filtros.buscar) {
    sql += ' AND (p.nombre_completo LIKE ? OR p.numero_documento LIKE ?)';
    params.push(`%${filtros.buscar}%`, `%${filtros.buscar}%`);
  }
  sql += ' ORDER BY p.fecha_registro DESC';
  return db.prepare(sql).all(...params).map(parsearFila);
}

function obtener(id) {
  return parsearFila(db.prepare(`${SQL_PROSPECTO} WHERE p.id = ?`).get(id));
}

function actualizarEstado(id, campos) { return actualizarProspecto(id, campos); }

function stats() {
  const total = db.prepare('SELECT COUNT(*) as n FROM prospectos').get().n;
  const sinEvaluar = db.prepare('SELECT COUNT(*) as n FROM prospectos WHERE evaluacion_activa_id IS NULL').get().n;
  const porViabilidad = db.prepare(`
    SELECT e.viabilidad, COUNT(*) as n FROM prospectos p
    JOIN evaluaciones e ON e.id = p.evaluacion_activa_id GROUP BY e.viabilidad
  `).all().reduce((acc, r) => { acc[r.viabilidad] = r.n; return acc; }, { Alta: 0, Media: 0, Baja: 0 });
  const porEstado = db.prepare('SELECT estado, COUNT(*) as n FROM prospectos GROUP BY estado')
    .all().reduce((acc, r) => { acc[r.estado] = r.n; return acc; }, {});
  const porTipoCliente = db.prepare('SELECT tipo_cliente, COUNT(*) as n FROM prospectos GROUP BY tipo_cliente')
    .all().reduce((acc, r) => { acc[r.tipo_cliente] = r.n; return acc; }, { B2B: 0, B2C: 0 });
  return { total, sin_evaluar: sinEvaluar, por_viabilidad: porViabilidad, por_estado: porEstado, por_tipo_cliente: porTipoCliente };
}

module.exports = { insertar, buscarPorDocumento, actualizarProspecto, actualizarEstado, crearEvaluacion, listarEvaluaciones, listar, obtener, stats };
