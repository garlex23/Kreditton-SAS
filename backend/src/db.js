const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kreditton.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Migración automática v1 → v2 ─────────────────────────────────────────────
// v1: todo en una sola tabla prospectos con score_credito, evaluación, etc.
// v2: prospectos (identidad + gestión) + evaluaciones (historial de cálculos)
function migrarV1() {
  const cols = db.pragma('table_info(prospectos)').map(c => c.name);
  if (cols.length === 0) return;               // tabla no existe → fresh install
  if (!cols.includes('score_credito')) return; // ya es v2
  const evTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='evaluaciones'"
  ).get();
  if (evTable) return;

  console.log('🔄 Migrando BD de v1 → v2…');
  db.pragma('foreign_keys = OFF');

  db.exec('ALTER TABLE prospectos RENAME TO _prospectos_v1');
  db.exec(`
    CREATE TABLE prospectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_registro TEXT NOT NULL,
      tipo_cliente TEXT NOT NULL CHECK(tipo_cliente IN ('B2B','B2C')),
      nombre_aliado TEXT,
      tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('CC','CE','PA')),
      numero_documento TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL,
      perfil_financiero TEXT NOT NULL CHECK(perfil_financiero IN ('empleado','independiente','pensionado')),
      ingresos REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'nuevo' CHECK(estado IN ('nuevo','en_revision','asignado','cerrado')),
      asesor_asignado TEXT,
      notas_internas TEXT,
      evaluacion_activa_id INTEGER
    )
  `);
  db.exec(`
    CREATE TABLE evaluaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospecto_id INTEGER NOT NULL REFERENCES prospectos(id),
      fecha_evaluacion TEXT NOT NULL,
      numero_evaluacion INTEGER NOT NULL DEFAULT 1,
      motivo_recalculo TEXT,
      ingresos REAL NOT NULL,
      score_credito INTEGER NOT NULL,
      reportes_negativos INTEGER NOT NULL DEFAULT 0,
      valor_inmueble REAL NOT NULL,
      monto_solicitado REAL NOT NULL,
      tipo_inmueble TEXT NOT NULL,
      subtipo_inmueble TEXT NOT NULL,
      plazo_meses INTEGER NOT NULL,
      documentacion TEXT NOT NULL,
      observaciones TEXT,
      tasa_mv REAL,
      cuota_sin_seguro REAL,
      seguro_vida REAL,
      seguro_incendio REAL,
      cuota_total REAL,
      cuota_maxima REAL,
      ltv REAL,
      ingreso_minimo_requerido REAL,
      score_interno INTEGER,
      detalle_score TEXT,
      viabilidad TEXT CHECK(viabilidad IN ('Alta','Media','Baja')),
      factores_clasificacion TEXT,
      diagnostico_ia TEXT,
      recomendacion_asesor TEXT
    )
  `);

  const viejos = db.prepare('SELECT * FROM _prospectos_v1').all();
  const stmtP = db.prepare(`
    INSERT INTO prospectos
      (id, fecha_registro, tipo_cliente, nombre_aliado, tipo_documento, numero_documento,
       nombre_completo, telefono, email, perfil_financiero, ingresos,
       estado, asesor_asignado, notas_internas)
    VALUES
      (@id, @fecha_registro, @tipo_cliente, @nombre_aliado, @tipo_documento, @numero_documento,
       @nombre_completo, @telefono, @email, @perfil_financiero, @ingresos,
       @estado, @asesor_asignado, @notas_internas)
  `);
  const stmtE = db.prepare(`
    INSERT INTO evaluaciones
      (prospecto_id, fecha_evaluacion, numero_evaluacion,
       ingresos, score_credito, reportes_negativos, valor_inmueble, monto_solicitado,
       tipo_inmueble, subtipo_inmueble, plazo_meses, documentacion, observaciones,
       tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima,
       ltv, ingreso_minimo_requerido, score_interno, detalle_score, viabilidad,
       factores_clasificacion, diagnostico_ia, recomendacion_asesor)
    VALUES
      (@prospecto_id, @fecha_evaluacion, 1,
       @ingresos, @score_credito, @reportes_negativos, @valor_inmueble, @monto_solicitado,
       @tipo_inmueble, @subtipo_inmueble, @plazo_meses, @documentacion, @observaciones,
       @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima,
       @ltv, @ingreso_minimo_requerido, @score_interno, @detalle_score, @viabilidad,
       @factores_clasificacion, @diagnostico_ia, @recomendacion_asesor)
  `);

  db.transaction(() => {
    for (const v of viejos) {
      stmtP.run(v);
      const eInfo = stmtE.run({ prospecto_id: v.id, fecha_evaluacion: v.fecha_registro, ...v });
      db.prepare('UPDATE prospectos SET evaluacion_activa_id = ? WHERE id = ?')
        .run(eInfo.lastInsertRowid, v.id);
    }
  })();

  db.exec('DROP TABLE _prospectos_v1');
  db.pragma('foreign_keys = ON');
  console.log(`✅ Migración completada: ${viejos.length} prospecto(s) migrado(s).`);
}

