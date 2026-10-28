import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Save, CreditCard, Bell, CheckCircle2, Copy, ShieldCheck, Eye, EyeOff, ExternalLink, MessageCircle } from 'lucide-react'

type Tab = 'pagos' | 'notificaciones' | 'whatsapp'

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`

// Los eventos que stripe-webhook procesa de verdad. Si falta alguno, esa parte
// del cobro deja de funcionar en silencio: Stripe simplemente no lo avisa.
// El segundo valor es la clave i18n de su descripción.
const EVENTOS_STRIPE: Array<[string, string]> = [
  ['checkout.session.completed', 'adm.cfg.evCheckout'],
  ['invoice.payment_succeeded', 'adm.cfg.evRenovacion'],
  ['invoice.payment_failed', 'adm.cfg.evRechazada'],
  ['customer.subscription.updated', 'adm.cfg.evCambio'],
  ['customer.subscription.deleted', 'adm.cfg.evBaja'],
]
const WALINKER_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/walinker-webhook`

// IMPORTANTE: estos componentes viven FUERA del render del padre. Si se definen
// dentro, React los recrea en cada tecla y el input pierde el foco (no se puede
// escribir una llave completa).
function Estado({ pista }: { pista?: string }) {
  const { t } = useTranslation()
  return pista
    ? <span className="inline-flex items-center gap-1 text-xs text-success-700"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('adm.cfg.guardada')}</span>
    : <span className="text-xs text-amber-700">{t('adm.cfg.sinConfigurar')}</span>
}

