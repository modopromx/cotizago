import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import { cargarConfigStripe, instanciaStripe } from '../../lib/stripe'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import CampoTelefono from '../../components/CampoTelefono'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, CreditCard, Code2, Blocks, Settings, Save, X, ExternalLink, AlertTriangle } from 'lucide-react'

const ICONOS: Record<string, any> = {
  whatsapp_propio: MessageCircle, email_profesional: Mail, pagos_linea: CreditCard, api_webhooks: Code2,
}
// Módulos que abren una pantalla de configuración al activarse
const TIPO_CONFIG: Record<string, 'whatsapp' | 'pagos' | 'email'> = {
  whatsapp_propio: 'whatsapp', pagos_linea: 'pagos', email_profesional: 'email',
}

export default function ModulosPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const wsId = profile?.workspace_id
  const [modulos, setModulos] = useState<any[]>([])
  const [subs, setSubs] = useState<Record<string, any>>({})
  const [integr, setIntegr] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<{ tipo: string; clave: string } | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [stripeCfg, setStripeCfg] = useState<{ pk: string; habilitado: boolean }>({ pk: '', habilitado: false })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const load = async () => {
    const [{ data: mods }, subsRes, intRes] = await Promise.all([
      supabase.from('modulos').select('*').eq('activo', true).order('orden'),
      wsId ? supabase.from('modulo_suscripciones').select('*').eq('workspace_id', wsId) : Promise.resolve({ data: [] as any[] }),
      wsId ? supabase.from('integraciones').select('id,workspace_id,tipo,config,activa,tiene_secreto').eq('workspace_id', wsId) : Promise.resolve({ data: [] as any[] }),
    ])
    setModulos(mods ?? [])
    const s: Record<string, any> = {}; (subsRes.data ?? []).forEach((x: any) => { s[x.clave] = x })
    const i: Record<string, any> = {}; (intRes.data ?? []).forEach((x: any) => { i[x.tipo] = x })
    setSubs(s); setIntegr(i); setLoading(false)
  }
  useEffect(() => { load() }, [wsId])
  useEffect(() => { cargarConfigStripe().then(setStripeCfg) }, [])

  // Escape cierra el checkout embebido (no usa <Modal> por el iframe de Stripe).
  useEffect(() => {
    if (!clientSecret) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setClientSecret(null) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [clientSecret])

  // Al volver del checkout, Stripe redirige aquí antes de que llegue el webhook.
  // Se consulta unos segundos hasta ver la suscripción activa.
  useEffect(() => {
    if (params.get('suscripcion') !== 'procesando' || !wsId) return
    let intentos = 0
    const iv = setInterval(async () => {
      intentos++
      const { data } = await supabase.from('modulo_suscripciones').select('*').eq('workspace_id', wsId)
      const activo = (data ?? []).some((s: any) => ['activa', 'morosa'].includes(s.estado))
      if (activo || intentos >= 10) {
        clearInterval(iv)
        params.delete('suscripcion'); params.delete('session_id'); setParams(params, { replace: true })
        if (activo) toast.success(t('mod.moduloActivado'))
        else toast(t('mod.pagoConfirmando'), { icon: '⏳' })
        load()
      }
    }, 1500)
    return () => clearInterval(iv)
  }, [params, wsId])

  // 'morosa' sigue contando como activo: falló un cobro pero Stripe reintenta.
  const vigente = (s: any) => ['activa', 'morosa'].includes(s?.estado)
  const activos = Object.values(subs).filter(vigente)
  const gastoMensual = activos.reduce((sum, s: any) => sum + (Number(modulos.find(m => m.clave === s.clave)?.precio) || 0), 0)

  const llamar = async (fn: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error(t('mod.sesionExpirada'))
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? t('mod.noCompletar'))
    return data
  }

  // Ya no se activa aquí: se cobra y el webhook activa. Sin pago no hay módulo.
  const contratar = async (m: any) => {
    if (!wsId) return
    if (!stripeCfg.habilitado || !stripeCfg.pk) {
      toast.error(t('mod.pagosNoConfig'))
      return
    }
    setOcupado(m.clave)
    try {
      const data = await llamar('create-subscription', { clave: m.clave })
      setStripePromise(instanciaStripe(stripeCfg.pk))
      setClientSecret(data.clientSecret)
    } catch (e: any) {
      toast.error(e.message)
    } finally { setOcupado(null) }
  }

  const cancelar = async (m: any) => {
    const s = subs[m.clave]
    const fin = s?.periodo_fin ? formatDate(s.periodo_fin) : null
    if (!confirm(fin
      ? t('mod.cancelarFin', { fin })
      : t('mod.confCancelar'))) return
    setOcupado(m.clave)
    try {
      await llamar('cancel-subscription', { clave: m.clave })
      toast.success(fin ? t('mod.seCancelaraFin', { fin }) : t('mod.moduloCancelado'))
      load()
    } catch (e: any) { toast.error(e.message) } finally { setOcupado(null) }
  }

  const reactivar = async (m: any) => {
    setOcupado(m.clave)
    try {
      await llamar('cancel-subscription', { clave: m.clave, reactivar: true })
      toast.success(t('mod.seMantiene'))
      load()
    } catch (e: any) { toast.error(e.message) } finally { setOcupado(null) }
  }

  const abrirConfig = (clave: string) => {
    const tipo = TIPO_CONFIG[clave]
    const actual = integr[tipo]
    setForm({ ...(actual?.config ?? {}), secreto: '' })
    setConfig({ tipo, clave })
  }

  const guardarConfig = async () => {
    if (!wsId || !config) return
    setSaving(true)
    const { secreto, ...cfg } = form
    // Se guarda con la función del servidor: la llave se escribe pero el
    // navegador nunca puede volver a leerla. Vacía = se conserva la anterior.
    const { error } = await supabase.rpc('guardar_integracion', { p_tipo: config.tipo, p_config: cfg, p_secreto: secreto || null })
    if (error) toast.error(t('mod.errorGuardar') + error.message)
    else { toast.success(t('mod.configGuardada')); setConfig(null); load() }
    setSaving(false)
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">{t('mod.cargando')}</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('mod.title')}</h1>
          <p className="text-slate-500 text-sm">{t('mod.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{t('mod.activosN', { n: activos.length })}</p>
          <p className="font-bold text-navy-900">{formatCurrency(gastoMensual)}<span className="text-xs font-normal text-slate-500">{t('mod.mes')}</span></p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map(m => {
          const Icon = ICONOS[m.clave] ?? Blocks
          const s = subs[m.clave]
          const activo = vigente(s)
          const morosa = s?.estado === 'morosa'
          const porCancelar = activo && s?.cancelar_al_terminar
          const tipo = TIPO_CONFIG[m.clave]
          const configurado = tipo && integr[tipo]?.activa
          const cargando = ocupado === m.clave
          return (
            <div key={m.clave} className={`card p-5 flex flex-col ${activo ? 'ring-1 ring-primary-200' : ''}`}>
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-fondo flex items-center justify-center text-navy-700"><Icon className="w-5 h-5" aria-hidden="true" /></span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {activo && !morosa && <span className="badge bg-success-50 text-success-700">{t('mod.activo')}</span>}
                  {morosa && <span className="badge bg-red-50 text-red-700">{t('mod.pagoPendiente')}</span>}
                  {activo && tipo && !configurado && <span className="badge bg-amber-50 text-amber-700">{t('mod.configurar')}</span>}
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{m.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 flex-1">{m.descripcion}</p>
              <p className="mt-3 text-lg font-extrabold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-500">{t('mod.mes')}</span></p>
              <p className="text-[11px] text-slate-500">{t('mod.adicional')}</p>

              {morosa && (
                <p className="mt-2 text-[11px] text-red-700 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                  {t('mod.morosaAviso')}
                </p>
              )}
              {porCancelar && s?.periodo_fin && (
                <p className="mt-2 text-[11px] text-amber-700">{t('mod.activoHastaFin', { fin: formatDate(s.periodo_fin) })}</p>
              )}
              {activo && !porCancelar && s?.periodo_fin && (
                <p className="mt-2 text-[11px] text-slate-500">{t('mod.seRenuevaFin', { fin: formatDate(s.periodo_fin) })}</p>
              )}

              {activo ? (
                <div className="mt-4 flex gap-2">
                  {tipo && <button onClick={() => abrirConfig(m.clave)} className="btn-secondary flex-1 justify-center text-xs"><Settings className="w-3.5 h-3.5" aria-hidden="true" /> {t('mod.configurar')}</button>}
                  {porCancelar ? (
                    <button onClick={() => reactivar(m)} disabled={cargando} className="btn-navy flex-1 justify-center text-xs">{t('mod.reactivar')}</button>
                  ) : (
                    <button onClick={() => cancelar(m)} disabled={cargando} className="btn-secondary flex-1 justify-center text-xs text-red-700">{t('mod.cancelar')}</button>
                  )}
                </div>
              ) : (
                <button onClick={() => contratar(m)} disabled={cargando} className="btn-navy mt-4 w-full justify-center text-xs">
                  {cargando ? <span role="status" aria-label="Cargando" className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {t('mod.contratar')} · {formatCurrency(m.precio)}{t('mod.mes')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Checkout embebido de Stripe: suscripción mensual del módulo */}
      {clientSecret && stripePromise && (
        // No usa <Modal>: su trampa de foco no ve el iframe de Stripe y el
        // teclado no podría entrar al formulario de pago.
        <div className="fixed inset-0 bg-navy-950/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="mod-checkout-titulo" className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 id="mod-checkout-titulo" className="font-bold text-navy-900">{t('mod.suscripcionMensual')}</h2>
              <button onClick={() => setClientSecret(null)} aria-label="Cerrar" className="p-2 -m-2 text-slate-500 hover:text-slate-600"><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
            <div className="p-2">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}

      {/* Configuración del módulo contratado */}
      {config && (
        <Modal ancho="max-w-md" onClose={() => setConfig(null)} sinCerrar={saving}
          titulo={config.tipo === 'whatsapp' ? t('mod.conectarWa') : config.tipo === 'pagos' ? t('mod.pagosTarjeta') : t('mod.tuServidorEmail')}>
            <div className="space-y-3">
              {config.tipo === 'whatsapp' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">{t('mod.waIntro')}</p>
                  <div>
                    <label htmlFor="mod-metodoConexion" className="label">{t('mod.metodoConexion')}</label>
                    <select id="mod-metodoConexion" className="input" value={form.metodo ?? 'web'} onChange={e => setForm({ ...form, metodo: e.target.value })}>
                      <option value="web">{t('mod.waWeb')}</option>
                      <option value="cloud">{t('mod.waCloud')}</option>
                    </select>
                  </div>
                  <CampoTelefono label={t('mod.tuNumeroWa')} value={form.numero}
                    onChange={v => setForm({ ...form, numero: v })} />
                  {form.metodo === 'cloud' && (
                    <>
                      <div><label htmlFor="mod-phoneId" className="label">{t('mod.phoneId')}</label><input id="mod-phoneId" className="input" value={form.phone_id ?? ''} onChange={e => setForm({ ...form, phone_id: e.target.value })} /></div>
                      <div><label htmlFor="mod-tokenAcceso" className="label">{t('mod.tokenAcceso')}</label><input id="mod-tokenAcceso" type="password" className="input" placeholder="•••" value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} /></div>
                      <p className="text-[11px] text-amber-700">{t('mod.metaAviso')}</p>
                    </>
                  )}
                </>
              )}

              {config.tipo === 'pagos' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">{t('mod.pagosIntro')}</p>
                  <div><label htmlFor="mod-llavePublica" className="label">{t('mod.llavePublica')}</label><input id="mod-llavePublica" className="input" placeholder="pk_live_..." value={form.publishable_key ?? ''} onChange={e => setForm({ ...form, publishable_key: e.target.value })} /></div>
                  <div>
                    <label htmlFor="mod-llaveSecreta" className="label">{t('mod.llaveSecreta')}</label>
                    <input id="mod-llaveSecreta" type="password" className="input" placeholder={integr['pagos']?.tiene_secreto ? t('mod.yaConfigurada') : 'sk_live_...'} value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} />
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <label htmlFor="mod-oLinkPago" className="label">{t('mod.oLinkPago')}</label>
                    <input id="mod-oLinkPago" className="input" placeholder="https://buy.stripe.com/... o Clip/Mercado Pago" value={form.link_pago ?? ''} onChange={e => setForm({ ...form, link_pago: e.target.value })} />
                    <p className="text-[11px] text-slate-500 mt-1">{t('mod.linkPagoAyuda')}</p>
                  </div>
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-xs text-primary-700 inline-flex items-center gap-1 hover:underline">{t('mod.dondeLlaves')} <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>
                </>
              )}

              {config.tipo === 'email' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">{t('mod.emailIntro')}</p>
                  <div><label htmlFor="mod-servidorSmtp" className="label">{t('mod.servidorSmtp')}</label><input id="mod-servidorSmtp" className="input" placeholder="smtp.tudominio.com" value={form.host ?? ''} onChange={e => setForm({ ...form, host: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="mod-puerto" className="label">{t('mod.puerto')}</label><input id="mod-puerto" inputMode="numeric" className="input" value={form.puerto ?? '587'} onChange={e => setForm({ ...form, puerto: e.target.value })} /></div>
                    <div><label htmlFor="mod-usuario" className="label">{t('mod.usuario')}</label><input id="mod-usuario" className="input" value={form.usuario ?? ''} onChange={e => setForm({ ...form, usuario: e.target.value })} /></div>
                  </div>
                  <div><label htmlFor="mod-contrasena" className="label">{t('mod.contrasena')}</label><input id="mod-contrasena" type="password" className="input" placeholder={integr['email']?.tiene_secreto ? t('mod.yaConfigurada') : '•••'} value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="mod-fromEmail" className="label">{t('mod.fromEmail')}</label><input id="mod-fromEmail" className="input" placeholder="ventas@tudominio.com" value={form.from_email ?? ''} onChange={e => setForm({ ...form, from_email: e.target.value })} /></div>
                    <div><label htmlFor="mod-fromNombre" className="label">{t('mod.fromNombre')}</label><input id="mod-fromNombre" className="input" value={form.from_nombre ?? ''} onChange={e => setForm({ ...form, from_nombre: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setConfig(null)} className="btn-secondary flex-1 justify-center">{t('mod.cancelar')}</button>
                <button onClick={guardarConfig} disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />} {t('mod.guardar')}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
