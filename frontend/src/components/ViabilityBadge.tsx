import type { Viabilidad } from '../types'

const CONFIG: Record<Viabilidad, { bg: string; text: string; dot: string }> = {
  Alta:  { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  Media: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  Baja:  { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
}

export function ViabilityBadge({ viabilidad, size = 'sm' }: { viabilidad: Viabilidad; size?: 'sm' | 'lg' }) {
  const c = CONFIG[viabilidad]
  const padding = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${c.bg} ${c.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {viabilidad} viabilidad
    </span>
  )
}