function CampoSecreto({ label, ph, valor, pista, visible, onToggle, onChange }: {
  label: string; ph: string; valor: string; pista?: string
  visible: boolean; onToggle: () => void; onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div>
      <div className="flex items-center justify-between"><label className="label mb-0" htmlFor={id}>{label}</label><Estado pista={pista} /></div>
      <div className="relative mt-1">
        <input id={id} type={visible ? 'text' : 'password'} className="input pr-11"
          placeholder={pista ? pista : ph}
          value={valor} onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
        <button type="button" onClick={onToggle} aria-label={visible ? 'Ocultar valor' : 'Mostrar valor'} aria-pressed={visible} aria-controls={id}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700">
          {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      {pista && !valor && (
        <p className="text-[11px] text-success-700 mt-1">
          {t('adm.cfg.guardadaComo1')} <code className="font-mono">{pista}</code>{t('adm.cfg.guardadaComo2')}
        </p>
      )}
    </div>
  )
}

export default function AdminConfigPage() {
  const { t: tr } = useTranslation()
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
    const modoTxt = m === 'test' ? tr('adm.cfg.modoPrueba') : tr('adm.cfg.modoProd')
    if (pk.startsWith('sk_') || pk.startsWith('rk_')) {
      toast.error(tr('adm.cfg.errLlaveSecretaExpuesta'), { duration: 8000 })
      return
    }
    if (pk && !pk.startsWith('pk_')) { toast.error(tr('adm.cfg.errPkPrefix')); return }
    if (sk && !(sk.startsWith('sk_') || sk.startsWith('rk_'))) { toast.error(tr('adm.cfg.errSkPrefix')); return }
    if (wh && !wh.startsWith('whsec_')) { toast.error(tr('adm.cfg.errWhPrefix')); return }
    // Evitar mezclar juegos (pegar llaves live en el slot de prueba o viceversa).
    if (pk && !pk.includes(`_${esperado}_`)) { toast.error(tr('adm.cfg.errModoPk', { modo: modoTxt, esperado })); return }
    if (sk && !sk.includes(`_${esperado}_`)) { toast.error(tr('adm.cfg.errModoSk', { modo: modoTxt, esperado })); return }

    setSaving(true)
    try {
      await saveConfig(kPk, pk)
      await saveConfig('stripe_habilitado', config.stripe_habilitado ?? 'false')
      await saveConfig('stripe_modo', m)
      await saveSecreto(kSk)
      await saveSecreto(kWh)
      setSecretos(s => ({ ...s, [kSk]: '', [kWh]: '' }))
      toast.success(tr('adm.cfg.credGuardadas', { modo: modoTxt }))
      await load()
    } catch (e: any) { toast.error(e?.message ?? tr('adm.cfg.errorGuardar')) }
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
      toast.success(tr('adm.cfg.notifGuardada'))
      await load()
    } catch (e: any) { toast.error(e?.message ?? tr('adm.cfg.errorGuardar')) }
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
      toast.success(tr('adm.cfg.integracionGuardada'))
      await load()
    } catch (e: any) { toast.error(e?.message ?? tr('adm.cfg.errorGuardar')) }
    setSaving(false)
  }

  const setCfg = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setConfig(c => ({ ...c, [k]: e.target.value }))
  const setSec = (k: string, v: string) => setSecretos(s => ({ ...s, [k]: v }))
  const toggleVer = (k: string) => setVer(v => ({ ...v, [k]: !v[k] }))

  if (loading) return <div role="status" className="card p-8 text-center text-slate-500 text-sm">{tr('adm.cargando')}</div>

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'pagos', label: tr('adm.cfg.tPagos'), icon: CreditCard },
    { id: 'notificaciones', label: tr('adm.cfg.tNotificaciones'), icon: Bell },
    { id: 'whatsapp', label: tr('adm.cfg.tWhatsApp'), icon: MessageCircle },
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
        <h1 className="text-2xl font-bold text-navy-900">{tr('adm.cfg.title')}</h1>
        <p className="text-slate-500 text-sm">{tr('adm.cfg.subtitle')}</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary-50 border border-primary-100 p-3">
        <ShieldCheck className="w-4 h-4 text-primary-700 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-primary-800">{tr('adm.cfg.boveda')}</p>
      </div>

      <div className="flex flex-wrap gap-2 bg-fondo p-1 rounded-xl w-fit max-w-full" role="group" aria-label={tr('adm.cfg.title')}>
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} aria-pressed={tab === tb.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tb.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tb.icon className="w-4 h-4" aria-hidden="true" /> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'pagos' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: '#635BFF' }}>Stripe</span>
              {configurado && <span className="badge bg-success-50 text-success-700">{tr('adm.cfg.activo')}</span>}
            </div>
            <div className="flex items-center gap-4">
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-navy-700 inline-flex items-center gap-1">{tr('adm.cfg.documentacion')} <ExternalLink className="w-3 h-3" aria-hidden="true" /><span className="sr-only"> (se abre en otra pestaña)</span></a>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500" id="stripe-habilitado-lbl">{tr('adm.cfg.habilitado')}</span>
                <button type="button" role="switch" aria-checked={habilitado} aria-labelledby="stripe-habilitado-lbl"
                  onClick={() => setConfig(c => ({ ...c, stripe_habilitado: habilitado ? 'false' : 'true' }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${habilitado ? 'bg-success-500' : 'bg-slate-300'}`}>
                  <span aria-hidden="true" className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${habilitado ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-500">{tr('adm.cfg.tarjetasInter')}</p>

            {/* Selector de juego de credenciales: cada modo guarda las suyas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex">
                {(['test', 'live'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setConfig(c => ({ ...c, stripe_modo: m }))} aria-pressed={modo === m}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${modo === m ? 'border-primary-500 bg-primary-50/50 text-navy-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <span className="flex items-center justify-center gap-2">
                      {m === 'test' ? tr('adm.cfg.pruebaSandbox') : tr('adm.cfg.produccion')}
                      {listo(m)
                        ? <span className="badge bg-success-50 text-success-700 text-[10px]">{tr('adm.cfg.lista')}</span>
                        : <span className="badge bg-slate-100 text-slate-500 text-[10px]">{tr('adm.cfg.vacia')}</span>}
                    </span>
                  </button>
                ))}
              </div>
              <p className="px-4 py-2.5 text-xs text-slate-500 bg-fondo">
                {tr('adm.cfg.cadaModo1')}<strong>{tr('adm.cfg.susCredenciales')}</strong>{tr('adm.cfg.cadaModo2')}<strong className={modoPrueba ? 'text-amber-700' : 'text-primary-700'}>{modoPrueba ? tr('adm.cfg.modoPruebaTxt') : tr('adm.cfg.modoProdTxt')}</strong>.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="cfg-stripe-pk">{tr('adm.cfg.llavePublica')}</label>
                <input id="cfg-stripe-pk" className="input" placeholder={`pk_${modo}_...`} autoComplete="off" spellCheck={false}
                  value={config[kPk] ?? ''} onChange={setCfg(kPk)} />
              </div>
              <CampoSecreto label={tr('adm.cfg.llaveSecreta')} ph={`sk_${modo}_...`}
                valor={secretos[kSk] ?? ''} pista={estado[kSk]}
                visible={!!ver[kSk]} onToggle={() => toggleVer(kSk)}
                onChange={v => setSec(kSk, v)} />
            </div>

            <CampoSecreto label={tr('adm.cfg.secretoWebhook')} ph="whsec_..."
              valor={secretos[kWh] ?? ''} pista={estado[kWh]}
              visible={!!ver[kWh]} onToggle={() => toggleVer(kWh)}
              onChange={v => setSec(kWh, v)} />

            {!modoPrueba && !listo('live') && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                {tr('adm.cfg.prodFaltan')}
              </p>
            )}

            <div className="rounded-xl bg-fondo p-4 space-y-2">
              <p className="text-sm font-medium text-navy-900">{tr('adm.cfg.endpointWebhook')}</p>
              <p className="text-xs text-slate-500">
                {tr('adm.cfg.endpointDesc')}
              </p>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <code className="text-xs text-slate-600 truncate flex-1">{WEBHOOK_URL}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success(tr('adm.cfg.copiado')) }} className="text-slate-500 hover:text-navy-700 inline-flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" aria-hidden="true" /> {tr('adm.cfg.copiar')}</button>
              </div>

              <p className="text-xs font-medium text-navy-900 pt-1">{tr('adm.cfg.eventosActivar')}</p>
              <ul className="text-[11px] text-slate-500 space-y-0.5">
                {EVENTOS_STRIPE.map(([ev, paraKey]) => (
                  <li key={ev} className="flex gap-2">
                    <code className="text-navy-700 shrink-0">{ev}</code>
                    <span className="text-slate-500">— {tr(paraKey)}</span>
                  </li>
                ))}
              </ul>
              <button type="button"
                onClick={() => { navigator.clipboard.writeText(EVENTOS_STRIPE.map(e => e[0]).join('\n')); toast.success(tr('adm.cfg.eventosCopiados')) }}
                className="text-xs text-primary-700 hover:underline inline-flex items-center gap-1">
                <Copy className="w-3 h-3" aria-hidden="true" /> {tr('adm.cfg.copiarEventos')}
              </button>
              <p className="text-[11px] text-amber-700">
                {tr('adm.cfg.avisoInvoice')}
              </p>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={guardarPagos} disabled={saving} aria-busy={saving} className="btn-navy">
                {saving && <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Save className="w-4 h-4" aria-hidden="true" /> {tr('adm.cfg.guardarConfig')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><MessageCircle className="w-4 h-4 text-success-700" aria-hidden="true" /> {tr('adm.cfg.walinkerTitle')}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500" id="walinker-habilitado-lbl">{tr('adm.cfg.habilitado')}</span>
              <button type="button" role="switch" aria-checked={config.walinker_habilitado === 'true'} aria-labelledby="walinker-habilitado-lbl"
                onClick={() => setConfig(c => ({ ...c, walinker_habilitado: c.walinker_habilitado === 'true' ? 'false' : 'true' }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${config.walinker_habilitado === 'true' ? 'bg-success-500' : 'bg-slate-300'}`}>
                <span aria-hidden="true" className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.walinker_habilitado === 'true' ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">
            {tr('adm.cfg.walinkerIntro')}
          </p>

          <CampoSecreto label={tr('adm.cfg.apiKeyWalinker')} ph={tr('adm.cfg.apiKeyPh')}
            valor={secretos.walinker_api_key ?? ''} pista={estado.walinker_api_key}
            visible={!!ver.walinker_api_key} onToggle={() => toggleVer('walinker_api_key')}
            onChange={v => setSec('walinker_api_key', v)} />

          <div>
            <label className="label" htmlFor="cfg-walinker-link">{tr('adm.cfg.tipoLink')}</label>
            <select id="cfg-walinker-link" className="input" value={config.walinker_tipo_link ?? 'brand'} onChange={setCfg('walinker_tipo_link')}>
              <option value="brand">{tr('adm.cfg.linkMarca')}</option>
              <option value="short">{tr('adm.cfg.linkCorto')}</option>
            </select>
          </div>

          <div className="rounded-xl bg-fondo p-4 space-y-2">
            <p className="text-sm font-medium text-navy-900">{tr('adm.cfg.webhookWalinker')}</p>
            <p className="text-xs text-slate-500">{tr('adm.cfg.webhookWalinkerDesc')}</p>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
              <code className="text-xs text-slate-600 truncate flex-1">{WALINKER_WEBHOOK_URL}</code>
              <button type="button" onClick={() => { navigator.clipboard.writeText(WALINKER_WEBHOOK_URL); toast.success(tr('adm.cfg.copiado')) }} className="text-slate-500 hover:text-navy-700 inline-flex items-center gap-1 text-xs"><Copy className="w-3.5 h-3.5" aria-hidden="true" /> {tr('adm.cfg.copiar')}</button>
            </div>
            <CampoSecreto label={tr('adm.cfg.tokenWebhook')} ph={tr('adm.cfg.tokenWebhookPh')}
              valor={secretos.walinker_webhook_token ?? ''} pista={estado.walinker_webhook_token}
              visible={!!ver.walinker_webhook_token} onToggle={() => toggleVer('walinker_webhook_token')}
              onChange={v => setSec('walinker_webhook_token', v)} />
            <p className="text-[11px] text-slate-500">{tr('adm.cfg.tokenWebhookAyuda')}</p>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={guardarWhatsApp} disabled={saving} aria-busy={saving} className="btn-navy">
              {saving && <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" aria-hidden="true" /> {tr('adm.cfg.guardarIntegracion')}
            </button>
          </div>
        </div>
      )}

      {tab === 'notificaciones' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-navy-900 font-semibold"><Bell className="w-4 h-4 text-primary-700" aria-hidden="true" /> {tr('adm.cfg.emailPlataforma')}</div>
          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">{tr('adm.cfg.emailIntro')}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label" htmlFor="cfg-smtp-host">{tr('adm.cfg.proveedorSmtp')}</label><input id="cfg-smtp-host" className="input" placeholder="smtp.resend.com" value={config.smtp_host ?? ''} onChange={setCfg('smtp_host')} /></div>
            <div><label className="label" htmlFor="cfg-smtp-port">{tr('adm.cfg.puerto')}</label><input id="cfg-smtp-port" className="input" inputMode="numeric" value={config.smtp_port ?? '587'} onChange={setCfg('smtp_port')} /></div>
            <div><label className="label" htmlFor="cfg-limite">{tr('adm.cfg.limiteSpam')}</label><input id="cfg-limite" type="number" inputMode="numeric" min="0" className="input" value={config.email_limite_dia_default ?? '50'} onChange={setCfg('email_limite_dia_default')} /></div>
            <div><label className="label" htmlFor="cfg-smtp-from">{tr('adm.cfg.fromCorreo')}</label><input id="cfg-smtp-from" type="email" className="input" placeholder="no-reply@cotizago.com.mx" value={config.smtp_from ?? ''} onChange={setCfg('smtp_from')} /></div>
            <div><label className="label" htmlFor="cfg-smtp-nombre">{tr('adm.cfg.fromNombre')}</label><input id="cfg-smtp-nombre" className="input" value={config.smtp_from_nombre ?? 'Cotiza Go'} onChange={setCfg('smtp_from_nombre')} /></div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <CampoSecreto label={tr('adm.cfg.contrasenaSmtp')} ph="•••" valor={secretos.smtp_password ?? ''} pista={estado.smtp_password}
              visible={!!ver.smtp_password} onToggle={() => toggleVer('smtp_password')} onChange={v => setSec('smtp_password', v)} />
            <CampoSecreto label={tr('adm.cfg.oApiResend')} ph="re_..." valor={secretos.resend_api_key ?? ''} pista={estado.resend_api_key}
              visible={!!ver.resend_api_key} onToggle={() => toggleVer('resend_api_key')} onChange={v => setSec('resend_api_key', v)} />
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={guardarNotif} disabled={saving} aria-busy={saving} className="btn-navy">
              {saving && <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Save className="w-4 h-4" aria-hidden="true" /> {tr('adm.cfg.guardarConfig')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
