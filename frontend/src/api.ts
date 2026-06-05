import type { Prospecto, ProspectoInput, Stats } from './types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

export const api = {
  stats: () => request<Stats>('/stats'),

  listarProspectos: (filtros?: { viabilidad?: string; tipo_cliente?: string; estado?: string }) => {
    const params = new URLSearchParams()
    if (filtros?.viabilidad) params.set('viabilidad', filtros.viabilidad)
    if (filtros?.tipo_cliente) params.set('tipo_cliente', filtros.tipo_cliente)
    if (filtros?.estado) params.set('estado', filtros.estado)
    const qs = params.toString()
    return request<Prospecto[]>(`/prospectos${qs ? `?${qs}` : ''}`)
  },

  obtenerProspecto: (id: number) => request<Prospecto>(`/prospectos/${id}`),

  crearProspecto: (data: ProspectoInput) =>
    request<Prospecto>('/prospectos', { method: 'POST', body: JSON.stringify(data) }),

  actualizarEstado: (id: number, estado: string, extras?: { asesor_asignado?: string; notas_internas?: string }) =>
    request<Prospecto>(`/prospectos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, ...extras }),
    }),
}
