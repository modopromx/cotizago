import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import { cargarConfigStripe, instanciaStripe } from '../../lib/stripe'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import CampoTelefono from '../../components/CampoTelefono'
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
      wsId ? supabase.from('integraciones').select('*').eq('workspace_id', wsId) : Promise.resolve({ data: [] as any[] }),
    ])
    setModulos(mods ?? [])
    const s: Record<string, any> = {}; (subsRes.data ?? []).forEach((x: any) => { s[x.clave] = x })
    const i: Record<string, any> = {}; (intRes.data ?? []).forEach((x: any) => { i[x.tipo] = x })
    setSubs(s); setIntegr(i); setLoading(false)
  }
  useEffect(() => { load() }, [wsId])
  useEffect(() => { cargarConfigStripe().then(setStripeCfg) }, [])

  // Al volver del checkout, Stripe redirige aquí antes de que llegue el webhook.
  // Se consulta unos segundos hasta ver la suscripción activa.
  useEffect(() => {
    if (params.get('suscripcion') !== 'procesando' || !wsId) return
    let intentos = 0
    const t = setInterval(async () => {
      intentos++
      const { data } = await supabase.from('modulo_suscripciones').select('*').eq('workspace_id', wsId)
      const activo = (data ?? []).some((s: any) => ['activa', 'morosa'].includes(s.estado))
      if (activo || intentos >= 10) {
        clearInterval(t)
        params.delete('suscripcion'); params.delete('session_id'); setParams(params, { replace: true })
        if (activo) toast.success('Módulo activado')
        else toast('El pago se está confirmando. Actualiza en un momento.', { icon: '⏳' })
        load()
      }
    }, 1500)
    return () => clearInterval(t)
  }, [params, wsId])

  // 'morosa' sigue contando como activo: falló un cobro pero Stripe reintenta.
  const vigente = (s: any) => ['activa', 'morosa'].includes(s?.estado)
  const activos = Object.values(subs).filter(vigente)
  const gastoMensual = activos.reduce((sum, s: any) => sum + (Number(modulos.find(m => m.clave === s.clave)?.precio) || 0), 0)

  const llamar = async (fn: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sesión expirada')
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? 'No se pudo completar la operación')
    return data
  }

  // Ya no se activa aquí: se cobra y el webhook activa. Sin pago no hay módulo.
  const contratar = async (m: any) => {
    if (!wsId) return
    if (!stripeCfg.habilitado || !stripeCfg.pk) {
      toast.error('Los pagos aún no están configurados. Avísale al administrador.')
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
      ? `El módulo seguirá activo hasta el ${fin} y no se volverá a cobrar. ¿Continuar?`
      : '¿Cancelar este módulo?')) return
    setOcupado(m.clave)
    try {
      await llamar('cancel-subscription', { clave: m.clave })
      toast.success(fin ? `Se cancelará el ${fin}` : 'Módulo cancelado')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setOcupado(null) }
  }

  const reactivar = async (m: any) => {
    setOcupado(m.clave)
    try {
      await llamar('cancel-subscription', { clave: m.clave, reactivar: true })
      toast.success('Se mantiene activo')
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
    const payload: any = { workspace_id: wsId, tipo: config.tipo, config: cfg, activa: true, updated_at: new Date().toISOString() }
    if (secreto) payload.secreto = secreto           // solo se sobrescribe si escribió algo
    const { error } = await supabase.from('integraciones').upsert(payload, { onConflict: 'workspace_id,tipo' })
    if (error) toast.error('Error al guardar: ' + error.message)
    else { toast.success('Configuración guardada'); setConfig(null); load() }
    setSaving(false)
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Módulos e integraciones</h1>
          <p className="text-slate-500 text-sm">Contrata únicamente los módulos que necesita tu negocio.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">{activos.length} módulos activos</p>
          <p className="font-bold text-navy-900">{formatCurrency(gastoMensual)}<span className="text-xs font-normal text-slate-400">/mes</span></p>
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
                <span className="w-10 h-10 rounded-xl bg-fondo flex items-center justify-center text-navy-700"><Icon className="w-5 h-5" /></span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {activo && !morosa && <span className="badge bg-success-50 text-success-600">Activo</span>}
                  {morosa && <span className="badge bg-red-50 text-red-600">Pago pendiente</span>}
                  {activo && tipo && !configurado && <span className="badge bg-amber-50 text-amber-600">Configurar</span>}
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{m.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 flex-1">{m.descripcion}</p>
              <p className="mt-3 text-lg font-extrabold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-400">/mes</span></p>
              <p className="text-[11px] text-slate-400">Adicional a tus folios</p>

              {morosa && (
                <p className="mt-2 text-[11px] text-red-600 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  No pudimos cobrar tu tarjeta. Actualízala para no perder el módulo.
                </p>
              )}
              {porCancelar && s?.periodo_fin && (
                <p className="mt-2 text-[11px] text-amber-600">Activo hasta el {formatDate(s.periodo_fin)}. No se volverá a cobrar.</p>
              )}
              {activo && !porCancelar && s?.periodo_fin && (
                <p className="mt-2 text-[11px] text-slate-400">Se renueva el {formatDate(s.periodo_fin)}</p>
              )}

              {activo ? (
                <div className="mt-4 flex gap-2">
                  {tipo && <button onClick={() => abrirConfig(m.clave)} className="btn-secondary flex-1 justify-center text-xs"><Settings className="w-3.5 h-3.5" /> Configurar</button>}
                  {porCancelar ? (
                    <button onClick={() => reactivar(m)} disabled={cargando} className="btn-navy flex-1 justify-center text-xs">Reactivar</button>
                  ) : (
                    <button onClick={() => cancelar(m)} disabled={cargando} className="btn-secondary flex-1 justify-center text-xs text-red-600">Cancelar</button>
                  )}
                </div>
              ) : (
                <button onClick={() => contratar(m)} disabled={cargando} className="btn-navy mt-4 w-full justify-center text-xs">
                  {cargando ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Contratar · {formatCurrency(m.precio)}/mes
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Checkout embebido de Stripe: suscripción mensual del módulo */}
      {clientSecret && stripePromise && (
        <div className="fixed inset-0 bg-navy-950/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Suscripción mensual</h2>
              <button onClick={() => setClientSecret(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
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
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">
                {config.tipo === 'whatsapp' ? 'Conectar WhatsApp' : config.tipo === 'pagos' ? 'Pagos con tarjeta' : 'Tu servidor de email'}
              </h2>
              <button onClick={() => setConfig(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-3">
              {config.tipo === 'whatsapp' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Conecta tu número para enviar cotizaciones desde <strong>tu propio WhatsApp</strong>. Con WhatsApp Web se abre el chat con el mensaje listo; solo das enviar.</p>
                  <div>
                    <label className="label">Método de conexión</label>
                    <select className="input" value={form.metodo ?? 'web'} onChange={e => setForm({ ...form, metodo: e.target.value })}>
                      <option value="web">WhatsApp Web (recomendado, sin costo)</option>
                      <option value="cloud">Meta Cloud API (envío automático)</option>
                    </select>
                  </div>
                  <CampoTelefono label="Tu número de WhatsApp" value={form.numero}
                    onChange={v => setForm({ ...form, numero: v })} />
                  {form.metodo === 'cloud' && (
                    <>
                      <div><label className="label">Phone Number ID</label><input className="input" value={form.phone_id ?? ''} onChange={e => setForm({ ...form, phone_id: e.target.value })} /></div>
                      <div><label className="label">Token de acceso</label><input type="password" className="input" placeholder="•••" value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} /></div>
                      <p className="text-[11px] text-amber-600">Meta Cloud API requiere cuenta verificada y plantillas aprobadas.</p>
                    </>
                  )}
                </>
              )}

              {config.tipo === 'pagos' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Cobra con tarjeta en tus cotizaciones. Conecta <strong>tu propia cuenta de Stripe</strong>: el dinero llega directo a ti.</p>
                  <div><label className="label">Llave pública de Stripe</label><input className="input" placeholder="pk_live_..." value={form.publishable_key ?? ''} onChange={e => setForm({ ...form, publishable_key: e.target.value })} /></div>
                  <div>
                    <label className="label">Llave secreta de Stripe</label>
                    <input type="password" className="input" placeholder={integr['pagos']?.secreto ? '••• ya configurada' : 'sk_live_...'} value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} />
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <label className="label">O usa un link de pago</label>
                    <input className="input" placeholder="https://buy.stripe.com/... o Clip/Mercado Pago" value={form.link_pago ?? ''} onChange={e => setForm({ ...form, link_pago: e.target.value })} />
                    <p className="text-[11px] text-slate-400 mt-1">Si prefieres no conectar llaves, pega un link de pago: aparecerá como botón en tus cotizaciones.</p>
                  </div>
                  <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-xs text-primary-600 inline-flex items-center gap-1 hover:underline">Dónde encuentro mis llaves <ExternalLink className="w-3 h-3" /></a>
                </>
              )}

              {config.tipo === 'email' && (
                <>
                  <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Envía las cotizaciones desde <strong>tu propio dominio</strong> en lugar del correo de la plataforma.</p>
                  <div><label className="label">Servidor SMTP</label><input className="input" placeholder="smtp.tudominio.com" value={form.host ?? ''} onChange={e => setForm({ ...form, host: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Puerto</label><input className="input" value={form.puerto ?? '587'} onChange={e => setForm({ ...form, puerto: e.target.value })} /></div>
                    <div><label className="label">Usuario</label><input className="input" value={form.usuario ?? ''} onChange={e => setForm({ ...form, usuario: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Contraseña</label><input type="password" className="input" placeholder={integr['email']?.secreto ? '••• ya configurada' : '•••'} value={form.secreto ?? ''} onChange={e => setForm({ ...form, secreto: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">From (correo)</label><input className="input" placeholder="ventas@tudominio.com" value={form.from_email ?? ''} onChange={e => setForm({ ...form, from_email: e.target.value })} /></div>
                    <div><label className="label">From (nombre)</label><input className="input" value={form.from_nombre ?? ''} onChange={e => setForm({ ...form, from_nombre: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setConfig(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button onClick={guardarConfig} disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
