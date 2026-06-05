import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Prospecto, Stats, Viabilidad, TipoCliente, Estado } from '../types'
import { api } from '../api'
import { StatsBar } from '../components/StatsBar'
import { ViabilityBadge } from '../components/ViabilityBadge'
import { StateBadge } from '../components/StateBadge'
import { ScoreGauge } from '../components/ScoreGauge'
import { ProspectModal } from '../components/ProspectModal'
import { formatCOP, formatPct, formatDate } from '../lib/format'

const REFRESH_MS = 30_000

export function Dashboard() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Prospecto | null>(null)
  const [filtroViabilidad, setFiltroViabilidad] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [lista, st] = await Promise.all([
        api.listarProspectos({
          viabilidad: filtroViabilidad || undefined,
          tipo_cliente: filtroCliente || undefined,
          estado: filtroEstado || undefined,
        }),
        api.stats(),
      ])
      setProspectos(lista)
      setStats(st)
      setError(null)
    } catch (e) {
      setError('No se pudo conectar con el servidor. Verifique que el backend esté corriendo.')
    } finally {
      setLoading(false)
    }
  }, [filtroViabilidad, filtroCliente, filtroEstado])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, REFRESH_MS)
    return () => clearInterval(id)
  }, [cargar])

  function handleUpdated(updated: Prospecto) {
    setProspectos(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
  }

  const ltvColor = (ltv: number) =>
    ltv <= 0.80 ? 'text-green-600' : ltv <= 0.90 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-dark text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-yellow rounded-md flex items-center justify-center font-black text-black text-sm">K</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Kreditton SAS</h1>
            <p className="text-xs text-gray-400">Sistema de Preevaluación Hipotecaria</p>
          </div>
        </div>
        <Link
          to="/nuevo"
          className="bg-brand-yellow text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors"
        >
          + Nuevo prospecto
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && <StatsBar stats={stats} />}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filtros:</span>

          <FilterGroup
            value={filtroViabilidad}
            onChange={setFiltroViabilidad}
            options={[
              { label: 'Todas', value: '' },
              { label: 'Alta', value: 'Alta' },
              { label: 'Media', value: 'Media' },
              { label: 'Baja', value: 'Baja' },
            ]}
          />

          <div className="w-px h-4 bg-gray-200" />

          <FilterGroup
            value={filtroCliente}
            onChange={setFiltroCliente}
            options={[
              { label: 'B2B + B2C', value: '' },
              { label: 'B2B', value: 'B2B' },
              { label: 'B2C', value: 'B2C' },
            ]}
          />

          <div className="w-px h-4 bg-gray-200" />

          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
          >
            <option value="">Todos los estados</option>
            <option value="nuevo">Nuevo</option>
            <option value="en_revision">En revisión</option>
            <option value="asignado">Asignado</option>
            <option value="cerrado">Cerrado</option>
          </select>

          <button
            onClick={() => cargar()}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Cargando prospectos…</div>
          ) : error ? (
            <div className="py-16 text-center text-red-500 text-sm">{error}</div>
          ) : prospectos.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No hay prospectos registrados aún.{' '}
              <Link to="/nuevo" className="text-brand-yellow font-medium hover:underline">
                Registrar el primero →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">
                    <th className="px-4 py-3">Prospecto</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">LTV</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Viabilidad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prospectos.map(p => (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelected(p)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{p.nombre_completo}</div>
                        <div className="text-xs text-gray-400 capitalize">{p.perfil_financiero}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.tipo_cliente === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {p.tipo_cliente}
                        </span>
                        {p.nombre_aliado && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-24">{p.nombre_aliado}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCOP(p.ingresos)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCOP(p.monto_solicitado)}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${ltvColor(p.ltv)}`}>
                        {formatPct(p.ltv)}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreGauge score={p.score_interno} />
                      </td>
                      <td className="px-4 py-3">
                        <ViabilityBadge viabilidad={p.viabilidad} />
                      </td>
                      <td className="px-4 py-3">
                        <StateBadge estado={p.estado} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(p.fecha_registro)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(p) }}
                          className="text-xs text-brand-yellow font-semibold hover:underline"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Actualización automática cada 30 segundos · {prospectos.length} prospecto{prospectos.length !== 1 ? 's' : ''} mostrado{prospectos.length !== 1 ? 's' : ''}
        </p>
      </main>

      {selected && (
        <ProspectModal
          prospecto={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

function FilterGroup({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-brand-dark text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
