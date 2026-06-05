/**
 * Motor de preevaluación financiera Kreditton SAS
 * Todas las reglas y umbrales están parametrizados.
 * Este módulo es puro JS (sin dependencias externas) para que
 * también pueda usarse en nodos Function de n8n.
 */

const PARAMETROS = {
  TASA_EA: 0.155,
  PLAZO_MAXIMO_MESES: 240,
  PLAZO_MINIMO_MESES: 60,
  MAX_DEUDA_RATIO: 0.40,

  // Umbrales viabilidad Alta
  ALTA_LTV_MAX: 0.80,
  ALTA_SCORE_CREDITO_MIN: 700,

  // Umbrales viabilidad Media
  MEDIA_LTV_MAX: 0.90,
  MEDIA_SCORE_CREDITO_MIN: 600,

  // Seguros (fórmulas del simulador Kreditton)
  SEGURO_VIDA_FACTOR: 1800 / 10_000_000,
  SEGURO_INCENDIO_APTO_FACTOR: (130 * 0.95) / 1_000_000,
  SEGURO_INCENDIO_CASA_FACTOR: (150 * 0.85) / 1_000_000,
};

// ── Cálculos financieros ─────────────────────────────────────────────────────

function calcTasaMV(tasaEA = PARAMETROS.TASA_EA) {
  return Math.pow(1 + tasaEA, 1 / 12) - 1;
}

function calcCuotaSinSeguro(monto, plazoMeses, tasaMV) {
  const r = tasaMV;
  return (r * monto) / (1 - Math.pow(1 + r, -plazoMeses));
}

function calcSeguroVida(monto) {
  return monto * PARAMETROS.SEGURO_VIDA_FACTOR;
}

function calcSeguroIncendio(valorInmueble, subtipo) {
  const factor =
    subtipo === 'apartamento'
      ? PARAMETROS.SEGURO_INCENDIO_APTO_FACTOR
      : PARAMETROS.SEGURO_INCENDIO_CASA_FACTOR;
  return valorInmueble * factor;
}

function calcLTV(montoSolicitado, valorInmueble) {
  return montoSolicitado / valorInmueble;
}

function calcCuotaMaxima(ingresos) {
  return ingresos * PARAMETROS.MAX_DEUDA_RATIO;
}

// ── Score interno (0–100) ────────────────────────────────────────────────────

function calcScoreInterno(params) {
  const { cuotaTotal, ingresos, ltv, scoreCredito, documentacion, reportesNegativos } = params;
  const detalle = [];
  let total = 0;

  // 1. Capacidad de pago (40 pts)
  const ratio = cuotaTotal / ingresos;
  let ptsPago = 0;
  let obsPago = '';
  if (ratio <= 0.25) { ptsPago = 40; obsPago = 'Excelente capacidad de pago'; }
  else if (ratio <= 0.30) { ptsPago = 35; obsPago = 'Muy buena capacidad de pago'; }
  else if (ratio <= 0.35) { ptsPago = 25; obsPago = 'Capacidad de pago moderada'; }
  else if (ratio <= 0.40) { ptsPago = 10; obsPago = 'Capacidad de pago en el límite permitido'; }
  else { ptsPago = 0; obsPago = `Cuota (${(ratio * 100).toFixed(1)}%) supera el máximo del 40% de ingresos`; }
  detalle.push({ componente: 'Capacidad de pago', puntos: ptsPago, maximo: 40, observacion: obsPago });
  total += ptsPago;

  // 2. LTV (30 pts)
  let ptsLTV = 0;
  let obsLTV = '';
  if (ltv <= 0.60) { ptsLTV = 30; obsLTV = 'LTV muy conservador'; }
  else if (ltv <= 0.70) { ptsLTV = 25; obsLTV = 'LTV conservador'; }
  else if (ltv <= 0.80) { ptsLTV = 20; obsLTV = 'LTV dentro del rango aceptable'; }
  else if (ltv <= 0.90) { ptsLTV = 10; obsLTV = 'LTV elevado'; }
  else { ptsLTV = 0; obsLTV = `LTV del ${(ltv * 100).toFixed(1)}% supera el máximo del 90%`; }
  detalle.push({ componente: 'LTV (Relación préstamo/valor)', puntos: ptsLTV, maximo: 30, observacion: obsLTV });
  total += ptsLTV;

  // 3. Score crédito externo (20 pts)
  let ptsScore = 0;
  let obsScore = '';
  if (scoreCredito >= 750) { ptsScore = 20; obsScore = 'Historial crediticio excelente'; }
  else if (scoreCredito >= 700) { ptsScore = 17; obsScore = 'Historial crediticio muy bueno'; }
  else if (scoreCredito >= 650) { ptsScore = 12; obsScore = 'Historial crediticio bueno'; }
  else if (scoreCredito >= 600) { ptsScore = 8; obsScore = 'Historial crediticio aceptable'; }
  else { ptsScore = 0; obsScore = `Score de ${scoreCredito} por debajo del mínimo requerido (600)`; }
  detalle.push({ componente: 'Score crediticio externo', puntos: ptsScore, maximo: 20, observacion: obsScore });
  total += ptsScore;

  // 4. Documentación (10 pts)
  const ptsDocs = documentacion === 'completa' ? 10 : documentacion === 'parcial' ? 5 : 0;
  const obsDocs = documentacion === 'completa' ? 'Documentación completa' : documentacion === 'parcial' ? 'Documentación parcial' : 'Documentación insuficiente';
  detalle.push({ componente: 'Documentación', puntos: ptsDocs, maximo: 10, observacion: obsDocs });
  total += ptsDocs;

  // Penalización reportes negativos (-15)
  if (reportesNegativos) {
    const penalizacion = -15;
    detalle.push({ componente: 'Penalización reportes negativos', puntos: penalizacion, maximo: 0, observacion: 'Presencia de reportes negativos en centrales de riesgo' });
    total = Math.max(0, total + penalizacion);
  }

  return { score: total, detalle };
}

