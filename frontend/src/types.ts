export type Viabilidad = 'Alta' | 'Media' | 'Baja'
export type TipoCliente = 'B2B' | 'B2C'
export type Estado = 'pendiente_validacion' | 'en_revision' | 'asignado' | 'cerrado'

export interface DetalleScore {
  componente: string
  puntos: number
  maximo: number
  observacion: string
}

// Evaluación individual (un cálculo de viabilidad en un momento dado)
export interface Evaluacion {
  id: number
  prospecto_id: number
  fecha_evaluacion: string
  numero_evaluacion: number
  motivo_recalculo: string | null
  // Inputs snapshot
  ingresos: number
  otros_ingresos: number
  obligaciones_mensuales: number
  score_credito: number
  reportes_negativos: boolean
  valor_inmueble: number
  monto_solicitado: number
  tipo_inmueble: string
  subtipo_inmueble: string
  plazo_meses: number
  documentacion: string
  observaciones: string | null
  // Resultados calculados
  tasa_mv: number
  cuota_sin_seguro: number
  seguro_vida: number
  seguro_incendio: number
  cuota_total: number
  cuota_maxima: number
  carga_maxima: number
  carga_total: number
  ltv: number
  ingreso_minimo_requerido: number
  // Score
  score_interno: number
  detalle_score: DetalleScore[]
  viabilidad: Viabilidad
  factores_clasificacion: string[]
  // IA
  diagnostico_ia: string | null
  recomendacion_asesor: string | null
}

// Prospecto (JOIN plano con evaluación activa para compatibilidad con lista/modal)
export interface Prospecto {
  id: number
  fecha_registro: string
  tipo_cliente: TipoCliente
  nombre_aliado: string | null
  tipo_documento: string
  numero_documento: string
  nombre_completo: string
  telefono: string
  email: string
  perfil_financiero: string
  empresa_actual: string | null
  ingresos: number
  otros_ingresos: number
  obligaciones_mensuales: number
  valor_inmueble: number | null
  monto_solicitado: number | null
  cuota_inicial_disponible: number | null
  tipo_inmueble: string | null
  subtipo_inmueble: string | null
  plazo_meses: number | null
  documentos_adjuntos: string[]
  estado: Estado
  asesor_asignado: string | null
  notas_internas: string | null
  evaluacion_activa_id: number | null
  // De la evaluación activa (null si aún no ha sido evaluado)
  eval_id: number | null
  numero_evaluacion: number | null
  fecha_evaluacion: string | null
  motivo_recalculo: string | null
  score_credito: number | null
  reportes_negativos: boolean
  documentacion: string | null
  observaciones: string | null
  tasa_mv: number | null
  cuota_sin_seguro: number | null
  seguro_vida: number | null
  seguro_incendio: number | null
  cuota_total: number | null
  cuota_maxima: number | null
  carga_maxima: number | null
  carga_total: number | null
  ltv: number | null
  ingreso_minimo_requerido: number | null
  score_interno: number | null
  detalle_score: DetalleScore[]
  viabilidad: Viabilidad | null
  factores_clasificacion: string[]
  diagnostico_ia: string | null
  recomendacion_asesor: string | null
}

export interface Stats {
  total: number
  sin_evaluar: number
  por_viabilidad: { Alta: number; Media: number; Baja: number }
  por_estado: Record<string, number>
  por_tipo_cliente: { B2B: number; B2C: number }
}

// Datos del formulario externo (cliente/aliado — equivale a lo que llena en Tally)
export interface FormularioExterno {
  tipo_cliente: TipoCliente
  nombre_aliado?: string
  tipo_documento: string
  numero_documento: string
  nombre_completo: string
  telefono: string
  email: string
  perfil_financiero: string
  empresa_actual?: string
  ingresos: number
  otros_ingresos?: number
  obligaciones_mensuales?: number
  valor_inmueble?: number
  monto_solicitado?: number
  cuota_inicial_disponible?: number
  tipo_inmueble?: string
  subtipo_inmueble?: string
  plazo_meses?: number
  documentos_adjuntos?: string[]
}

// Datos de evaluación (Kreditton interno)
export interface FormularioEvaluacion {
  ingresos: number
  otros_ingresos: number
  obligaciones_mensuales: number
  score_credito: number
  reportes_negativos: boolean
  valor_inmueble: number
  monto_solicitado: number
  tipo_inmueble: string
  subtipo_inmueble: string
  plazo_meses: number
  documentacion: string
  observaciones?: string
  motivo_recalculo?: string
}

// Mantener retrocompatibilidad (alias)
export type ProspectoInput = FormularioExterno
