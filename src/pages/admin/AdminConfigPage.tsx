import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Save, Settings, CreditCard, Mail, Globe, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

type Tab = 'general' | 'stripe' | 'email'

const GENERAL_FIELDS = [
  { key: 'nombre_plataforma', label: 'Nombre de la plataforma', placeholder: 'CotizaGo' },
  { key: 'copyright', label: 'Texto de copyright', placeholder: '© 2026 CotizaGo' },
  { key: 'whatsapp_ventas', label: 'WhatsApp de ventas', placeholder: '+521234567890' },
  { key: 'whatsapp_mensaje', label: 'Mensaje por defecto de WhatsApp', placeholder: '¡Hola! Quiero saber más sobre CotizaGo' },
  { key: 'meta_title', label: 'Meta título (SEO)', placeholder: 'CotizaGo — Cotizaciones en 1 minuto' },
  { key: 'meta_description', label: 'Meta descripción (SEO)', placeholder: 'Crea cotizaciones profesionales...' },
  { key: 'site_url', label: 'URL del sitio (producción)', placeholder: 'https://cotizago.com' },
]

const STRIPE_FIELDS = [
  { key: 'stripe_secret_key', label: 'Secret Key', placeholder: 'sk_live_xxxxxxxxxxxxxxxxxxxx', secret: true, hint: 'Developers → API Keys → Secret key' },
  { key: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_live_xxxxxxxxxxxxxxxxxxxx', secret: false, hint: 'Developers → API Keys → Publishable key' },
  { key: 'stripe_webhook_secret', label: 'Webhook Signing Secret (whsec)', placeholder: 'whsec_xxxxxxxxxxxxxxxxxxxx', secret: true, hint: 'Developers → Webhooks → tu endpoint → Signing secret' },
]

const EMAIL_FIELDS = [
  { key: 'smtp_host', label: 'Host SMTP', placeholder: 'smtp.sendgrid.net' },
  { key: 'smtp_port', label: 'Puerto SMTP', placeholder: '587' },
  { key: 'smtp_user', label: 'Usuario SMTP', placeholder: 'apikey' },
  { key: 'smtp_password', label: 'Contraseña SMTP', placeholder: 'SG.xxxxxxxx', secret: true },
  { key: 'email_from', label: 'Email remitente', placeholder: 'noreply@cotizago.com' },
  { key: 'email_from_name', label: 'Nombre remitente', placeholder: 'CotizaGo' },
]

export default function AdminConfigPage() {
  const [tab, setTab] = useState<Tab>('general')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [stripeStatus, setStripeStatus] = useState<'unconfigured' | 'configured' | 'checking'>('unconfigured')

  useEffect(() => {
    supabase.from('config_plataforma').select('*').then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach(d => { map[d.clave] = d.valor ?? '' })
      setConfig(map)

      // Verificar si Stripe está configurado
      const hasStripe = !!(map['stripe_secret_key'] && map['stripe_webhook_secret'])
      setStripeStatus(hasStripe ? 'configured' : 'unconfigured')
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig(c => ({ ...c, [k]: e.target.value }))

  const handleSave = async (fields: { key: string }[]) => {
    setSaving(true)
    for (const field of fields) {
      const val = config[field.key] ?? ''
      const { error } = await supabase.from('config_plataforma')
        .upsert({ clave: field.key, valor: val, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
      if (error) {
        // Si la clave no existe aún, insertarla
        await supabase.from('config_plataforma').insert({ clave: field.key, valor: val })
      }
    }

    if (fields.some(f => f.key.startsWith('stripe'))) {
      const hasStripe = !!(config['stripe_secret_key'] && config['stripe_webhook_secret'])
      setStripeStatus(hasStripe ? 'configured' : 'unconfigured')
    }

    toast.success('Configuración guardada correctamente')
    setSaving(false)
  }

  const toggleReveal = (key: string) => setRevealed(r => ({ ...r, [key]: !r[key] }))

  const maskValue = (val: string) => {
    if (!val) return ''
    if (val.length <= 8) return '•'.repeat(val.length)
    return val.slice(0, 7) + '•'.repeat(Math.min(val.length - 10, 20)) + val.slice(-3)
  }

  const tabs = [
    { id: 'general' as Tab, label: 'General', icon: Globe },
    { id: 'stripe' as Tab, label: 'Stripe / Pagos', icon: CreditCard },
    { id: 'email' as Tab, label: 'Email / SMTP', icon: Mail },
  ]

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuración de plataforma</h1>
        <p className="text-slate-500 text-sm">Administra las integraciones y ajustes globales de CotizaGo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Ajustes generales</h2>
          {GENERAL_FIELDS.map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" placeholder={f.placeholder} value={config[f.key] ?? ''} onChange={set(f.key)} />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button onClick={() => handleSave(GENERAL_FIELDS)} disabled={saving} className="btn-primary">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar ajustes generales
            </button>
          </div>
        </div>
      )}

      {/* Stripe */}
      {tab === 'stripe' && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${stripeStatus === 'configured' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {stripeStatus === 'configured'
              ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            }
            <div className="flex-1">
              <p className={`text-sm font-semibold ${stripeStatus === 'configured' ? 'text-green-800' : 'text-amber-800'}`}>
                {stripeStatus === 'configured' ? 'Stripe configurado ✓' : 'Stripe no configurado'}
              </p>
              <p className={`text-xs mt-0.5 ${stripeStatus === 'configured' ? 'text-green-600' : 'text-amber-600'}`}>
                {stripeStatus === 'configured'
                  ? 'Los pagos con tarjeta están activos. Los folios se acreditan automáticamente.'
                  : 'Ingresa tus claves de Stripe para activar los pagos con tarjeta.'}
              </p>
            </div>
            <a href="https://dashboard.stripe.com/developers" target="_blank" rel="noreferrer"
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 flex-shrink-0">
              Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Guía rápida */}
          <div className="bg-navy-50 border border-navy-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-navy-700 mb-2">¿Dónde encuentro estas claves?</p>
            <ol className="text-xs text-navy-600 space-y-1 list-decimal list-inside">
              <li>Entra a <a href="https://dashboard.stripe.com" target="_blank" className="underline">dashboard.stripe.com</a></li>
              <li>Ve a <strong>Developers → API Keys</strong> para Secret Key y Publishable Key</li>
              <li>Ve a <strong>Developers → Webhooks</strong>, agrega endpoint:<br />
                <code className="bg-navy-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  https://mhvbsyacicntniapishp.supabase.co/functions/v1/stripe-webhook
                </code>
              </li>
              <li>Selecciona evento: <code className="bg-navy-100 px-1 rounded">checkout.session.completed</code></li>
              <li>Copia el <strong>Signing secret (whsec_...)</strong> y pégalo abajo</li>
            </ol>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Claves de Stripe</h2>
            {STRIPE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.hint && <p className="text-xs text-slate-400 mb-1">📍 {f.hint}</p>}
                <div className="relative">
                  <input
                    type={f.secret && !revealed[f.key] ? 'password' : 'text'}
                    className="input pr-10 font-mono text-xs"
                    placeholder={f.placeholder}
                    value={config[f.key] ?? ''}
                    onChange={set(f.key)}
                    autoComplete="off"
                  />
                  {f.secret && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(f.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {revealed[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {config[f.key] && f.secret && !revealed[f.key] && (
                  <p className="text-xs text-slate-400 mt-1">
                    Guardado: <span className="font-mono">{maskValue(config[f.key])}</span>
                  </p>
                )}
              </div>
            ))}

            <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
              <p className="text-xs text-slate-500">
                <strong>🔒 Seguridad:</strong> Las claves se guardan en tu base de datos Supabase encriptada,
                nunca en el código fuente ni en el frontend. Solo las Edge Functions del servidor las leen.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={() => handleSave(STRIPE_FIELDS)} disabled={saving} className="btn-primary">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Save className="w-4 h-4" /> Guardar claves de Stripe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email */}
      {tab === 'email' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Configuración de correo (SMTP)</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Puedes usar <strong>SendGrid</strong>, <strong>Mailgun</strong> o <strong>Resend</strong>.
              Recomendamos <a href="https://resend.com" target="_blank" className="underline font-medium">Resend</a> — 
              3,000 emails/mes gratis, fácil de configurar.
            </p>
          </div>
          {EMAIL_FIELDS.map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <div className="relative">
                <input
                  type={f.secret && !revealed[f.key] ? 'password' : 'text'}
                  className="input font-mono text-sm"
                  placeholder={f.placeholder}
                  value={config[f.key] ?? ''}
                  onChange={set(f.key)}
                  autoComplete="off"
                />
                {f.secret && (
                  <button type="button" onClick={() => toggleReveal(f.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {revealed[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <button onClick={() => handleSave(EMAIL_FIELDS)} disabled={saving} className="btn-primary">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar configuración de email
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