migrarV1();

// ── Crear tablas si no existen (fresh install) ────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS prospectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro TEXT NOT NULL,
    tipo_cliente TEXT NOT NULL CHECK(tipo_cliente IN ('B2B','B2C')),
    nombre_aliado TEXT,
    tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('CC','CE','PA')),
    numero_documento TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT NOT NULL,
    perfil_financiero TEXT NOT NULL CHECK(perfil_financiero IN ('empleado','independiente','pensionado')),
    ingresos REAL NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK(estado IN ('nuevo','en_revision','asignado','cerrado')),
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
    ingresos REAL NOT NULL,
    score_credito INTEGER NOT NULL,
    reportes_negativos INTEGER NOT NULL DEFAULT 0,
    valor_inmueble REAL NOT NULL,
    monto_solicitado REAL NOT NULL,
    tipo_inmueble TEXT NOT NULL,
    subtipo_inmueble TEXT NOT NULL,
    plazo_meses INTEGER NOT NULL,
    documentacion TEXT NOT NULL,
    observaciones TEXT,
    tasa_mv REAL,
    cuota_sin_seguro REAL,
    seguro_vida REAL,
    seguro_incendio REAL,
    cuota_total REAL,
    cuota_maxima REAL,
    ltv REAL,
    ingreso_minimo_requerido REAL,
    score_interno INTEGER,
    detalle_score TEXT,
    viabilidad TEXT CHECK(viabilidad IN ('Alta','Media','Baja')),
    factores_clasificacion TEXT,
    diagnostico_ia TEXT,
    recomendacion_asesor TEXT
  )
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsearFila(row) {
  if (!row) return null;
  return {
    ...row,
    reportes_negativos: row.reportes_negativos === 1,
    detalle_score: row.detalle_score ? JSON.parse(row.detalle_score) : [],
    factores_clasificacion: row.factores_clasificacion
      ? JSON.parse(row.factores_clasificacion)
      : [],
  };
}

// Columnas del JOIN prospecto ← evaluación activa
const SQL_PROSPECTO = `
  SELECT
    p.id, p.fecha_registro, p.tipo_cliente, p.nombre_aliado,
    p.tipo_documento, p.numero_documento, p.nombre_completo, p.telefono, p.email,
    p.perfil_financiero, p.ingresos,
    p.estado, p.asesor_asignado, p.notas_internas, p.evaluacion_activa_id,
    e.id              AS eval_id,
    e.numero_evaluacion,
    e.fecha_evaluacion,
    e.motivo_recalculo,
    e.score_credito,
    e.reportes_negativos,
    e.valor_inmueble,
    e.monto_solicitado,
    e.tipo_inmueble,
    e.subtipo_inmueble,
    e.plazo_meses,
    e.documentacion,
    e.observaciones,
    e.tasa_mv,
    e.cuota_sin_seguro,
    e.seguro_vida,
    e.seguro_incendio,
    e.cuota_total,
    e.cuota_maxima,
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

// ── Insertar prospecto (datos externos del cliente/aliado, sin evaluación) ─────
function insertar(datos) {
  const info = db.prepare(`
    INSERT INTO prospectos
      (fecha_registro, tipo_cliente, nombre_aliado,
       tipo_documento, numero_documento, nombre_completo, telefono, email,
       perfil_financiero, ingresos)
    VALUES
      (@fecha_registro, @tipo_cliente, @nombre_aliado,
       @tipo_documento, @numero_documento, @nombre_completo, @telefono, @email,
       @perfil_financiero, @ingresos)
  `).run(datos);
  return info.lastInsertRowid;
}

// ── Buscar por documento (detección de duplicados) ────────────────────────────
function buscarPorDocumento(numero_documento) {
  return parsearFila(
    db.prepare(`${SQL_PROSPECTO} WHERE p.numero_documento = ?`).get(numero_documento)
  );
}

// ── Actualizar campos del prospecto (identidad + gestión) ─────────────────────
function actualizarProspecto(id, campos) {
  const COLS = [
    'tipo_cliente', 'nombre_aliado', 'tipo_documento', 'numero_documento',
    'nombre_completo', 'telefono', 'email', 'perfil_financiero', 'ingresos',
    'estado', 'asesor_asignado', 'notas_internas',
  ];
  const sets = [];
  const vals = [];
  for (const k of COLS) {
    if (k in campos) { sets.push(`${k} = ?`); vals.push(campos[k]); }
  }
  if (sets.length === 0) return false;
  vals.push(id);
  db.prepare(`UPDATE prospectos SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return true;
}