// ── Clasificación de viabilidad ──────────────────────────────────────────────

function clasificarViabilidad(params) {
  const { cuotaTotal, cuotaMaxima, ltv, scoreCredito, documentacion, reportesNegativos } = params;
  const factoresBaja = [];

  if (cuotaTotal > cuotaMaxima)
    factoresBaja.push(`Cuota (${formatCOP(cuotaTotal)}) supera el máximo permitido (${formatCOP(cuotaMaxima)})`);
  if (ltv > PARAMETROS.MEDIA_LTV_MAX)
    factoresBaja.push(`LTV del ${(ltv * 100).toFixed(1)}% supera el máximo permitido del 90%`);
  if (scoreCredito < PARAMETROS.MEDIA_SCORE_CREDITO_MIN)
    factoresBaja.push(`Score crediticio de ${scoreCredito} por debajo del mínimo de ${PARAMETROS.MEDIA_SCORE_CREDITO_MIN}`);
  if (reportesNegativos)
    factoresBaja.push('Presencia de reportes negativos en centrales de riesgo');
  if (documentacion === 'incompleta')
    factoresBaja.push('Documentación incompleta impide el análisis bancario');

  if (factoresBaja.length > 0) {
    return { viabilidad: 'Baja', factores: factoresBaja };
  }

  const esAlta =
    cuotaTotal <= cuotaMaxima &&
    ltv <= PARAMETROS.ALTA_LTV_MAX &&
    scoreCredito >= PARAMETROS.ALTA_SCORE_CREDITO_MIN &&
    documentacion === 'completa' &&
    !reportesNegativos;

  if (esAlta) {
    return { viabilidad: 'Alta', factores: ['Prospecto cumple todos los criterios de alta viabilidad'] };
  }

  const factoresMedia = [];
  if (ltv > PARAMETROS.ALTA_LTV_MAX && ltv <= PARAMETROS.MEDIA_LTV_MAX)
    factoresMedia.push(`LTV del ${(ltv * 100).toFixed(1)}% requiere análisis adicional (rango 80–90%)`);
  if (scoreCredito >= PARAMETROS.MEDIA_SCORE_CREDITO_MIN && scoreCredito < PARAMETROS.ALTA_SCORE_CREDITO_MIN)
    factoresMedia.push(`Score crediticio de ${scoreCredito} en rango medio (600–699)`);
  if (documentacion === 'parcial')
    factoresMedia.push('Documentación parcial: requiere completar expediente antes de presentar al banco');

  return { viabilidad: 'Media', factores: factoresMedia };
}

// ── Función principal exportada ──────────────────────────────────────────────

function calcularPreEvaluacion(datos) {
  const {
    ingresos,
    scoreCredito,
    valorInmueble,
    montoSolicitado,
    subtipo_inmueble,
    plazoMeses,
    documentacion,
    reportesNegativos,
  } = datos;

  const tasaMV = calcTasaMV();
  const cuotaSinSeguro = calcCuotaSinSeguro(montoSolicitado, plazoMeses, tasaMV);
  const seguroVida = calcSeguroVida(montoSolicitado);
  const seguroIncendio = calcSeguroIncendio(valorInmueble, subtipo_inmueble);
  const cuotaTotal = cuotaSinSeguro + seguroVida + seguroIncendio;
  const cuotaMaxima = calcCuotaMaxima(ingresos);
  const ltv = calcLTV(montoSolicitado, valorInmueble);
  const ingresoMinimoRequerido = cuotaTotal / PARAMETROS.MAX_DEUDA_RATIO;

  const { score: scoreInterno, detalle: detalleScore } = calcScoreInterno({
    cuotaTotal,
    ingresos,
    ltv,
    scoreCredito,
    documentacion,
    reportesNegativos,
  });

  const { viabilidad, factores: factoresClasificacion } = clasificarViabilidad({
    cuotaTotal,
    cuotaMaxima,
    ltv,
    scoreCredito,
    documentacion,
    reportesNegativos,
  });

  return {
    // Financiero
    tasa_mv: tasaMV,
    cuota_sin_seguro: cuotaSinSeguro,
    seguro_vida: seguroVida,
    seguro_incendio: seguroIncendio,
    cuota_total: cuotaTotal,
    cuota_maxima: cuotaMaxima,
    ltv,
    ingreso_minimo_requerido: ingresoMinimoRequerido,
    // Scoring
    score_interno: scoreInterno,
    detalle_score: detalleScore,
    // Clasificación
    viabilidad,
    factores_clasificacion: factoresClasificacion,
  };
}

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
}

module.exports = { calcularPreEvaluacion, PARAMETROS, formatCOP };
