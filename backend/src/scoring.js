/**
 * Motor de preevaluación financiera Kreditton SAS
 * Puro JS — sin dependencias externas. Usable también en nodos Function de n8n.
 *
 * v3: incluye otros_ingresos y obligaciones_mensuales en el cálculo de DTI.
 * La regla del 40% aplica sobre TODA la deuda (hipoteca + obligaciones existentes)
 * contra el TOTAL de ingresos (principal + otros).
 */

const PARAMETROS = {
  TASA_EA: 0.155,
  PLAZO_MAXIMO_MESES: 240,
  PLAZO_MINIMO_MESES: 60,
  MAX_DEUDA_RATIO: 0.40,

  ALTA_LTV_MAX: 0.80,
  ALTA_SCORE_CREDITO_MIN: 700,

  MEDIA_LTV_MAX: 0.90,
  MEDIA_SCORE_CREDITO_MIN: 600,

  SEGURO_VIDA_FACTOR: 1800 / 10_000_000,
  SEGURO_INCENDIO_APTO_FACTOR: (130 * 0.95) / 1_000_000,
  SEGURO_INCENDIO_CASA_FACTOR: (150 * 0.85) / 1_000_000,
};

// ── Cálculos financieros ──────────────────────────────────────────────────────

function calcTasaMV() {
  return Math.pow(1 + PARAMETROS.TASA_EA, 1 / 12) - 1;
}

function calcCuotaSinSeguro(monto, plazoMeses, tasaMV) {
  return (tasaMV * monto) / (1 - Math.pow(1 + tasaMV, -plazoMeses));
}

function calcSeguroVida(monto) {
  return monto * PARAMETROS.SEGURO_VIDA_FACTOR;
}

function calcSeguroIncendio(valorInmueble, subtipo) {
  const factor = subtipo === 'apartamento'
    ? PARAMETROS.SEGURO_INCENDIO_APTO_FACTOR
    : PARAMETROS.SEGURO_INCENDIO_CASA_FACTOR;
  return valorInmueble * factor;
}

// ── Score interno (0–100) ─────────────────────────────────────────────────────

