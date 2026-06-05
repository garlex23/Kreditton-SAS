import type { Prospecto, Evaluacion, FormularioExterno, FormularioEvaluacion, Stats } from './types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { data, status: res.status })
  return data as T
}

export const api = {
  stats: () => request<Stats>('/stats'),

  parametros: () => request<Record<string, number>>('/parametros'),

  // Buscar por número de documento (para detección de duplicados en tiempo real)
  buscarPorDocumento: (numero_documento: string) =>
    request<Prospecto | null>(`/prospectos/buscar?numero_documento=${encodeURIComponent(numero_documento)}`),

  listarProspectos: (filtros?: {
    viabilidad?: string
    tipo_cliente?: string
    estado?: string
    buscar?: string
    sin_evaluar?: string
  }) => {
    const params = new URLSearchParams()
    if (filtros?.viabilidad)   params.set('viabilidad', filtros.viabilidad)
    if (filtros?.tipo_cliente) params.set('tipo_cliente', filtros.tipo_cliente)
    if (filtros?.estado)       params.set('estado', filtros.estado)
    if (filtros?.buscar)       params.set('buscar', filtros.buscar)
    if (filtros?.sin_evaluar)  params.set('sin_evaluar', filtros.sin_evaluar)
    const qs = params.toString()
    return request<Prospecto[]>(`/prospectos${qs ? `?${qs}` : ''}`)
  },

  obtenerProspecto: (id: number) => request<Prospecto>(`/prospectos/${id}`),

  // Crear prospecto (formulario externo — sin evaluación)
  crearProspecto: (data: FormularioExterno) =>
    request<Prospecto>('/prospectos', { method: 'POST', body: JSON.stringify(data) }),

  // Actualizar datos del prospecto (identidad + gestión)
  actualizarProspecto: (id: number, data: Partial<Prospecto>) =>
    request<Prospecto>(`/prospectos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Crear nueva evaluación (preevaluar o recalcular)
  evaluar: (id: number, data: FormularioEvaluacion) =>
    request<Prospecto>(`/prospectos/${id}/evaluar`, { method: 'POST', body: JSON.stringify(data) }),

  // Historial de evaluaciones
  listarEvaluaciones: (id: number) =>
    request<Evaluacion[]>(`/prospectos/${id}/evaluaciones`),

  // Cambiar estado de gestión
  actualizarEstado: (id: number, estado: string, extras?: { asesor_asignado?: string; notas_internas?: string }) =>
    request<Prospecto>(`/prospectos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, ...extras }),
    }),
}
