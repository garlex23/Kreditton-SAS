import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { ProspectoInput } from '../types'
import { api } from '../api'
import { calcPreview } from '../lib/scoring'
import { formatCOP, formatPct } from '../lib/format'

const INITIAL: ProspectoInput = {
  tipo_cliente: 'B2C',
  nombre_aliado: '',
  tipo_documento: 'CC',
  numero_documento: '',
  nombre_completo: '',
  telefono: '',
  email: '',
  perfil_financiero: 'empleado',
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
}

export function NewProspect() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProspectoInput>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = calcPreview({
    ingresos: form.ingresos,
    valorInmueble: form.valor_inmueble,
    montoSolicitado: form.monto_solicitado,
    subtipo: form.subtipo_inmueble,
    plazoMeses: form.plazo_meses,
  })

  function set(field: keyof ProspectoInput, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload: ProspectoInput = {
        ...form,
        ingresos: Number(form.ingresos),
        score_credito: Number(form.score_credito),
        valor_inmueble: Number(form.valor_inmueble),
        monto_solicitado: Number(form.monto_solicitado),
        plazo_meses: Number(form.plazo_meses),
      }
      await api.crearProspecto(payload)
      navigate('/', { state: { success: true } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el prospecto')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-dark text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link to="/" className="text-gray-400 hover:text-white text-xl">←</Link>
        <div>
          <h1 className="font-bold text-lg leading-tight">Nuevo Prospecto</h1>
          <p className="text-xs text-gray-400">Registro y preevaluación hipotecaria</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Formulario (2/3) */}
          <div className="lg:col-span-2 space-y-5">

            {/* 1. Origen */}
            <Card title="1. Origen del prospecto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de cliente</Label>
                  <select value={form.tipo_cliente} onChange={e => set('tipo_cliente', e.target.value as 'B2B' | 'B2C')} className={SELECT}>
                    <option value="B2C">B2C — Cliente directo</option>
                    <option value="B2B">B2B — A través de aliado/constructora</option>
                  </select>
                </div>
                {form.tipo_cliente === 'B2B' && (
                  <div>
                    <Label required>Nombre del aliado / constructora</Label>
                    <input value={form.nombre_aliado} onChange={e => set('nombre_aliado', e.target.value)} className={INPUT} placeholder="Ej: Constructora Bolívar" required />
                  </div>
                )}
              </div>
            </Card>

            {/* 2. Datos personales */}
            <Card title="2. Datos personales">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Tipo de documento</Label>
                  <select value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)} className={SELECT}>
                    <option value="CC">Cédula de ciudadanía (CC)</option>
                    <option value="CE">Cédula de extranjería (CE)</option>
                    <option value="PA">Pasaporte (PA)</option>
                  </select>
                </div>
                <div>
                  <Label required>Número de documento</Label>
                  <input value={form.numero_documento} onChange={e => set('numero_documento', e.target.value)} className={INPUT} placeholder="1234567890" required />
                </div>
                <div className="sm:col-span-2">
                  <Label required>Nombre completo</Label>
                  <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} className={INPUT} placeholder="Nombre y apellidos" required />
                </div>
                <div>
                  <Label required>Teléfono</Label>
                  <input value={form.telefono} onChange={e => set('telefono', e.target.value)} className={INPUT} placeholder="+57 300 000 0000" required />
                </div>
                <div>
                  <Label required>Correo electrónico</Label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={INPUT} placeholder="correo@ejemplo.com" required />
                </div>
              </div>
            </Card>

            {/* 3. Perfil financiero */}
            <Card title="3. Perfil financiero">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Perfil laboral</Label>
                  <select value={form.perfil_financiero} onChange={e => set('perfil_financiero', e.target.value)} className={SELECT}>
                    <option value="empleado">Empleado</option>
                    <option value="independiente">Independiente</option>
                    <option value="pensionado">Pensionado</option>
                  </select>
                </div>
                <div>
                  <Label required>Ingresos mensuales (COP)</Label>
                  <input
                    type="number" min="0" step="100000"
                    value={form.ingresos || ''}
                    onChange={e => set('ingresos', Number(e.target.value))}
                    className={INPUT} placeholder="8000000" required
                  />
                </div>
                <div>
                  <Label required>Score crediticio (Datacrédito/TransUnion)</Label>
                  <input
                    type="number" min="300" max="900"
                    value={form.score_credito || ''}
                    onChange={e => set('score_credito', Number(e.target.value))}
                    className={INPUT} placeholder="650" required
                  />
                  <p className="text-xs text-gray-400 mt-1">Rango válido: 300 – 900</p>
                </div>
                <div className="flex items-start gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="reportes"
                    checked={form.reportes_negativos}
                    onChange={e => set('reportes_negativos', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-red-500"
                  />
                  <label htmlFor="reportes" className="text-sm text-gray-700 cursor-pointer">
                    Tiene reportes negativos en centrales de riesgo
                  </label>
                </div>
              </div>
            </Card>

            {/* 4. Datos del crédito */}
            <Card title="4. Datos del crédito">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Valor del inmueble (COP)</Label>
                  <input
                    type="number" min="0" step="1000000"
                    value={form.valor_inmueble || ''}
                    onChange={e => set('valor_inmueble', Number(e.target.value))}
                    className={INPUT} placeholder="400000000" required
                  />
                </div>
                <div>
                  <Label required>Monto solicitado (COP)</Label>
                  <input
                    type="number" min="0" step="1000000"
                    value={form.monto_solicitado || ''}
                    onChange={e => set('monto_solicitado', Number(e.target.value))}
                    className={INPUT} placeholder="280000000" required
                  />
                </div>
                <div>
                  <Label required>Tipo de inmueble</Label>
                  <select value={form.tipo_inmueble} onChange={e => set('tipo_inmueble', e.target.value)} className={SELECT}>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                  </select>
                </div>
                <div>
                  <Label required>Subtipo</Label>
                  <select value={form.subtipo_inmueble} onChange={e => set('subtipo_inmueble', e.target.value)} className={SELECT}>
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label required>Plazo: <strong>{form.plazo_meses} meses ({(form.plazo_meses / 12).toFixed(0)} años)</strong></Label>
                  <input
                    type="range" min="60" max="240" step="12"
                    value={form.plazo_meses}
                    onChange={e => set('plazo_meses', Number(e.target.value))}
                    className="w-full accent-brand-yellow"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5 años</span><span>10</span><span>15</span><span>20 años</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 5. Documentación */}
            <Card title="5. Documentación">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Estado de la documentación</Label>
                  <select value={form.documentacion} onChange={e => set('documentacion', e.target.value)} className={SELECT}>
                    <option value="completa">Completa — Todos los documentos entregados</option>
                    <option value="parcial">Parcial — Faltan algunos documentos</option>
                    <option value="incompleta">Incompleta — Sin documentación suficiente</option>
                  </select>
                </div>
                <div>
                  <Label>Observaciones (opcional)</Label>
                  <textarea
                    value={form.observaciones}
                    onChange={e => set('observaciones', e.target.value)}
                    className={INPUT + ' resize-none h-20'}
                    placeholder="Notas adicionales para el asesor..."
                  />
                </div>
              </div>
            </Card>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-dark text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Procesando preevaluación…' : 'Registrar y preevaluar →'}
            </button>
          </div>

          {/* Panel de preview (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Vista previa de cuota</h3>
                {!preview ? (
                  <p className="text-xs text-gray-400">Complete los datos del crédito para ver la estimación.</p>
                ) : (
                  <div className="space-y-3">
                    <PreviewRow label="Cuota sin seguro" value={formatCOP(preview.cuotaSinSeguro)} />
                    <PreviewRow label="Seguro de vida" value={formatCOP(preview.seguroVida)} />
                    <PreviewRow label="Seguro incendio" value={formatCOP(preview.seguroIncendio)} />
                    <div className={`rounded-lg p-3 mt-2 ${preview.excede ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      <div className="text-xs text-gray-500 mb-0.5">Cuota total estimada</div>
                      <div className={`text-xl font-bold ${preview.excede ? 'text-red-700' : 'text-green-700'}`}>
                        {formatCOP(preview.cuotaTotal)}
                      </div>
                    </div>
                    <div className={`rounded-lg p-3 ${preview.excede ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className="text-xs text-gray-500 mb-0.5">Cuota máxima (40% ingresos)</div>
                      <div className="text-lg font-semibold text-gray-700">{formatCOP(preview.cuotaMaxima)}</div>
                    </div>
                    {preview.excede && (
                      <div className="bg-red-100 text-red-700 text-xs rounded-lg px-3 py-2">
                        ⚠ La cuota supera el límite máximo. Viabilidad probable: <strong>Baja</strong>.
                      </div>
                    )}
                    <PreviewRow label="LTV estimado" value={formatPct(preview.ltv)} />
                    {preview.ltv > 0.90 && (
                      <div className="bg-red-100 text-red-700 text-xs rounded-lg px-3 py-2">
                        ⚠ LTV supera el 90%.
                      </div>
                    )}
                    {preview.ltv > 0.80 && preview.ltv <= 0.90 && (
                      <div className="bg-yellow-100 text-yellow-700 text-xs rounded-lg px-3 py-2">
                        ⚠ LTV en rango medio (80–90%).
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-brand-dark text-white rounded-xl p-4 text-xs space-y-1.5">
                <p className="font-semibold text-brand-yellow text-sm mb-2">Parámetros Kreditton</p>
                <p>Tasa E.A.: <strong>15.5%</strong></p>
                <p>Máx. endeudamiento: <strong>40% ingresos</strong></p>
                <p>Alta viabilidad: LTV ≤ 80%, score ≥ 700</p>
                <p>Media viabilidad: LTV ≤ 90%, score ≥ 600</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
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

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition'
const SELECT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow bg-white transition'