function calcScoreInterno({ cargaTotal, ingresosTotales, ltv, scoreCredito, documentacion, reportesNegativos }) {
  const detalle = [];
  let total = 0;

  // 1. Capacidad de pago (40 pts) — carga total (hipoteca + obligaciones) vs ingresos totales
  const ratio = cargaTotal / ingresosTotales;
  let ptsPago = 0, obsPago = '';
  if (ratio <= 0.25)      { ptsPago = 40; obsPago = 'Excelente capacidad de pago'; }
  else if (ratio <= 0.30) { ptsPago = 35; obsPago = 'Muy buena capacidad de pago'; }
  else if (ratio <= 0.35) { ptsPago = 25; obsPago = 'Capacidad de pago moderada'; }
  else if (ratio <= 0.40) { ptsPago = 10; obsPago = 'Carga financiera en el límite máximo permitido (40%)'; }
  else { ptsPago = 0; obsPago = `Carga financiera (${(ratio * 100).toFixed(1)}%) supera el máximo del 40%`; }
  detalle.push({ componente: 'Capacidad de pago', puntos: ptsPago, maximo: 40, observacion: obsPago });
  total += ptsPago;

  // 2. LTV (30 pts)
  let ptsLTV = 0, obsLTV = '';
  if (ltv <= 0.60)      { ptsLTV = 30; obsLTV = 'LTV muy conservador'; }
  else if (ltv <= 0.70) { ptsLTV = 25; obsLTV = 'LTV conservador'; }
  else if (ltv <= 0.80) { ptsLTV = 20; obsLTV = 'LTV dentro del rango aceptable'; }
  else if (ltv <= 0.90) { ptsLTV = 10; obsLTV = 'LTV elevado — mayor riesgo para el banco'; }
  else { ptsLTV = 0; obsLTV = `LTV del ${(ltv * 100).toFixed(1)}% supera el máximo del 90%`; }
  detalle.push({ componente: 'LTV (préstamo / valor inmueble)', puntos: ptsLTV, maximo: 30, observacion: obsLTV });
  total += ptsLTV;

  // 3. Score crediticio externo (20 pts)
  let ptsScore = 0, obsScore = '';
  if (scoreCredito >= 750)      { ptsScore = 20; obsScore = 'Historial crediticio excelente'; }
  else if (scoreCredito >= 700) { ptsScore = 17; obsScore = 'Historial crediticio muy bueno'; }
  else if (scoreCredito >= 650) { ptsScore = 12; obsScore = 'Historial crediticio bueno'; }
  else if (scoreCredito >= 600) { ptsScore = 8;  obsScore = 'Historial crediticio aceptable'; }
  else { ptsScore = 0; obsScore = `Score de ${scoreCredito} por debajo del mínimo (600)`; }
  detalle.push({ componente: 'Score crediticio (Datacrédito/TransUnion)', puntos: ptsScore, maximo: 20, observacion: obsScore });
  total += ptsScore;

  // 4. Documentación (10 pts)
  const ptsDocs = documentacion === 'completa' ? 10 : documentacion === 'parcial' ? 5 : 0;
  const obsDocs = documentacion === 'completa' ? 'Documentación completa'
    : documentacion === 'parcial' ? 'Documentación parcial — debe completarse'
    : 'Documentación insuficiente para presentar al banco';
  detalle.push({ componente: 'Documentación', puntos: ptsDocs, maximo: 10, observacion: obsDocs });
  total += ptsDocs;

  // Penalización: reportes negativos (-15)
  if (reportesNegativos) {
    detalle.push({ componente: 'Penalización — reportes negativos', puntos: -15, maximo: 0, observacion: 'Reportes negativos en centrales de riesgo' });
    total = Math.max(0, total - 15);
  }

  return { score: total, detalle };
}

// ── Clasificación de viabilidad ───────────────────────────────────────────────

function clasificarViabilidad({ cuotaTotal, cuotaMaxima, cargaTotal, cargaMaxima, ltv, scoreCredito, documentacion, reportesNegativos }) {
  const factoresBaja = [];

  // La carga total (cuota hipoteca + obligaciones) supera el 40% de los ingresos totales
  if (cargaTotal > cargaMaxima)
    factoresBaja.push(`Carga financiera total (${formatCOP(cargaTotal)}) supera el máximo permitido del 40% sobre ingresos (${formatCOP(cargaMaxima)})`);
  if (ltv > PARAMETROS.MEDIA_LTV_MAX)
    factoresBaja.push(`LTV del ${(ltv * 100).toFixed(1)}% supera el máximo del 90%`);
  if (scoreCredito < PARAMETROS.MEDIA_SCORE_CREDITO_MIN)
    factoresBaja.push(`Score crediticio de ${scoreCredito} por debajo del mínimo requerido (600)`);
  if (reportesNegativos)
    factoresBaja.push('Reportes negativos en centrales de riesgo');
  if (documentacion === 'incompleta')
    factoresBaja.push('Documentación incompleta impide el análisis bancario');

  if (factoresBaja.length > 0) return { viabilidad: 'Baja', factores: factoresBaja };

  const esAlta =
    cargaTotal <= cargaMaxima &&
    ltv <= PARAMETROS.ALTA_LTV_MAX &&
    scoreCredito >= PARAMETROS.ALTA_SCORE_CREDITO_MIN &&
    documentacion === 'completa' &&
    !reportesNegativos;

  if (esAlta) return { viabilidad: 'Alta', factores: ['Prospecto cumple todos los criterios de alta viabilidad'] };

  const factoresMedia = [];
  if (ltv > PARAMETROS.ALTA_LTV_MAX && ltv <= PARAMETROS.MEDIA_LTV_MAX)
    factoresMedia.push(`LTV del ${(ltv * 100).toFixed(1)}% en rango medio (80–90%): requiere análisis adicional`);
  if (scoreCredito >= PARAMETROS.MEDIA_SCORE_CREDITO_MIN && scoreCredito < PARAMETROS.ALTA_SCORE_CREDITO_MIN)
    factoresMedia.push(`Score crediticio de ${scoreCredito} en rango medio (600–699)`);
  if (documentacion === 'parcial')
    factoresMedia.push('Documentación parcial: completar expediente antes de presentar al banco');
  if (cuotaTotal > cuotaMaxima && cargaTotal <= cargaMaxima)
    factoresMedia.push('La cuota hipotecaria supera el disponible, pero las obligaciones totales están dentro del límite');

  return { viabilidad: 'Media', factores: factoresMedia };
}

