const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kreditton.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS prospectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro TEXT NOT NULL,

    -- Origen
    tipo_cliente TEXT NOT NULL CHECK(tipo_cliente IN ('B2B','B2C')),
    nombre_aliado TEXT,

    -- Datos personales
    tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('CC','CE','PA')),
    numero_documento TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT NOT NULL,

    -- Perfil financiero
    perfil_financiero TEXT NOT NULL CHECK(perfil_financiero IN ('empleado','independiente','pensionado')),
    ingresos REAL NOT NULL,
    score_credito INTEGER NOT NULL,
    reportes_negativos INTEGER NOT NULL DEFAULT 0,

    -- Crédito
    valor_inmueble REAL NOT NULL,
    monto_solicitado REAL NOT NULL,
    tipo_inmueble TEXT NOT NULL CHECK(tipo_inmueble IN ('nuevo','usado')),
    subtipo_inmueble TEXT NOT NULL CHECK(subtipo_inmueble IN ('apartamento','casa')),
    plazo_meses INTEGER NOT NULL,

    -- Documentación
    documentacion TEXT NOT NULL CHECK(documentacion IN ('completa','parcial','incompleta')),
    observaciones TEXT,

    -- Calculados (financiero)
    tasa_mv REAL,
    cuota_sin_seguro REAL,
    seguro_vida REAL,
    seguro_incendio REAL,
    cuota_total REAL,
    cuota_maxima REAL,
    ltv REAL,
    ingreso_minimo_requerido REAL,

    -- Score y viabilidad
    score_interno INTEGER,
    detalle_score TEXT,
    viabilidad TEXT CHECK(viabilidad IN ('Alta','Media','Baja')),
    factores_clasificacion TEXT,

    -- IA
    diagnostico_ia TEXT,
    recomendacion_asesor TEXT,

    -- Gestión
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK(estado IN ('nuevo','en_revision','asignado','cerrado')),
    asesor_asignado TEXT,
    notas_internas TEXT
  )
`);

const stmtInsert = db.prepare(`
  INSERT INTO prospectos (
    fecha_registro, tipo_cliente, nombre_aliado,
    tipo_documento, numero_documento, nombre_completo, telefono, email,
    perfil_financiero, ingresos, score_credito, reportes_negativos,
    valor_inmueble, monto_solicitado, tipo_inmueble, subtipo_inmueble, plazo_meses,
    documentacion, observaciones,
    tasa_mv, cuota_sin_seguro, seguro_vida, seguro_incendio, cuota_total, cuota_maxima, ltv, ingreso_minimo_requerido,
    score_interno, detalle_score, viabilidad, factores_clasificacion,
    diagnostico_ia, recomendacion_asesor
  ) VALUES (
    @fecha_registro, @tipo_cliente, @nombre_aliado,
    @tipo_documento, @numero_documento, @nombre_completo, @telefono, @email,
    @perfil_financiero, @ingresos, @score_credito, @reportes_negativos,
    @valor_inmueble, @monto_solicitado, @tipo_inmueble, @subtipo_inmueble, @plazo_meses,
    @documentacion, @observaciones,
    @tasa_mv, @cuota_sin_seguro, @seguro_vida, @seguro_incendio, @cuota_total, @cuota_maxima, @ltv, @ingreso_minimo_requerido,
    @score_interno, @detalle_score, @viabilidad, @factores_clasificacion,
    @diagnostico_ia, @recomendacion_asesor
  )
`);

function insertar(datos) {
  const info = stmtInsert.run({
    ...datos,
    detalle_score: JSON.stringify(datos.detalle_score),
    factores_clasificacion: JSON.stringify(datos.factores_clasificacion),
    reportes_negativos: datos.reportes_negativos ? 1 : 0,
  });
  return info.lastInsertRowid;
}

function listar(filtros = {}) {
  let sql = 'SELECT * FROM prospectos WHERE 1=1';
  const params = [];
  if (filtros.viabilidad) { sql += ' AND viabilidad = ?'; params.push(filtros.viabilidad); }
  if (filtros.tipo_cliente) { sql += ' AND tipo_cliente = ?'; params.push(filtros.tipo_cliente); }
  if (filtros.estado) { sql += ' AND estado = ?'; params.push(filtros.estado); }
  sql += ' ORDER BY fecha_registro DESC';
  return db.prepare(sql).all(...params).map(parsear);
}

function obtener(id) {
  const row = db.prepare('SELECT * FROM prospectos WHERE id = ?').get(id);
  return row ? parsear(row) : null;
}

function actualizarEstado(id, campos) {
  const sets = [];
  const values = [];
  if (campos.estado) { sets.push('estado = ?'); values.push(campos.estado); }
  if (campos.asesor_asignado !== undefined) { sets.push('asesor_asignado = ?'); values.push(campos.asesor_asignado); }
  if (campos.notas_internas !== undefined) { sets.push('notas_internas = ?'); values.push(campos.notas_internas); }
  if (sets.length === 0) return false;
  values.push(id);
  db.prepare(`UPDATE prospectos SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return true;
}

function stats() {
  const total = db.prepare('SELECT COUNT(*) as n FROM prospectos').get().n;
  const porViabilidad = db.prepare("SELECT viabilidad, COUNT(*) as n FROM prospectos GROUP BY viabilidad").all()
    .reduce((acc, r) => { acc[r.viabilidad] = r.n; return acc; }, { Alta: 0, Media: 0, Baja: 0 });
  const porEstado = db.prepare("SELECT estado, COUNT(*) as n FROM prospectos GROUP BY estado").all()
    .reduce((acc, r) => { acc[r.estado] = r.n; return acc; }, {});
  const porTipoCliente = db.prepare("SELECT tipo_cliente, COUNT(*) as n FROM prospectos GROUP BY tipo_cliente").all()
    .reduce((acc, r) => { acc[r.tipo_cliente] = r.n; return acc; }, { B2B: 0, B2C: 0 });
  return { total, por_viabilidad: porViabilidad, por_estado: porEstado, por_tipo_cliente: porTipoCliente };
}

function parsear(row) {
  return {
    ...row,
    reportes_negativos: row.reportes_negativos === 1,
    detalle_score: row.detalle_score ? JSON.parse(row.detalle_score) : [],
    factores_clasificacion: row.factores_clasificacion ? JSON.parse(row.factores_clasificacion) : [],
  };
}

module.exports = { insertar, listar, obtener, actualizarEstado, stats };
