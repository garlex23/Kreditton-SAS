import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import type { Prospecto, Evaluacion, FormularioEvaluacion, Estado } from '../types'
import { api } from '../api'
import { calcPreview } from '../lib/scoring'
import { formatCOP, formatPct, formatDate } from '../lib/format'
import { ViabilityBadge } from '../components/ViabilityBadge'
import { StateBadge } from '../components/StateBadge'
import { ScoreGauge } from '../components/ScoreGauge'

type Tab = 'expediente' | 'evaluar' | 'historial'

const EVAL_INITIAL: FormularioEvaluacion = {
  ingresos: 0,
  score_credito: 0,
  reportes_negativos: false,
  valor_inmueble: 0,
  monto_solicitado: 0,
  tipo_inmueble: 'nuevo',
  subtipo_inmueble: 'apartamento',
  plazo_meses: 180,
  documentacion: 'completa',
  observaciones: '',
  motivo_recalculo: '',
}

export function ProspectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [prospecto, setProspecto] = useState<Prospecto | null>(null)
  const [historial, setHistorial] = useState<Evaluacion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('expediente')
  const [error, setError] = useState<string | null>(null)

  // Estado para editar datos del prospecto
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Prospecto>>({})
  const [guardando, setGuardando] = useState(false)

  // Estado para el formulario de evaluación
  const [evalForm, setEvalForm] = useState<FormularioEvaluacion>(EVAL_INITIAL)
  const [evaluando, setEvaluando] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)

  // Historial expandido
  const [evalAbierta, setEvalAbierta] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    if (!id) return
    try {
      const p = await api.obtenerProspecto(Number(id))
      setProspecto(p)
      // Pre-llenar el formulario de evaluación con los últimos datos conocidos
      setEvalForm({
        ingresos: p.ingresos,
        score_credito: p.score_credito || 0,
        reportes_negativos: p.reportes_negativos || false,
        valor_inmueble: p.valor_inmueble || 0,
        monto_solicitado: p.monto_solicitado || 0,
        tipo_inmueble: p.tipo_inmueble || 'nuevo',
        subtipo_inmueble: p.subtipo_inmueble || 'apartamento',
        plazo_meses: p.plazo_meses || 180,
        documentacion: p.documentacion || 'completa',
        observaciones: p.observaciones || '',
        motivo_recalculo: '',
      })
    } catch {
      setError('No se pudo cargar el expediente.')
    } finally {
      setLoading(false)
    }
  }, [id])

  const cargarHistorial = useCallback(async () => {
    if (!id) return
    try {
      const h = await api.listarEvaluaciones(Number(id))
      setHistorial(h)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (tab === 'historial') cargarHistorial()
  }, [tab, cargarHistorial])

  // Si viene de registro nuevo, ir directo a "Evaluar"
  useEffect(() => {
    if (location.state?.nuevo) setTab('evaluar')
  }, [location.state])

  function iniciarEdicion() {
    if (!prospecto) return
    setEditForm({
      tipo_cliente: prospecto.tipo_cliente,
      nombre_aliado: prospecto.nombre_aliado || '',
      tipo_documento: prospecto.tipo_documento,
      numero_documento: prospecto.numero_documento,
      nombre_completo: prospecto.nombre_completo,
      telefono: prospecto.telefono,
      email: prospecto.email,
      perfil_financiero: prospecto.perfil_financiero,
      ingresos: prospecto.ingresos,
      estado: prospecto.estado,
      asesor_asignado: prospecto.asesor_asignado || '',
      notas_internas: prospecto.notas_internas || '',
    })
    setEditando(true)
  }

  async function guardarEdicion() {
    if (!id) return
    setGuardando(true)
    try {
      const actualizado = await api.actualizarProspecto(Number(id), editForm)
      setProspecto(actualizado)
      setEditando(false)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Error al guardar los cambios')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEvaluar(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setEvaluando(true)
    setEvalError(null)
    try {
      const actualizado = await api.evaluar(Number(id), {
        ...evalForm,
        ingresos: Number(evalForm.ingresos),
        score_credito: Number(evalForm.score_credito),
        valor_inmueble: Number(evalForm.valor_inmueble),
        monto_solicitado: Number(evalForm.monto_solicitado),
        plazo_meses: Number(evalForm.plazo_meses),
      })
      setProspecto(actualizado)
      setTab('expediente')
      await cargarHistorial()
    } catch (err: unknown) {
      const e = err as { data?: { detalles?: string[] }; message?: string }
      setEvalError(
        e.data?.detalles?.join(', ') || e.message || 'Error al procesar la evaluación'
      )
    } finally {
      setEvaluando(false)
    }
  }

  async function handleEstado(estado: Estado) {
    if (!id) return
    const actualizado = await api.actualizarEstado(Number(id), estado)
    setProspecto(actualizado)
  }

  function setEval(field: keyof FormularioEvaluacion, value: unknown) {
    setEvalForm(prev => ({ ...prev, [field]: value }))
  }

  if (loading) return <FullLoader />
  if (error || !prospecto) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-red-600">{error || 'Prospecto no encontrado'}</p>
        <Link to="/" className="text-sm text-gray-500 underline">← Volver al dashboard</Link>
      </div>
    </div>
  )

  const preview = calcPreview({
    ingresos: Number(evalForm.ingresos),
    valorInmueble: Number(evalForm.valor_inmueble),
    montoSolicitado: Number(evalForm.monto_solicitado),
    subtipo: evalForm.subtipo_inmueble,
    plazoMeses: Number(evalForm.plazo_meses),
  })

  const tieneEval = prospecto.evaluacion_activa_id !== null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-dark text-white px-6 py-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-gray-400 hover:text-white text-xl leading-none flex-shrink-0">←</Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-lg leading-tight truncate">{prospecto.nombre_completo}</h1>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${prospecto.tipo_cliente === 'B2B' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                  {prospecto.tipo_cliente}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {prospecto.tipo_documento} {prospecto.numero_documento}
                {prospecto.nombre_aliado && ` · Aliado: ${prospecto.nombre_aliado}`}
                {' · '}Registrado {formatDate(prospecto.fecha_registro)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {tieneEval && prospecto.viabilidad && (
              <ViabilityBadge viabilidad={prospecto.viabilidad} size="sm" />
            )}
            <StateBadge estado={prospecto.estado} />
          </div>
        </div>
      </header>

      {/* Si tiene evaluación activa: banner de resultado */}
      {tieneEval && prospecto.viabilidad && (
        <div className={`border-b px-6 py-3 ${
          prospecto.viabilidad === 'Alta' ? 'bg-green-50 border-green-200' :
          prospecto.viabilidad === 'Media' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="font-semibold text-gray-700">Evaluación #{prospecto.numero_evaluacion}</span>
            <span>Score: <strong>{prospecto.score_interno}/100</strong></span>
            {prospecto.cuota_total && <span>Cuota total: <strong>{formatCOP(prospecto.cuota_total)}</strong></span>}
            {prospecto.ltv && <span>LTV: <strong>{formatPct(prospecto.ltv)}</strong></span>}
            <button
              onClick={() => setTab('evaluar')}
              className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg border border-gray-400 text-gray-700 hover:bg-white transition-colors"
            >
              ↺ Recalcular viabilidad
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b bg-white px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {([
            ['expediente', 'Expediente'],
            ['evaluar', tieneEval ? 'Recalcular' : 'Preevaluar'],
            ['historial', `Historial${historial.length > 0 ? ` (${historial.length})` : ''}`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-brand-yellow text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {t === 'evaluar' && !tieneEval && (
                <span className="ml-1.5 bg-brand-yellow text-black text-xs font-bold px-1.5 py-0.5 rounded-full">!</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* ── TAB: EXPEDIENTE ─────────────────────────────────────────────────── */}
        {tab === 'expediente' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Datos del prospecto</h2>
              {!editando ? (
                <button onClick={iniciarEdicion} className={BTN_OUTLINE}>
                  ✎ Editar datos
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditando(false)} className={BTN_OUTLINE}>Cancelar</button>
                  <button onClick={guardarEdicion} disabled={guardando} className={BTN_PRIMARY}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>

            {/* Datos de identificación */}
            <Section title="Identificación y contacto">
              {editando ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <EditField label="Tipo de cliente">
                    <select value={editForm.tipo_cliente} onChange={e => setEditForm(p => ({ ...p, tipo_cliente: e.target.value as 'B2B' | 'B2C' }))} className={SELECT}>
                      <option value="B2C">B2C</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </EditField>
                  {editForm.tipo_cliente === 'B2B' && (
                    <EditField label="Aliado / Constructora">
                      <input value={editForm.nombre_aliado || ''} onChange={e => setEditForm(p => ({ ...p, nombre_aliado: e.target.value }))} className={INPUT} />
                    </EditField>
                  )}
                  <EditField label="Tipo de documento">
                    <select value={editForm.tipo_documento} onChange={e => setEditForm(p => ({ ...p, tipo_documento: e.target.value }))} className={SELECT}>
                      <option value="CC">CC</option><option value="CE">CE</option><option value="PA">PA</option>
                    </select>
                  </EditField>
                  <EditField label="Número de documento">
                    <input value={editForm.numero_documento} onChange={e => setEditForm(p => ({ ...p, numero_documento: e.target.value }))} className={INPUT} />
                  </EditField>
                  <EditField label="Nombre completo" full>
                    <input value={editForm.nombre_completo} onChange={e => setEditForm(p => ({ ...p, nombre_completo: e.target.value }))} className={INPUT} />
                  </EditField>
                  <EditField label="Teléfono">
                    <input value={editForm.telefono} onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))} className={INPUT} />
                  </EditField>
                  <EditField label="Correo electrónico">
                    <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={INPUT} />
                  </EditField>
                  <EditField label="Perfil laboral">
                    <select value={editForm.perfil_financiero} onChange={e => setEditForm(p => ({ ...p, perfil_financiero: e.target.value }))} className={SELECT}>
                      <option value="empleado">Empleado</option>
                      <option value="independiente">Independiente</option>
                      <option value="pensionado">Pensionado</option>
                    </select>
                  </EditField>
                  <EditField label="Ingresos mensuales (COP)">
                    <input type="number" value={editForm.ingresos} onChange={e => setEditForm(p => ({ ...p, ingresos: Number(e.target.value) }))} className={INPUT} />
                  </EditField>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-8">
                  <Row label="Tipo de cliente" value={`${prospecto.tipo_cliente}${prospecto.nombre_aliado ? ` — ${prospecto.nombre_aliado}` : ''}`} />
                  <Row label="Documento" value={`${prospecto.tipo_documento} ${prospecto.numero_documento}`} />
                  <Row label="Nombre completo" value={prospecto.nombre_completo} />
                  <Row label="Teléfono" value={prospecto.telefono} />
                  <Row label="Correo" value={prospecto.email} />
                  <Row label="Perfil laboral" value={prospecto.perfil_financiero} />
                  <Row label="Ingresos mensuales" value={formatCOP(prospecto.ingresos)} />
                </div>
              )}
            </Section>

            {/* Resultado de evaluación activa */}
            {tieneEval && (
              <Section title="Evaluación activa">
                <div className="grid sm:grid-cols-2 gap-x-8">
                  <Row label="Score crédito externo" value={prospecto.score_credito ?? '—'} />
                  <Row label="Reportes negativos" value={prospecto.reportes_negativos ? 'Sí' : 'No'} />
                  <Row label="Documentación" value={prospecto.documentacion ?? '—'} />
                  <Row label="Valor del inmueble" value={prospecto.valor_inmueble ? formatCOP(prospecto.valor_inmueble) : '—'} />
                  <Row label="Monto solicitado" value={prospecto.monto_solicitado ? formatCOP(prospecto.monto_solicitado) : '—'} />
                  <Row label="LTV" value={prospecto.ltv ? formatPct(prospecto.ltv) : '—'} />
                  <Row label="Plazo" value={prospecto.plazo_meses ? `${prospecto.plazo_meses} meses` : '—'} />
                  <Row label="Cuota total estimada" value={prospecto.cuota_total ? formatCOP(prospecto.cuota_total) : '—'} />
                  <Row label="Cuota máxima (40%)" value={prospecto.cuota_maxima ? formatCOP(prospecto.cuota_maxima) : '—'} />
                </div>
                {prospecto.factores_clasificacion.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Factores de clasificación</p>
                    <ul className="space-y-1">
                      {prospecto.factores_clasificacion.map((f, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className={prospecto.viabilidad === 'Alta' ? 'text-green-500' : prospecto.viabilidad === 'Media' ? 'text-yellow-500' : 'text-red-500'}>●</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prospecto.diagnostico_ia && (
                  <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnóstico IA</p>
                    <p className="text-sm text-gray-700">{prospecto.diagnostico_ia}</p>
                    {prospecto.recomendacion_asesor && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Recomendación asesor</p>
                        <p className="text-sm text-gray-700">{prospecto.recomendacion_asesor}</p>
                      </>
                    )}
                  </div>
                )}
              </Section>
            )}

            {!tieneEval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-center space-y-3">
                <p className="text-sm font-semibold text-yellow-800">Este prospecto aún no ha sido evaluado</p>
                <p className="text-xs text-yellow-700">Complete los datos internos (score crediticio, monto, plazo, documentación) y ejecute la preevaluación.</p>
                <button onClick={() => setTab('evaluar')} className={BTN_PRIMARY}>
                  Ir a Preevaluar →
                </button>
              </div>
            )}

            {/* Gestión */}
            <Section title="Gestión interna">
              {editando ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <EditField label="Estado">
                    <select value={editForm.estado} onChange={e => setEditForm(p => ({ ...p, estado: e.target.value as Estado }))} className={SELECT}>
                      <option value="nuevo">Nuevo</option>
                      <option value="en_revision">En revisión</option>
                      <option value="asignado">Asignado</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </EditField>
                  <EditField label="Asesor asignado">
                    <input value={editForm.asesor_asignado || ''} onChange={e => setEditForm(p => ({ ...p, asesor_asignado: e.target.value }))} className={INPUT} placeholder="Nombre del asesor" />
                  </EditField>
                  <EditField label="Notas internas" full>
                    <textarea value={editForm.notas_internas || ''} onChange={e => setEditForm(p => ({ ...p, notas_internas: e.target.value }))} className={INPUT + ' resize-none h-20'} />
                  </EditField>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-8">
                  <Row label="Estado" value={<StateBadge estado={prospecto.estado} />} />
                  <Row label="Asesor asignado" value={prospecto.asesor_asignado || '—'} />
                  {prospecto.notas_internas && (
                    <div className="sm:col-span-2 py-1.5 border-b border-gray-100">
                      <span className="text-gray-500 text-sm block mb-0.5">Notas internas</span>
                      <span className="text-sm text-gray-900">{prospecto.notas_internas}</span>
                    </div>
                  )}
                </div>
              )}
              {!editando && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 self-center">Cambiar estado rápido:</span>
                  {(['nuevo', 'en_revision', 'asignado', 'cerrado'] as Estado[]).map(e => (
                    <button
                      key={e}
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
              )}
            </Section>
          </div>
        )}

        {/* ── TAB: PREEVALUAR / RECALCULAR ────────────────────────────────────── */}
        {tab === 'evaluar' && (
          <form onSubmit={handleEvaluar} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {tieneEval ? `Recalcular viabilidad (evaluación #${(prospecto.numero_evaluacion || 0) + 1})` : 'Primera preevaluación'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {tieneEval
                    ? 'Complete o modifique los campos y haga clic en Recalcular. Se guardará como nueva evaluación sin borrar la anterior.'
                    : 'Complete los campos internos para ejecutar la preevaluación.'}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              {/* Formulario */}
              <div className="lg:col-span-2 space-y-5">

                {/* Datos internos de Kreditton */}
                <Card title="Datos internos (Kreditton)">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <ELabel required>Score crediticio (Datacrédito/TransUnion)</ELabel>
                      <input
                        type="number" min="300" max="900"
                        value={evalForm.score_credito || ''}
                        onChange={e => setEval('score_credito', Number(e.target.value))}
                        className={INPUT} placeholder="650" required
                      />
                      <p className="text-xs text-gray-400 mt-1">Rango válido: 300 – 900</p>
                    </div>
                    <div>
                      <ELabel required>Ingresos mensuales (COP)</ELabel>
                      <input
                        type="number" min="0" step="100000"
                        value={evalForm.ingresos || ''}
                        onChange={e => setEval('ingresos', Number(e.target.value))}
                        className={INPUT} placeholder="8000000" required
                      />
                    </div>
                    <div className="flex items-start gap-3 pt-4">
                      <input
                        type="checkbox"
                        id="rep"
                        checked={evalForm.reportes_negativos}
                        onChange={e => setEval('reportes_negativos', e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-red-500"
                      />
                      <label htmlFor="rep" className="text-sm text-gray-700 cursor-pointer">
                        Tiene reportes negativos en centrales de riesgo
                      </label>
                    </div>
                    <div>
                      <ELabel required>Estado de la documentación</ELabel>
                      <select value={evalForm.documentacion} onChange={e => setEval('documentacion', e.target.value)} className={SELECT}>
                        <option value="completa">Completa — Todos los documentos entregados</option>
                        <option value="parcial">Parcial — Faltan algunos documentos</option>
                        <option value="incompleta">Incompleta — Sin documentación suficiente</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {/* Datos del crédito */}
                <Card title="Datos del crédito">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <ELabel required>Valor del inmueble (COP)</ELabel>
                      <input
                        type="number" min="0" step="1000000"
                        value={evalForm.valor_inmueble || ''}
                        onChange={e => setEval('valor_inmueble', Number(e.target.value))}
                        className={INPUT} placeholder="400000000" required
                      />
                    </div>
                    <div>
                      <ELabel required>Monto solicitado (COP)</ELabel>
                      <input
                        type="number" min="0" step="1000000"
                        value={evalForm.monto_solicitado || ''}
                        onChange={e => setEval('monto_solicitado', Number(e.target.value))}
                        className={INPUT} placeholder="280000000" required
                      />
                    </div>
                    <div>
                      <ELabel required>Tipo de inmueble</ELabel>
                      <select value={evalForm.tipo_inmueble} onChange={e => setEval('tipo_inmueble', e.target.value)} className={SELECT}>
                        <option value="nuevo">Nuevo</option>
                        <option value="usado">Usado</option>
                      </select>
                    </div>
                    <div>
                      <ELabel required>Subtipo</ELabel>
                      <select value={evalForm.subtipo_inmueble} onChange={e => setEval('subtipo_inmueble', e.target.value)} className={SELECT}>
                        <option value="apartamento">Apartamento</option>
                        <option value="casa">Casa</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <ELabel required>Plazo: <strong>{evalForm.plazo_meses} meses ({Math.round(evalForm.plazo_meses / 12)} años)</strong></ELabel>
                      <input
                        type="range" min="60" max="240" step="12"
                        value={evalForm.plazo_meses}
                        onChange={e => setEval('plazo_meses', Number(e.target.value))}
                        className="w-full accent-brand-yellow"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>5 años</span><span>10</span><span>15</span><span>20 años</span>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <ELabel>Observaciones</ELabel>
                      <textarea
                        value={evalForm.observaciones}
                        onChange={e => setEval('observaciones', e.target.value)}
                        className={INPUT + ' resize-none h-16'}
                        placeholder="Notas adicionales sobre esta evaluación…"
                      />
                    </div>
                    {tieneEval && (
                      <div className="sm:col-span-2">
                        <ELabel>Motivo del recálculo</ELabel>
                        <input
                          value={evalForm.motivo_recalculo}
                          onChange={e => setEval('motivo_recalculo', e.target.value)}
                          className={INPUT}
                          placeholder="Ej: Cliente amplió cuota inicial, nueva consulta de score…"
                        />
                      </div>
                    )}
                  </div>
                </Card>

                {evalError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{evalError}</div>
                )}

                <button
                  type="submit"
                  disabled={evaluando}
                  className="w-full bg-brand-dark text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {evaluando
                    ? 'Procesando preevaluación…'
                    : tieneEval ? '↺ Recalcular viabilidad' : 'Preevaluar →'}
                </button>
              </div>

              {/* Panel preview */}
              <div className="lg:col-span-1">
                <div className="sticky top-4 space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Vista previa de cuota</h3>
                    {!preview ? (
                      <p className="text-xs text-gray-400">Complete los datos del crédito para ver la estimación.</p>
                    ) : (
                      <div className="space-y-2">
                        <PreviewRow label="Cuota sin seguro" value={formatCOP(preview.cuotaSinSeguro)} />
                        <PreviewRow label="Seguro de vida" value={formatCOP(preview.seguroVida)} />
                        <PreviewRow label="Seguro incendio" value={formatCOP(preview.seguroIncendio)} />
                        <div className={`rounded-lg p-3 mt-1 ${preview.excede ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                          <div className="text-xs text-gray-500 mb-0.5">Cuota total estimada</div>
                          <div className={`text-xl font-bold ${preview.excede ? 'text-red-700' : 'text-green-700'}`}>{formatCOP(preview.cuotaTotal)}</div>
                        </div>
                        <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
                          <div className="text-xs text-gray-500 mb-0.5">Cuota máxima (40% ingresos)</div>
                          <div className="text-lg font-semibold text-gray-700">{formatCOP(preview.cuotaMaxima)}</div>
                        </div>
                        {preview.excede && (
                          <div className="bg-red-100 text-red-700 text-xs rounded-lg px-3 py-2">
                            ⚠ Cuota supera el límite → Viabilidad probable: <strong>Baja</strong>
                          </div>
                        )}
                        <PreviewRow label="LTV estimado" value={formatPct(preview.ltv)} />
                        {preview.ltv > 0.90 && <div className="bg-red-100 text-red-700 text-xs rounded-lg px-3 py-2">⚠ LTV supera el 90%</div>}
                        {preview.ltv > 0.80 && preview.ltv <= 0.90 && <div className="bg-yellow-100 text-yellow-700 text-xs rounded-lg px-3 py-2">⚠ LTV en rango medio (80–90%)</div>}
                      </div>
                    )}
                  </div>
                  <div className="bg-brand-dark text-white rounded-xl p-4 text-xs space-y-1.5">
                    <p className="font-semibold text-brand-yellow text-sm mb-2">Parámetros Kreditton</p>
                    <p>Tasa E.A.: <strong>15.5%</strong></p>
                    <p>Máx. endeudamiento: <strong>40% ingresos</strong></p>
                    <p>Alta: LTV ≤ 80%, score ≥ 700, docs completa</p>
                    <p>Media: LTV ≤ 90%, score ≥ 600</p>
                    <p>Baja: cualquier disqualificador</p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ── TAB: HISTORIAL ──────────────────────────────────────────────────── */}
        {tab === 'historial' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Historial de evaluaciones</h2>
            {historial.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">
                No hay evaluaciones registradas para este prospecto.
              </div>
            ) : (
              <div className="space-y-3">
                {historial.map(ev => (
                  <div key={ev.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setEvalAbierta(evalAbierta === ev.id ? null : ev.id)}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-bold text-gray-800">Evaluación #{ev.numero_evaluacion}</span>
                        {ev.viabilidad && <ViabilityBadge viabilidad={ev.viabilidad} size="sm" />}
                        <span className="text-sm text-gray-500">Score: <strong>{ev.score_interno}/100</strong></span>
                        {ev.cuota_total && <span className="text-sm text-gray-500">Cuota: <strong>{formatCOP(ev.cuota_total)}</strong></span>}
                        {ev.motivo_recalculo && (
                          <span className="text-xs text-gray-400 italic">"{ev.motivo_recalculo}"</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                        <span>{formatDate(ev.fecha_evaluacion)}</span>
                        <span>{evalAbierta === ev.id ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {evalAbierta === ev.id && (
                      <div className="border-t px-5 py-4 grid sm:grid-cols-2 gap-x-8 gap-y-0">
                        <Row label="Ingresos" value={formatCOP(ev.ingresos)} />
                        <Row label="Score crédito" value={ev.score_credito} />
                        <Row label="Reportes negativos" value={ev.reportes_negativos ? 'Sí' : 'No'} />
                        <Row label="Documentación" value={ev.documentacion} />
                        <Row label="Valor del inmueble" value={formatCOP(ev.valor_inmueble)} />
                        <Row label="Monto solicitado" value={formatCOP(ev.monto_solicitado)} />
                        <Row label="LTV" value={formatPct(ev.ltv)} />
                        <Row label="Plazo" value={`${ev.plazo_meses} meses`} />
                        <Row label="Cuota sin seguro" value={formatCOP(ev.cuota_sin_seguro)} />
                        <Row label="Seguro vida" value={formatCOP(ev.seguro_vida)} />
                        <Row label="Seguro incendio" value={formatCOP(ev.seguro_incendio)} />
                        <Row label="Cuota total" value={formatCOP(ev.cuota_total)} />
                        <Row label="Cuota máxima (40%)" value={formatCOP(ev.cuota_maxima)} />
                        <Row label="Ingreso mín. requerido" value={formatCOP(ev.ingreso_minimo_requerido)} />
                        {ev.detalle_score.length > 0 && (
                          <div className="sm:col-span-2 mt-2">
                            <ScoreDetail detalle={ev.detalle_score} score={ev.score_interno} />
                          </div>
                        )}
                        {ev.factores_clasificacion.length > 0 && (
                          <div className="sm:col-span-2 mt-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Factores</p>
                            <ul className="space-y-1">
                              {ev.factores_clasificacion.map((f, i) => (
                                <li key={i} className="text-sm text-gray-700 flex gap-2">
                                  <span className={ev.viabilidad === 'Alta' ? 'text-green-500' : ev.viabilidad === 'Media' ? 'text-yellow-500' : 'text-red-500'}>●</span>
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ev.diagnostico_ia && (
                          <div className="sm:col-span-2 mt-3 bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Diagnóstico IA</p>
                            <p className="text-sm text-gray-700">{ev.diagnostico_ia}</p>
                            {ev.recomendacion_asesor && (
                              <>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Recomendación</p>
                                <p className="text-sm text-gray-700">{ev.recomendacion_asesor}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ELabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1.5">
      {children}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}

function ScoreDetail({ detalle, score }: { detalle: { componente: string; puntos: number; maximo: number; observacion: string }[]; score: number }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Desglose score ({score}/100)</p>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <table className="w-full text-xs">
        <tbody>
          {detalle.map((d, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 pr-4 text-gray-700">{d.componente}</td>
              <td className="py-1.5 text-gray-400 pr-4">{d.observacion}</td>
              <td className={`py-1.5 text-right font-bold ${d.puntos > 0 ? 'text-green-600' : d.puntos < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {d.puntos > 0 ? `+${d.puntos}` : d.puntos}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando expediente…</p>
    </div>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition'
const SELECT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow bg-white transition'
const BTN_PRIMARY = 'bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50'
const BTN_OUTLINE = 'border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors'