// ── Función principal exportada ───────────────────────────────────────────────

function calcularPreEvaluacion(datos) {
  const {
    ingresos,
    otrosIngresos = 0,
    obligacionesMensuales = 0,
    scoreCredito,
    valorInmueble,
    montoSolicitado,
    subtipo_inmueble,
    plazoMeses,
    documentacion,
    reportesNegativos,
  } = datos;

  const ingresosTotales = ingresos + otrosIngresos;

  const tasaMV = calcTasaMV();
  const cuotaSinSeguro = calcCuotaSinSeguro(montoSolicitado, plazoMeses, tasaMV);
  const seguroVida = calcSeguroVida(montoSolicitado);
  const seguroIncendio = calcSeguroIncendio(valorInmueble, subtipo_inmueble);
  const cuotaTotal = cuotaSinSeguro + seguroVida + seguroIncendio;

  // 40% de los ingresos totales es el techo para TODA la deuda
  const cargaMaxima = ingresosTotales * PARAMETROS.MAX_DEUDA_RATIO;
  // Cuánto queda disponible para la cuota hipotecaria después de obligaciones existentes
  const cuotaMaxima = Math.max(0, cargaMaxima - obligacionesMensuales);
  // Carga financiera total del prospecto
  const cargaTotal = cuotaTotal + obligacionesMensuales;

  const ltv = montoSolicitado / valorInmueble;

  // Ingreso mínimo requerido: ingresos totales que hacen que carga ≤ 40%
  const ingresosTotalesMinimos = cargaTotal / PARAMETROS.MAX_DEUDA_RATIO;
  const ingresoMinimoRequerido = Math.max(0, ingresosTotalesMinimos - otrosIngresos);

  const { score: scoreInterno, detalle: detalleScore } = calcScoreInterno({
    cargaTotal,
    ingresosTotales,
    ltv,
    scoreCredito,
    documentacion,
    reportesNegativos,
  });

  const { viabilidad, factores: factoresClasificacion } = clasificarViabilidad({
    cuotaTotal,
    cuotaMaxima,
    cargaTotal,
    cargaMaxima,
    ltv,
    scoreCredito,
    documentacion,
    reportesNegativos,
  });

  return {
    tasa_mv: tasaMV,
    cuota_sin_seguro: cuotaSinSeguro,
    seguro_vida: seguroVida,
    seguro_incendio: seguroIncendio,
    cuota_total: cuotaTotal,
    cuota_maxima: cuotaMaxima,       // disponible para hipoteca (descontadas obligaciones)
    carga_maxima: cargaMaxima,       // 40% de ingresos totales
    carga_total: cargaTotal,         // cuota hipoteca + obligaciones existentes
    ltv,
    ingreso_minimo_requerido: ingresoMinimoRequerido,
    score_interno: scoreInterno,
    detalle_score: detalleScore,
    viabilidad,
    factores_clasificacion: factoresClasificacion,
  };
}

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

module.exports = { calcularPreEvaluacion, PARAMETROS, formatCOP };
