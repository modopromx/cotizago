import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Save, CreditCard, Bell, CheckCircle2, Copy, ShieldCheck, Eye, EyeOff, ExternalLink, MessageCircle } from 'lucide-react'

type Tab = 'pagos' | 'notificaciones' | 'whatsapp'

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`

// Los eventos que stripe-webhook procesa de verdad. Si falta alguno, esa parte
// del cobro deja de funcionar en silencio: Stripe simplemente no lo avisa.
const EVENTOS_STRIPE: Array<[string, string]> = [
  ['checkout.session.completed', 'alta de folios y de módulos'],
  ['invoice.payment_succeeded', 'renovación mensual cobrada'],
  ['invoice.payment_failed', 'tarjeta rechazada'],
  ['customer.subscription.updated', 'cambio de estado o cancelación programada'],
  ['customer.subscription.deleted', 'baja definitiva'],
]
const WALINKER_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/walinker-webhook`

// IMPORTANTE: estos componentes viven FUERA del render del padre. Si se definen
// dentro, React los recrea en cada tecla y el input pierde el foco (no se puede
// escribir una llave completa).
function Estado({ pista }: { pista?: string }) {
  return pista
    ? <span className="inline-flex items-center gap-1 text-xs text-success-600"><CheckCircle2 className="w-3.5 h-3.5" /> Guardada</span>
    : <span className="text-xs text-amber-600">Sin configurar</span>
}

function CampoSecreto({ label, ph, valor, pista, visible, onToggle, onChange }: {
  label: string; ph: string; valor: string; pista?: string
  visible: boolean; onToggle: () => void; onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between"><label className="label mb-0">{label}</label><Estado pista={pista} /></div>
      <div className="relative mt-1">
        <input type={visible ? 'text' : 'password'} className="input pr-10"
          placeholder={pista ? pista : ph}
          value={valor} onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {pista && !valor && (
        <p className="text-[11px] text-success-700 mt-1">
          Guardada como <code className="font-mono">{pista}</code>. Sigue activa — escribe una nueva solo si quieres reemplazarla.
        </p>
      )}
    </div>
  )
}

