import type { Stats } from '../types'

export function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Total prospectos" value={stats.total} color="text-gray-900" bg="bg-white" />
      <StatCard label="Alta viabilidad" value={stats.por_viabilidad.Alta} color="text-green-700" bg="bg-green-50" border="border-green-200" />
      <StatCard label="Media viabilidad" value={stats.por_viabilidad.Media} color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200" />
      <StatCard label="Baja viabilidad" value={stats.por_viabilidad.Baja} color="text-red-700" bg="bg-red-50" border="border-red-200" />
    </div>
  )
}

function StatCard({ label, value, color, bg, border = 'border-gray-200' }: {
  label: string; value: number; color: string; bg: string; border?: string
}) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 shadow-sm`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
