export type Viabilidad = 'Alta' | 'Media' | 'Baja'
export type TipoCliente = 'B2B' | 'B2C'
export type Estado = 'nuevo' | 'en_revision' | 'asignado' | 'cerrado'

export interface DetalleScore {
  componente: string
  puntos: number
  maximo: number
  observacion: string
}

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
  ingresos: number
  score_credito: number
  reportes_negativos: boolean
  valor_inmueble: number
  monto_solicitado: number
  tipo_inmueble: string
  subtipo_inmueble: string
  plazo_meses: number
  documentacion: string
  observaciones: string | null
  // Calculados
  tasa_mv: number
  cuota_sin_seguro: number
  seguro_vida: number
  seguro_incendio: number
  cuota_total: number
  cuota_maxima: number
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
  // Gestión
  estado: Estado
  asesor_asignado: string | null
  notas_internas: string | null
}

export interface Stats {
  total: number
  por_viabilidad: { Alta: number; Media: number; Baja: number }
  por_estado: Record<string, number>
  por_tipo_cliente: { B2B: number; B2C: number }
}

export interface ProspectoInput {
  tipo_cliente: TipoCliente
  nombre_aliado?: string
  tipo_documento: string
  numero_documento: string
  nombre_completo: string
  telefono: string
  email: string
  perfil_financiero: string
  ingresos: number
  score_credito: number
  reportes_negativos: boolean
  valor_inmueble: number
  monto_solicitado: number
  tipo_inmueble: string
  subtipo_inmueble: string
  plazo_meses: number
  documentacion: string
  observaciones?: string
}
