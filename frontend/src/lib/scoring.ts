// Espejo del motor de scoring del backend (para preview en tiempo real en el formulario)

const TASA_EA = 0.155
const MAX_DEUDA_RATIO = 0.40
const SEGURO_VIDA_FACTOR = 1800 / 10_000_000
const SEGURO_INCENDIO_APTO_FACTOR = (130 * 0.95) / 1_000_000
const SEGURO_INCENDIO_CASA_FACTOR = (150 * 0.85) / 1_000_000

export function calcPreview(params: {
  ingresos: number
  otrosIngresos: number
  obligacionesMensuales: number
  valorInmueble: number
  montoSolicitado: number
  subtipo: string
  plazoMeses: number
}) {
  const { ingresos, otrosIngresos, obligacionesMensuales, valorInmueble, montoSolicitado, subtipo, plazoMeses } = params
  if (!ingresos || !valorInmueble || !montoSolicitado || !plazoMeses) return null

  const ingresosTotales = ingresos + otrosIngresos
  const tasaMV = Math.pow(1 + TASA_EA, 1 / 12) - 1
  const cuotaSinSeguro = (tasaMV * montoSolicitado) / (1 - Math.pow(1 + tasaMV, -plazoMeses))
  const seguroVida = montoSolicitado * SEGURO_VIDA_FACTOR
  const seguroIncendio = valorInmueble * (subtipo === 'apartamento' ? SEGURO_INCENDIO_APTO_FACTOR : SEGURO_INCENDIO_CASA_FACTOR)
  const cuotaTotal = cuotaSinSeguro + seguroVida + seguroIncendio
  const cargaMaxima = ingresosTotales * MAX_DEUDA_RATIO
  const cuotaMaxima = Math.max(0, cargaMaxima - obligacionesMensuales)
  const cargaTotal = cuotaTotal + obligacionesMensuales
  const ltv = montoSolicitado / valorInmueble
  const excede = cargaTotal > cargaMaxima

  return { cuotaTotal, cuotaMaxima, cargaMaxima, cargaTotal, ltv, excede, cuotaSinSeguro, seguroVida, seguroIncendio }
}
