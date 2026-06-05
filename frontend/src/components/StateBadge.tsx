import type { Estado } from '../types'

const CONFIG: Record<Estado, { bg: string; text: string; label: string }> = {
  nuevo:       { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Nuevo' },
  en_revision: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En revisión' },
  asignado:    { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Asignado' },
  cerrado:     { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cerrado' },
}

export function StateBadge({ estado }: { estado: Estado }) {
  const c = CONFIG[estado] ?? CONFIG.nuevo
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
