import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Save, CreditCard, Bell, CheckCircle2, Copy, ShieldCheck, Eye, EyeOff, ExternalLink } from 'lucide-react'

type Tab = 'pagos' | 'notificaciones'

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`

export default function AdminConfigPage() {
  const [tab, setTab] = useState<Tab>('pagos')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<Record<string, boolean>>({})
  const [secretos, setSecretos] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ver, setVer] = useState<Record<string, boolean>>({})

  const load = async () => {
    const [{ data: cfg }, est] = await Promise.all([
      supabase.from('config_plataforma').select('clave,valor'),
      supabase.rpc('secretos_configurados'),
    ])
    const map: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { map[r.clave] = r.valor ?? '' })
    setConfig(map)
    setEstado((est.data as Record<string, boolean>) ?? {})
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Guarda un valor NO secreto en config_plataforma.
  const saveConfig = async (clave: string, valor: string) => {
    await supabase.from('config_plataforma').upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
  }
  // Guarda un secreto (solo si el usuario escribió algo nuevo). No se puede leer de vuelta.
  const saveSecreto = async (clave: string) => {
    const v = secretos[clave]
    if (!v) return
    const { error } = await supabase.from('plataforma_secretos').upsert({ clave, valor: v, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
    if (error) throw error
  }

  const guardarPagos = async () => {
    setSaving(true)
    try {
      // Públicas / no secretas → config_plataforma
      await Promise.all([
        saveConfig('stripe_publishable_key', config.stripe_publishable_key ?? ''),
        saveConfig('stripe_habilitado', config.stripe_habilitado ?? 'false'),
        saveConfig('stripe_modo', config.stripe_modo ?? 'test'),
      ])
      // Secretas → bóveda (solo si se escribió algo nuevo)
      await saveSecreto('stripe_secret_key')
      await saveSecreto('stripe_webhook_secret')
      setSecretos(s => ({ ...s, stripe_secret_key: '', stripe_webhook_secret: '' }))
      toast.success('Configuración de Stripe guardada')
      load()
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const guardarNotif = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveConfig('smtp_host', config.smtp_host ?? ''),
        saveConfig('smtp_port', config.smtp_port ?? '587'),
        saveConfig('smtp_from', config.smtp_from ?? ''),
        saveConfig('smtp_from_nombre', config.smtp_from_nombre ?? ''),
        saveConfig('email_limite_dia_default', config.email_limite_dia_default ?? '50'),
      ])
      await saveSecreto('smtp_password')
      await saveSecreto('resend_api_key')
      setSecretos(s => ({ ...s, smtp_password: '', resend_api_key: '' }))
      toast.success('Configuración de notificaciones guardada')
      load()
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const setCfg = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setConfig(c => ({ ...c, [k]: e.target.value }))
  const setSec = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setSecretos(s => ({ ...s, [k]: e.target.value }))

  const Estado = ({ clave }: { clave: string }) =>
    estado[clave]
      ? <span className="inline-flex items-center gap-1 text-xs text-success-600"><CheckCircle2 className="w-3.5 h-3.5" /> Configurado</span>
      : <span className="text-xs text-amber-600">Sin configurar</span>

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'pagos', label: 'Pagos (Stripe)', icon: CreditCard },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
  ]

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Configuración global</h1>
        <p className="text-slate-500 text-sm">Credenciales e integraciones de la plataforma.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary-50 border border-primary-100 p-3">
        <ShieldCheck className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
        <p className="text-xs text-primary-800">Las llaves secretas se guardan cifradas en una bóveda que <strong>solo las funciones de servidor pueden leer</strong>. Ni siquiera este panel puede mostrarlas de vuelta — únicamente si están configuradas.</p>
      </div>

      <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagos' && (() => {
        const configurado = !!estado.stripe_secret_key && !!estado.stripe_webhook_secret && !!(config.stripe_publishable_key)
        const habilitado = config.stripe_habilitado === 'true'
        const modoPrueba = (config.stripe_modo ?? 'test') === 'test'
        const SecretInput = ({ clave, label, ph }: { clave: string; label: string; ph: string }) => (
          <div>
            <div className="flex items-center justify-between"><label className="label mb-0">{label}</label><Estado clave={clave} /></div>
            <div className="relative mt-1">
              <input type={ver[clave] ? 'text' : 'password'} className="input pr-10" placeholder={ph} value={secretos[clave] ?? ''} onChange={setSec(clave)} autoComplete="off" />
              <button type="button" onClick={() => setVer(v => ({ ...v, [clave]: !v[clave] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {ver[clave] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )
        return (
          <div className="card overflow-hidden">
            {/* Encabezado del proveedor */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: '#635BFF' }}>Stripe</span>
                {configurado && <span className="badge bg-success-50 text-success-600">Activo</span>}
              </div>
              <div className="flex items-center gap-4">
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-navy-700 inline-flex items-center gap-1">Documentación <ExternalLink className="w-3 h-3" /></a>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-500">Habilitado</span>
                  <button type="button" onClick={() => setConfig(c => ({ ...c, stripe_habilitado: habilitado ? 'false' : 'true' }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${habilitado ? 'bg-success-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${habilitado ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </label>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">Tarjetas internacionales — Visa, Mastercard, AMEX y más.</p>

              {/* Modo */}
              <label className="flex items-center gap-2 text-sm text-navy-800 w-fit cursor-pointer">
                <input type="checkbox" checked={modoPrueba} onChange={e => setConfig(c => ({ ...c, stripe_modo: e.target.checked ? 'test' : 'produccion' }))} className="rounded border-slate-300" />
                Modo de prueba
                <span className={`badge ${modoPrueba ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>{modoPrueba ? 'Prueba' : 'Producción'}</span>
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Llave pública (publishable)</label>
                  <input className="input" placeholder={modoPrueba ? 'pk_test_...' : 'pk_live_...'} value={config.stripe_publishable_key ?? ''} onChange={setCfg('stripe_publishable_key')} autoComplete="off" />
                </div>
                <SecretInput clave="stripe_secret_key" label="Llave secreta" ph={modoPrueba ? 'sk_test_...' : 'sk_live_...'} />
              </div>

              <SecretInput clave="stripe_webhook_secret" label="Secreto de webhook (whsec)" ph="whsec_..." />

              {/* Webhook endpoint */}
              <div className="rounded-xl bg-fondo p-4 space-y-2">
                <p className="text-sm font-medium text-navy-900">Endpoint del webhook</p>
                <p className="text-xs text-slate-500">En Stripe: Developers → Webhooks → Add endpoint. Evento <code className="text-navy-700">checkout.session.completed</code></p>
                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <code className="text-xs text-slate-600 truncate flex-1">{WEBHOOK_URL}</code>
                  <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('Copiado') }} className="text-slate-400 hover:text-navy-700 inline-flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" /> Copiar</button>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={guardarPagos} disabled={saving} className="btn-navy">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <Save className="w-4 h-4" /> Guardar configuración
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {tab === 'notificaciones' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-navy-900 font-semibold"><Bell className="w-4 h-4 text-primary-600" /> Email de la plataforma</div>
          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Este es el correo COMPARTIDO con el que la plataforma envía notificaciones y cotizaciones (los usuarios sin módulo propio). El remitente sale de aquí; las respuestas llegan al email del usuario.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Proveedor / servidor SMTP</label><input className="input" placeholder="smtp.resend.com" value={config.smtp_host ?? ''} onChange={setCfg('smtp_host')} /></div>
            <div><label className="label">Puerto</label><input className="input" value={config.smtp_port ?? '587'} onChange={setCfg('smtp_port')} /></div>
            <div><label className="label">Límite anti-spam (emails/día por cuenta)</label><input type="number" className="input" value={config.email_limite_dia_default ?? '50'} onChange={setCfg('email_limite_dia_default')} /></div>
            <div><label className="label">From (correo)</label><input className="input" placeholder="no-reply@cotizago.com" value={config.smtp_from ?? ''} onChange={setCfg('smtp_from')} /></div>
            <div><label className="label">From (nombre)</label><input className="input" value={config.smtp_from_nombre ?? 'Cotiza Go'} onChange={setCfg('smtp_from_nombre')} /></div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <div className="flex items-center justify-between"><label className="label mb-0">Contraseña SMTP</label><Estado clave="smtp_password" /></div>
              <input type="password" className="input mt-1" placeholder="•••" value={secretos.smtp_password ?? ''} onChange={setSec('smtp_password')} autoComplete="off" />
            </div>
            <div>
              <div className="flex items-center justify-between"><label className="label mb-0">o API Key de Resend</label><Estado clave="resend_api_key" /></div>
              <input type="password" className="input mt-1" placeholder="re_..." value={secretos.resend_api_key ?? ''} onChange={setSec('resend_api_key')} autoComplete="off" />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={guardarNotif} disabled={saving} className="btn-navy">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar configuración
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