// ── Crear nueva evaluación y marcarla como activa ─────────────────────────────
function crearEvaluacion(prospectoId, datos) {
  const { n } = db.prepare(
    'SELECT COUNT(*) as n FROM evaluaciones WHERE prospecto_id = ?'
  ).get(prospectoId);

  const info = db.prepare(`
    INSERT INTO evaluaciones
      (prospecto_id, fecha_evaluacion, numero_evaluacion, motivo_recalculo,
       ingresos, score_credito, reportes_negativos, valor_inmueble, monto_solicitado,
       tipo_inmueble, subtipo_inmueble, plazo_meses, documentacion, observaciones,
       tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima,
       ltv, ingreso_minimo_requerido, score_interno, detalle_score, viabilidad,
       factores_clasificacion, diagnostico_ia, recomendacion_asesor)
    VALUES
      (@prospecto_id, @fecha_evaluacion, @numero_evaluacion, @motivo_recalculo,
       @ingresos, @score_credito, @reportes_negativos, @valor_inmueble, @monto_solicitado,
       @tipo_inmueble, @subtipo_inmueble, @plazo_meses, @documentacion, @observaciones,
       @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima,
       @ltv, @ingreso_minimo_requerido, @score_interno, @detalle_score, @viabilidad,
       @factores_clasificacion, @diagnostico_ia, @recomendacion_asesor)
  `).run({
    ...datos,
    prospecto_id: prospectoId,
    fecha_evaluacion: new Date().toISOString(),
    numero_evaluacion: n + 1,
    motivo_recalculo: datos.motivo_recalculo || null,
    reportes_negativos: datos.reportes_negativos ? 1 : 0,
    detalle_score: JSON.stringify(datos.detalle_score),
    factores_clasificacion: JSON.stringify(datos.factores_clasificacion),
  });

  db.prepare('UPDATE prospectos SET evaluacion_activa_id = ? WHERE id = ?')
    .run(info.lastInsertRowid, prospectoId);

  return info.lastInsertRowid;
}

// ── Historial de evaluaciones ─────────────────────────────────────────────────
function listarEvaluaciones(prospectoId) {
  return db.prepare(
    'SELECT * FROM evaluaciones WHERE prospecto_id = ? ORDER BY numero_evaluacion DESC'
  ).all(prospectoId).map(parsearFila);
}

// ── Listar prospectos (con filtros) ───────────────────────────────────────────
function listar(filtros = {}) {
  let sql = SQL_PROSPECTO + ' WHERE 1=1';
  const params = [];
  if (filtros.viabilidad)   { sql += ' AND e.viabilidad = ?';   params.push(filtros.viabilidad); }
  if (filtros.tipo_cliente) { sql += ' AND p.tipo_cliente = ?'; params.push(filtros.tipo_cliente); }
  if (filtros.estado)       { sql += ' AND p.estado = ?';       params.push(filtros.estado); }
  if (filtros.sin_evaluar === 'true') { sql += ' AND p.evaluacion_activa_id IS NULL'; }
  if (filtros.buscar) {
    sql += ' AND (p.nombre_completo LIKE ? OR p.numero_documento LIKE ?)';
    params.push(`%${filtros.buscar}%`, `%${filtros.buscar}%`);
  }
  sql += ' ORDER BY p.fecha_registro DESC';
  return db.prepare(sql).all(...params).map(parsearFila);
}

// ── Obtener prospecto por ID ──────────────────────────────────────────────────
function obtener(id) {
  return parsearFila(db.prepare(`${SQL_PROSPECTO} WHERE p.id = ?`).get(id));
}

// ── Actualizar estado (alias para compatibilidad) ─────────────────────────────
function actualizarEstado(id, campos) {
  return actualizarProspecto(id, campos);
}

// ── Estadísticas ──────────────────────────────────────────────────────────────
function stats() {
  const total = db.prepare('SELECT COUNT(*) as n FROM prospectos').get().n;
  const sinEvaluar = db.prepare(
    'SELECT COUNT(*) as n FROM prospectos WHERE evaluacion_activa_id IS NULL'
  ).get().n;
  const porViabilidad = db.prepare(`
    SELECT e.viabilidad, COUNT(*) as n
    FROM prospectos p JOIN evaluaciones e ON e.id = p.evaluacion_activa_id
    GROUP BY e.viabilidad
  `).all().reduce((acc, r) => { acc[r.viabilidad] = r.n; return acc; }, { Alta: 0, Media: 0, Baja: 0 });
  const porEstado = db.prepare(
    'SELECT estado, COUNT(*) as n FROM prospectos GROUP BY estado'
  ).all().reduce((acc, r) => { acc[r.estado] = r.n; return acc; }, {});
  const porTipoCliente = db.prepare(
    'SELECT tipo_cliente, COUNT(*) as n FROM prospectos GROUP BY tipo_cliente'
  ).all().reduce((acc, r) => { acc[r.tipo_cliente] = r.n; return acc; }, { B2B: 0, B2C: 0 });
  return { total, sin_evaluar: sinEvaluar, por_viabilidad: porViabilidad, por_estado: porEstado, por_tipo_cliente: porTipoCliente };
}

module.exports = {
  insertar, buscarPorDocumento,
  actualizarProspecto, actualizarEstado,
  crearEvaluacion, listarEvaluaciones,
  listar, obtener, stats,
};
