import { useState } from 'react'
import type { Prospecto, Estado } from '../types'
import { ViabilityBadge } from './ViabilityBadge'
import { StateBadge } from './StateBadge'
import { formatCOP, formatPct, formatDate } from '../lib/format'
import { api } from '../api'

interface Props {
  prospecto: Prospecto
  onClose: () => void
  onUpdated: (p: Prospecto) => void
}

export function ProspectModal({ prospecto: initial, onClose, onUpdated }: Props) {
  const [prospecto, setProspecto] = useState(initial)
  const [tab, setTab] = useState<'resumen' | 'score' | 'ia'>('resumen')
  const [saving, setSaving] = useState(false)

  async function handleEstado(estado: Estado) {
    setSaving(true)
    try {
      const updated = await api.actualizarEstado(prospecto.id, estado)
      setProspecto(updated)
      onUpdated(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-brand-dark text-white px-6 py-4 rounded-t-2xl flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold">{prospecto.nombre_completo}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${prospecto.tipo_cliente === 'B2B' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                {prospecto.tipo_cliente}
              </span>
            </div>
            {prospecto.nombre_aliado && (
              <p className="text-xs text-gray-400 mt-0.5">Aliado: {prospecto.nombre_aliado}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formatDate(prospecto.fecha_registro)} · {prospecto.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none mt-0.5">✕</button>
        </div>

        {/* Viabilidad banner */}
        <div className={`px-6 py-3 flex items-center justify-between ${
          prospecto.viabilidad === 'Alta' ? 'bg-green-50 border-b border-green-200' :
          prospecto.viabilidad === 'Media' ? 'bg-yellow-50 border-b border-yellow-200' :
          'bg-red-50 border-b border-red-200'
        }`}>
          <ViabilityBadge viabilidad={prospecto.viabilidad} size="lg" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Score: <strong>{prospecto.score_interno}/100</strong></span>
            <StateBadge estado={prospecto.estado} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 gap-1">
          {(['resumen', 'score', 'ia'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-brand-yellow text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'resumen' ? 'Resumen financiero' : t === 'score' ? 'Detalle score' : 'Diagnóstico IA'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {tab === 'resumen' && <TabResumen p={prospecto} />}
          {tab === 'score' && <TabScore p={prospecto} />}
          {tab === 'ia' && <TabIA p={prospecto} />}
        </div>

        {/* Footer: estado change */}
        <div className="border-t px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Cambiar estado:</span>
            {(['nuevo', 'en_revision', 'asignado', 'cerrado'] as Estado[]).map(e => (
              <button
                key={e}
                disabled={saving || prospecto.estado === e}
                onClick={() => handleEstado(e)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  prospecto.estado === e
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {e.replace('_', ' ')}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

function TabResumen({ p }: { p: Prospecto }) {
  return (
    <div className="space-y-5">
      <Section title="Datos del prospecto">
        <Row label="Documento" value={`${p.tipo_documento} ${p.numero_documento}`} />
        <Row label="Perfil financiero" value={p.perfil_financiero} />
        <Row label="Ingresos mensuales" value={formatCOP(p.ingresos)} />
        <Row label="Score crédito externo" value={p.score_credito} />
        <Row label="Reportes negativos" value={p.reportes_negativos ? 'Sí' : 'No'} />
        <Row label="Documentación" value={p.documentacion} />
      </Section>
      <Section title="Crédito solicitado">
        <Row label="Valor del inmueble" value={formatCOP(p.valor_inmueble)} />
        <Row label="Monto solicitado" value={formatCOP(p.monto_solicitado)} />
        <Row label="LTV" value={formatPct(p.ltv)} />
        <Row label="Plazo" value={`${p.plazo_meses} meses (${(p.plazo_meses / 12).toFixed(0)} años)`} />
        <Row label="Tipo de inmueble" value={`${p.tipo_inmueble} – ${p.subtipo_inmueble}`} />
      </Section>
      <Section title="Cuota estimada">
        <Row label="Cuota sin seguro" value={formatCOP(p.cuota_sin_seguro)} />
        <Row label="Seguro de vida" value={formatCOP(p.seguro_vida)} />
        <Row label="Seguro incendio/terremoto" value={formatCOP(p.seguro_incendio)} />
        <Row label="CUOTA TOTAL" value={formatCOP(p.cuota_total)} />
        <Row label="Cuota máxima permitida (40%)" value={formatCOP(p.cuota_maxima)} />
        <Row label="Ingreso mínimo requerido" value={formatCOP(p.ingreso_minimo_requerido)} />
      </Section>
      {p.factores_clasificacion.length > 0 && (
        <Section title="Factores de clasificación">
          <ul className="space-y-1 mt-1">
            {p.factores_clasificacion.map((f, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className={p.viabilidad === 'Alta' ? 'text-green-500' : p.viabilidad === 'Media' ? 'text-yellow-500' : 'text-red-500'}>●</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function TabScore({ p }: { p: Prospecto }) {
  const total = p.detalle_score.reduce((s, d) => s + (d.maximo > 0 ? d.maximo : 0), 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Score interno Kreditton</h3>
        <div className="text-3xl font-bold">{p.score_interno}<span className="text-base font-normal text-gray-400">/100</span></div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-5">
        <div
          className={`h-2.5 rounded-full ${p.score_interno >= 70 ? 'bg-green-500' : p.score_interno >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${p.score_interno}%` }}
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b">
            <th className="pb-2 font-medium">Componente</th>
            <th className="pb-2 font-medium text-right">Puntos</th>
            <th className="pb-2 font-medium text-right">Máx.</th>
          </tr>
        </thead>
        <tbody>
          {p.detalle_score.map((d, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2.5 pr-4">
                <div className="font-medium text-gray-900">{d.componente}</div>
                <div className="text-xs text-gray-400 mt-0.5">{d.observacion}</div>
              </td>
              <td className={`py-2.5 text-right font-bold ${d.puntos > 0 ? 'text-green-600' : d.puntos < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {d.puntos > 0 ? `+${d.puntos}` : d.puntos}
              </td>
              <td className="py-2.5 text-right text-gray-400">{d.maximo > 0 ? d.maximo : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-bold text-gray-900">TOTAL</td>
            <td className="pt-3 text-right font-bold text-gray-900">{p.score_interno}</td>
            <td className="pt-3 text-right text-gray-400">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function TabIA({ p }: { p: Prospecto }) {
  if (!p.diagnostico_ia) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-4xl mb-3">🤖</p>
        <p className="text-sm">No hay diagnóstico IA disponible.</p>
        <p className="text-xs mt-1">Configure ANTHROPIC_API_KEY en el backend para activarlo.</p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <Section title="Diagnóstico financiero">
        <p className="text-sm text-gray-700 leading-relaxed">{p.diagnostico_ia}</p>
      </Section>
      {p.recomendacion_asesor && (
        <Section title="Recomendación para el asesor comercial">
          <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-lg p-3">
            <p className="text-sm text-gray-800 leading-relaxed">{p.recomendacion_asesor}</p>
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</h4>
      {children}
    </div>
  )
}