export default function AdminConfigPage() {
  const [tab, setTab] = useState<Tab>('pagos')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<Record<string, string>>({})
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
    setEstado((est.data as Record<string, string>) ?? {})
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Guarda un valor NO secreto. Lanza si falla, para que el usuario lo vea.
  const saveConfig = async (clave: string, valor: string) => {
    const { error } = await supabase.from('config_plataforma')
      .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
    if (error) throw new Error(`${clave}: ${error.message}`)
  }
  // Guarda un secreto vía función de servidor (la tabla no es escribible por API).
  const saveSecreto = async (clave: string) => {
    const v = secretos[clave]
    if (!v) return
    const { error } = await supabase.rpc('guardar_secreto', { p_clave: clave, p_valor: v })
    if (error) throw new Error(`${clave}: ${error.message}`)
  }

  const guardarPagos = async () => {
    const m = modo                       // 'test' | 'live' — el juego que se está editando
    const kPk = `stripe_${m}_publishable_key`
    const kSk = `stripe_${m}_secret_key`
    const kWh = `stripe_${m}_webhook_secret`
    const esperado = m === 'test' ? 'test' : 'live'

    const pk = (config[kPk] ?? '').trim()
    const sk = (secretos[kSk] ?? '').trim()
    const wh = (secretos[kWh] ?? '').trim()

    // La llave pública se expone al navegador: nunca debe contener una secreta.
    if (pk.startsWith('sk_') || pk.startsWith('rk_')) {
      toast.error('Esa es tu llave SECRETA. La pública empieza con pk_ — aquí quedaría expuesta.', { duration: 8000 })
      return
    }
    if (pk && !pk.startsWith('pk_')) { toast.error('La llave pública debe empezar con pk_'); return }
    if (sk && !(sk.startsWith('sk_') || sk.startsWith('rk_'))) { toast.error('La llave secreta debe empezar con sk_'); return }
    if (wh && !wh.startsWith('whsec_')) { toast.error('El secreto de webhook debe empezar con whsec_'); return }
    // Evitar mezclar juegos (pegar llaves live en el slot de prueba o viceversa).
    if (pk && !pk.includes(`_${esperado}_`)) { toast.error(`Estás en modo ${m === 'test' ? 'Prueba' : 'Producción'}: la llave pública debe ser pk_${esperado}_...`); return }
    if (sk && !sk.includes(`_${esperado}_`)) { toast.error(`Estás en modo ${m === 'test' ? 'Prueba' : 'Producción'}: la llave secreta debe ser sk_${esperado}_...`); return }

    setSaving(true)
    try {
      await saveConfig(kPk, pk)
      await saveConfig('stripe_habilitado', config.stripe_habilitado ?? 'false')
      await saveConfig('stripe_modo', m)
      await saveSecreto(kSk)
      await saveSecreto(kWh)
      setSecretos(s => ({ ...s, [kSk]: '', [kWh]: '' }))
      toast.success(`Credenciales de ${m === 'test' ? 'Prueba' : 'Producción'} guardadas`)
      await load()
    } catch (e: any) { toast.error(e?.message ?? 'Error al guardar') }
    setSaving(false)
  }

  const guardarNotif = async () => {
    setSaving(true)
    try {
      await saveConfig('smtp_host', config.smtp_host ?? '')
      await saveConfig('smtp_port', config.smtp_port ?? '587')
      await saveConfig('smtp_from', config.smtp_from ?? '')
      await saveConfig('smtp_from_nombre', config.smtp_from_nombre ?? '')
      await saveConfig('email_limite_dia_default', config.email_limite_dia_default ?? '50')
      await saveSecreto('smtp_password')
      await saveSecreto('resend_api_key')
      setSecretos(s => ({ ...s, smtp_password: '', resend_api_key: '' }))
      toast.success('Configuración de notificaciones guardada')
      await load()
    } catch (e: any) { toast.error(e?.message ?? 'Error al guardar') }
    setSaving(false)
  }

  const guardarWhatsApp = async () => {
    setSaving(true)
    try {
      await saveConfig('walinker_habilitado', config.walinker_habilitado ?? 'false')
      await saveConfig('walinker_tipo_link', config.walinker_tipo_link ?? 'brand')
      await saveSecreto('walinker_api_key')
      await saveSecreto('walinker_webhook_token')
      setSecretos(s => ({ ...s, walinker_api_key: '', walinker_webhook_token: '' }))
      toast.success('Integración de WhatsApp guardada')
      await load()
    } catch (e: any) { toast.error(e?.message ?? 'Error al guardar') }
    setSaving(false)
  }

  const setCfg = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setConfig(c => ({ ...c, [k]: e.target.value }))
  const setSec = (k: string, v: string) => setSecretos(s => ({ ...s, [k]: v }))
  const toggleVer = (k: string) => setVer(v => ({ ...v, [k]: !v[k] }))

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'pagos', label: 'Pagos (Stripe)', icon: CreditCard },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
    { id: 'whatsapp', label: 'WhatsApp (Walinker)', icon: MessageCircle },
  ]
  const habilitado = config.stripe_habilitado === 'true'
  // Juego de credenciales que se está viendo/editando y que se usará para cobrar.
  const modo: 'test' | 'live' = (config.stripe_modo ?? 'test') === 'live' ? 'live' : 'test'
  const modoPrueba = modo === 'test'
  const kPk = `stripe_${modo}_publishable_key`
  const kSk = `stripe_${modo}_secret_key`
  const kWh = `stripe_${modo}_webhook_secret`
  const listo = (m: string) => !!config[`stripe_${m}_publishable_key`] && !!estado[`stripe_${m}_secret_key`] && !!estado[`stripe_${m}_webhook_secret`]
  const configurado = listo(modo)

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Configuración global</h1>
        <p className="text-slate-500 text-sm">Credenciales e integraciones de la plataforma.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary-50 border border-primary-100 p-3">
        <ShieldCheck className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
        <p className="text-xs text-primary-800">Las llaves secretas se guardan en una bóveda que <strong>solo las funciones de servidor pueden leer</strong>. Ni este panel puede mostrarlas de vuelta — únicamente si están configuradas.</p>
      </div>

      <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pagos' && (
        <div className="card overflow-hidden">
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

            {/* Selector de juego de credenciales: cada modo guarda las suyas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex">
                {(['test', 'live'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setConfig(c => ({ ...c, stripe_modo: m }))}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${modo === m ? 'border-primary-500 bg-primary-50/50 text-navy-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <span className="flex items-center justify-center gap-2">
                      {m === 'test' ? 'Prueba (sandbox)' : 'Producción'}
                      {listo(m)
                        ? <span className="badge bg-success-50 text-success-600 text-[10px]">Lista</span>
                        : <span className="badge bg-slate-100 text-slate-400 text-[10px]">Vacía</span>}
                    </span>
                  </button>
                ))}
              </div>
              <p className="px-4 py-2.5 text-xs text-slate-500 bg-fondo">
                Cada modo guarda <strong>sus propias credenciales</strong>. El modo seleccionado es el que se usa para cobrar:
                actualmente <strong className={modoPrueba ? 'text-amber-600' : 'text-primary-600'}>{modoPrueba ? 'Prueba — no se cobra dinero real' : 'Producción — se cobra de verdad'}</strong>.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Llave pública (publishable)</label>
                <input className="input" placeholder={`pk_${modo}_...`} autoComplete="off" spellCheck={false}
                  value={config[kPk] ?? ''} onChange={setCfg(kPk)} />
              </div>
              <CampoSecreto label="Llave secreta" ph={`sk_${modo}_...`}
                valor={secretos[kSk] ?? ''} pista={estado[kSk]}
                visible={!!ver[kSk]} onToggle={() => toggleVer(kSk)}
                onChange={v => setSec(kSk, v)} />
            </div>

            <CampoSecreto label="Secreto de webhook (whsec)" ph="whsec_..."
              valor={secretos[kWh] ?? ''} pista={estado[kWh]}
              visible={!!ver[kWh]} onToggle={() => toggleVer(kWh)}
              onChange={v => setSec(kWh, v)} />

            {!modoPrueba && !listo('live') && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                Estás en <strong>Producción</strong> pero aún faltan credenciales de producción. Hasta completarlas no se podrá cobrar.
              </p>
            )}

            <div className="rounded-xl bg-fondo p-4 space-y-2">
              <p className="text-sm font-medium text-navy-900">Endpoint del webhook</p>
              <p className="text-xs text-slate-500">
                En Stripe: Developers → Webhooks → Add endpoint. Hay que registrarlo
                <strong> en cada modo por separado</strong> (prueba y producción tienen su propio endpoint y su propio whsec).
              </p>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <code className="text-xs text-slate-600 truncate flex-1">{WEBHOOK_URL}</code>
                <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('Copiado') }} className="text-slate-400 hover:text-navy-700 inline-flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" /> Copiar</button>
              </div>

              <p className="text-xs font-medium text-navy-900 pt-1">Eventos que hay que activar</p>
              <ul className="text-[11px] text-slate-500 space-y-0.5">
                {EVENTOS_STRIPE.map(([ev, para]) => (
                  <li key={ev} className="flex gap-2">
                    <code className="text-navy-700 shrink-0">{ev}</code>
                    <span className="text-slate-400">— {para}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => { navigator.clipboard.writeText(EVENTOS_STRIPE.map(e => e[0]).join('\n')); toast.success('Eventos copiados') }}
                className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copiar la lista de eventos
              </button>
              <p className="text-[11px] text-amber-600">
                No actives <code>invoice.paid</code> además de <code>invoice.payment_succeeded</code>: son equivalentes y
                registrarían el mismo cobro dos veces.
              </p>
            </div>

            <div className="flex justify-end">
              <button onClick={guardarPagos} disabled={saving} className="btn-navy">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Save className="w-4 h-4" /> Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><MessageCircle className="w-4 h-4 text-success-600" /> Walinker · links de marca</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-500">Habilitado</span>
              <button type="button" onClick={() => setConfig(c => ({ ...c, walinker_habilitado: c.walinker_habilitado === 'true' ? 'false' : 'true' }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${config.walinker_habilitado === 'true' ? 'bg-success-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.walinker_habilitado === 'true' ? 'left-5' : 'left-0.5'}`} />
              </button>
            </label>
          </div>

          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">
            Al activarlo, las cotizaciones se envían con un <strong>link corto de marca</strong> (walinker.pro/xxx) en vez del wa.me largo, y se registran los clics.
            Si Walinker falla o se acaba la cuota, <strong>se usa wa.me automáticamente</strong> — el envío nunca se bloquea.
          </p>

          <CampoSecreto label="API Key de Walinker" ph="Pega aquí tu X-Api-Key"
            valor={secretos.walinker_api_key ?? ''} pista={estado.walinker_api_key}
            visible={!!ver.walinker_api_key} onToggle={() => toggleVer('walinker_api_key')}
            onChange={v => setSec('walinker_api_key', v)} />

          <div>
            <label className="label">Tipo de link</label>
            <select className="input" value={config.walinker_tipo_link ?? 'brand'} onChange={setCfg('walinker_tipo_link')}>
              <option value="brand">De marca (walinker.pro/mi-marca)</option>
              <option value="short">Corto genérico</option>
            </select>
          </div>

          <div className="rounded-xl bg-fondo p-4 space-y-2">
            <p className="text-sm font-medium text-navy-900">Webhook para recibir eventos de Walinker</p>
            <p className="text-xs text-slate-500">Registra esta URL en Walinker (eventos <code className="text-navy-700">link.created</code>, <code className="text-navy-700">link.reused</code>, <code className="text-navy-700">link.error</code>).</p>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
              <code className="text-xs text-slate-600 truncate flex-1">{WALINKER_WEBHOOK_URL}</code>
              <button onClick={() => { navigator.clipboard.writeText(WALINKER_WEBHOOK_URL); toast.success('Copiado') }} className="text-slate-400 hover:text-navy-700 inline-flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" /> Copiar</button>
            </div>
            <CampoSecreto label="Token del webhook (opcional, recomendado)" ph="una clave que tú inventes"
              valor={secretos.walinker_webhook_token ?? ''} pista={estado.walinker_webhook_token}
              visible={!!ver.walinker_webhook_token} onToggle={() => toggleVer('walinker_webhook_token')}
              onChange={v => setSec('walinker_webhook_token', v)} />
            <p className="text-[11px] text-slate-400">Si lo defines, Walinker debe enviarlo como <code>?token=…</code> o header <code>X-Webhook-Token</code>. Sin token, el webhook acepta cualquier envío.</p>
          </div>

          <div className="flex justify-end">
            <button onClick={guardarWhatsApp} disabled={saving} className="btn-navy">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" /> Guardar integración
            </button>
          </div>
        </div>
      )}

      {tab === 'notificaciones' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-navy-900 font-semibold"><Bell className="w-4 h-4 text-primary-600" /> Email de la plataforma</div>
          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Correo COMPARTIDO con el que la plataforma envía notificaciones y cotizaciones. Las respuestas llegan al email del usuario.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Proveedor / servidor SMTP</label><input className="input" placeholder="smtp.resend.com" value={config.smtp_host ?? ''} onChange={setCfg('smtp_host')} /></div>
            <div><label className="label">Puerto</label><input className="input" value={config.smtp_port ?? '587'} onChange={setCfg('smtp_port')} /></div>
            <div><label className="label">Límite anti-spam (emails/día por cuenta)</label><input type="number" className="input" value={config.email_limite_dia_default ?? '50'} onChange={setCfg('email_limite_dia_default')} /></div>
            <div><label className="label">From (correo)</label><input className="input" placeholder="no-reply@cotizago.com" value={config.smtp_from ?? ''} onChange={setCfg('smtp_from')} /></div>
            <div><label className="label">From (nombre)</label><input className="input" value={config.smtp_from_nombre ?? 'Cotiza Go'} onChange={setCfg('smtp_from_nombre')} /></div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <CampoSecreto label="Contraseña SMTP" ph="•••" valor={secretos.smtp_password ?? ''} pista={estado.smtp_password}
              visible={!!ver.smtp_password} onToggle={() => toggleVer('smtp_password')} onChange={v => setSec('smtp_password', v)} />
            <CampoSecreto label="o API Key de Resend" ph="re_..." valor={secretos.resend_api_key ?? ''} pista={estado.resend_api_key}
              visible={!!ver.resend_api_key} onToggle={() => toggleVer('resend_api_key')} onChange={v => setSec('resend_api_key', v)} />
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
