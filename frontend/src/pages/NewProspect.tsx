import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { FormularioExterno } from '../types'
import { api } from '../api'

const INITIAL: FormularioExterno = {
  tipo_cliente: 'B2C',
  nombre_aliado: '',
  tipo_documento: 'CC',
  numero_documento: '',
  nombre_completo: '',
  telefono: '',
  email: '',
  perfil_financiero: 'empleado',
  empresa_actual: '',
  ingresos: 0,
  otros_ingresos: 0,
  obligaciones_mensuales: 0,
  valor_inmueble: 0,
  monto_solicitado: 0,
  cuota_inicial_disponible: 0,
  tipo_inmueble: 'nuevo',
  subtipo_inmueble: 'apartamento',
  plazo_meses: 180,
  documentos_adjuntos: [],
}

const TIPOS_DOC = [
  { label: 'Cédula de ciudadanía', value: 'cedula_ciudadania' },
  { label: 'Certificado ingresos (últimos 3 meses)', value: 'certificado_ingresos' },
  { label: 'Extractos bancarios (últimos 3 meses)', value: 'extractos_bancarios' },
  { label: 'Compromiso de compraventa', value: 'compromiso_compraventa' },
]

export function NewProspect() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormularioExterno>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState<{ id: number; nombre: string } | null>(null)
  const docTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function set(field: keyof FormularioExterno, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleDoc(value: string) {
    setForm(prev => {
      const docs = prev.documentos_adjuntos || []
      return {
        ...prev,
        documentos_adjuntos: docs.includes(value)
          ? docs.filter(d => d !== value)
          : [...docs, value],
      }
    })
  }

  // Verificar duplicado en tiempo real mientras se escribe el documento
  useEffect(() => {
    setDuplicado(null)
    if (!form.numero_documento || form.numero_documento.length < 5) return
    if (docTimeout.current) clearTimeout(docTimeout.current)
    docTimeout.current = setTimeout(async () => {
      try {
        const existente = await api.buscarPorDocumento(form.numero_documento)
        if (existente) setDuplicado({ id: existente.id, nombre: existente.nombre_completo })
      } catch { /* ignore */ }
    }, 600)
    return () => { if (docTimeout.current) clearTimeout(docTimeout.current) }
  }, [form.numero_documento])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload: FormularioExterno = {
        ...form,
        ingresos: Number(form.ingresos),
        otros_ingresos: Number(form.otros_ingresos || 0),
        obligaciones_mensuales: Number(form.obligaciones_mensuales || 0),
        valor_inmueble: Number(form.valor_inmueble || 0) || undefined,
        monto_solicitado: Number(form.monto_solicitado || 0) || undefined,
        cuota_inicial_disponible: Number(form.cuota_inicial_disponible || 0) || undefined,
        plazo_meses: Number(form.plazo_meses) || undefined,
      }
      const creado = await api.crearProspecto(payload)
      navigate(`/prospectos/${creado.id}`, { state: { nuevo: true } })
    } catch (err: unknown) {
      const e = err as { data?: { error?: string; prospecto_existente?: { id: number; nombre_completo: string } }; message?: string }
      if (e.data?.error === 'duplicate' && e.data.prospecto_existente) {
        const p = e.data.prospecto_existente
        setDuplicado({ id: p.id, nombre: p.nombre_completo })
      } else {
        setError(e.data?.error || e.message || 'Error al registrar el prospecto')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-dark text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link to="/" className="text-gray-400 hover:text-white text-xl leading-none">←</Link>
        <div>
          <h1 className="font-bold text-lg leading-tight">Nuevo Prospecto</h1>
          <p className="text-xs text-gray-400">Formulario de registro — datos del cliente o aliado</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <strong>Formulario externo:</strong> capture los datos que el cliente o aliado conoce.
          El score crediticio, reportes negativos y estado de documentación se verifican internamente desde el expediente.
        </div>

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
              <input
                value={form.numero_documento}
                onChange={e => set('numero_documento', e.target.value)}
                className={INPUT}
                placeholder="1234567890"
                required
              />
              {duplicado && (
                <div className="mt-1.5 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 text-xs text-yellow-800">
                  <strong>Expediente existente:</strong> {duplicado.nombre}
                  <Link to={`/prospectos/${duplicado.id}`} className="ml-2 font-bold text-yellow-700 underline">
                    Ver expediente →
                  </Link>
                </div>
              )}
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

        {/* 3. Perfil laboral y financiero */}
        <Card title="3. Perfil laboral y financiero">
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
              <Label>Empresa / empleador actual</Label>
              <input value={form.empresa_actual} onChange={e => set('empresa_actual', e.target.value)} className={INPUT} placeholder="Nombre de la empresa" />
            </div>
            <div>
              <Label required>Ingresos mensuales principales (COP)</Label>
              <input
                type="number" min="0" step="100000"
                value={form.ingresos || ''}
                onChange={e => set('ingresos', Number(e.target.value))}
                className={INPUT}
                placeholder="8000000"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Salario neto o ingresos declarados</p>
            </div>
            <div>
              <Label>Otros ingresos mensuales (COP)</Label>
              <input
                type="number" min="0" step="100000"
                value={form.otros_ingresos || ''}
                onChange={e => set('otros_ingresos', Number(e.target.value))}
                className={INPUT}
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Arriendos, honorarios, pensiones, etc.</p>
            </div>
            <div>
              <Label>Obligaciones financieras mensuales (COP)</Label>
              <input
                type="number" min="0" step="100000"
                value={form.obligaciones_mensuales || ''}
                onChange={e => set('obligaciones_mensuales', Number(e.target.value))}
                className={INPUT}
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Cuotas de créditos, tarjetas, vehículo, etc.</p>
            </div>
          </div>
        </Card>

        {/* 4. Datos del inmueble y crédito */}
        <Card title="4. Inmueble y crédito solicitado">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Valor del inmueble (COP)</Label>
              <input
                type="number" min="0" step="1000000"
                value={form.valor_inmueble || ''}
                onChange={e => set('valor_inmueble', Number(e.target.value))}
                className={INPUT}
                placeholder="400000000"
              />
            </div>
            <div>
              <Label>Monto de crédito solicitado (COP)</Label>
              <input
                type="number" min="0" step="1000000"
                value={form.monto_solicitado || ''}
                onChange={e => set('monto_solicitado', Number(e.target.value))}
                className={INPUT}
                placeholder="280000000"
              />
            </div>
            <div>
              <Label>Cuota inicial disponible (COP)</Label>
              <input
                type="number" min="0" step="1000000"
                value={form.cuota_inicial_disponible || ''}
                onChange={e => set('cuota_inicial_disponible', Number(e.target.value))}
                className={INPUT}
                placeholder="120000000"
              />
            </div>
            <div>
              <Label>Tipo de inmueble</Label>
              <select value={form.tipo_inmueble} onChange={e => set('tipo_inmueble', e.target.value)} className={SELECT}>
                <option value="nuevo">Nuevo</option>
                <option value="usado">Usado</option>
              </select>
            </div>
            <div>
              <Label>Subtipo de inmueble</Label>
              <select value={form.subtipo_inmueble} onChange={e => set('subtipo_inmueble', e.target.value)} className={SELECT}>
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
              </select>
            </div>
            <div>
              <Label>Plazo deseado</Label>
              <select value={form.plazo_meses} onChange={e => set('plazo_meses', Number(e.target.value))} className={SELECT}>
                <option value={60}>5 años (60 meses)</option>
                <option value={120}>10 años (120 meses)</option>
                <option value={180}>15 años (180 meses)</option>
                <option value={240}>20 años (240 meses)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* 5. Documentos adjuntos */}
        <Card title="5. Documentación disponible">
          <p className="text-xs text-gray-500 mb-3">Indique qué documentos tiene disponibles para entregar:</p>
          <div className="space-y-2">
            {TIPOS_DOC.map(doc => (
              <label key={doc.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={(form.documentos_adjuntos || []).includes(doc.value)}
                  onChange={() => toggleDoc(doc.value)}
                  className="w-4 h-4 accent-brand-yellow"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{doc.label}</span>
              </label>
            ))}
          </div>
          {(form.documentos_adjuntos || []).length > 0 && (
            <p className="text-xs text-green-600 mt-3 font-medium">
              ✓ {form.documentos_adjuntos!.length} documento{form.documentos_adjuntos!.length !== 1 ? 's' : ''} indicado{form.documentos_adjuntos!.length !== 1 ? 's' : ''}
            </p>
          )}
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {duplicado ? (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-yellow-800">
              Ya existe un expediente para este documento.
            </p>
            <p className="text-sm text-yellow-700">
              Puede abrir el expediente existente y agregar una nueva evaluación de crédito desde allí.
            </p>
            <Link
              to={`/prospectos/${duplicado.id}`}
              className="inline-block bg-brand-yellow text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Abrir expediente: {duplicado.nombre} →
            </Link>
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-dark text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Registrando…' : 'Registrar prospecto →'}
          </button>
        )}
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

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent transition'
const SELECT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow bg-white transition'
