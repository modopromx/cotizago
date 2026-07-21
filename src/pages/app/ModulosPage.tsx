import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, CreditCard, Code2, Blocks, Settings, Save, X, ExternalLink } from 'lucide-react'

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

  const activos = Object.values(subs).filter((s: any) => s.estado === 'activa')
  const gastoMensual = activos.reduce((sum, s: any) => sum + (Number(modulos.find(m => m.clave === s.clave)?.precio) || 0), 0)

  const contratar = async (m: any) => {
    if (!wsId) return
    // Cuando Stripe cobre módulos, aquí se cobra antes de activar.
    const { error } = await supabase.from('modulo_suscripciones').upsert({
      workspace_id: wsId, clave: m.clave, estado: 'activa',
      fecha_contratacion: new Date().toISOString(),
      fecha_renovacion: new Date(Date.now() + 30 * 864e5).toISOString(),
    }, { onConflict: 'workspace_id,clave' })
    if (error) toast.error('No se pudo contratar')
    else { toast.success(`${m.nombre} activado`); load() }
  }

  const cancelar = async (clave: string) => {
    if (!wsId || !confirm('¿Cancelar este módulo?')) return
    await supabase.from('modulo_suscripciones').update({ estado: 'cancelada' }).eq('workspace_id', wsId).eq('clave', clave)
    toast.success('Módulo cancelado'); load()
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
          const activo = subs[m.clave]?.estado === 'activa'
          const tipo = TIPO_CONFIG[m.clave]
          const configurado = tipo && integr[tipo]?.activa
          return (
            <div key={m.clave} className={`card p-5 flex flex-col ${activo ? 'ring-1 ring-primary-200' : ''}`}>
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-fondo flex items-center justify-center text-navy-700"><Icon className="w-5 h-5" /></span>
                <div className="flex gap-1">
                  {activo && <span className="badge bg-success-50 text-success-600">Activo</span>}
                  {activo && tipo && !configurado && <span className="badge bg-amber-50 text-amber-600">Configurar</span>}
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{m.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 flex-1">{m.descripcion}</p>
              <p className="mt-3 text-lg font-extrabold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-400">/mes</span></p>
              <p className="text-[11px] text-slate-400">Adicional a tus folios</p>

              {activo ? (
                <div className="mt-4 flex gap-2">
                  {tipo && <button onClick={() => abrirConfig(m.clave)} className="btn-secondary flex-1 justify-center text-xs"><Settings className="w-3.5 h-3.5" /> Configurar</button>}
                  <button onClick={() => cancelar(m.clave)} className="btn-secondary flex-1 justify-center text-xs text-red-600">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => contratar(m)} className="btn-navy mt-4 w-full justify-center text-xs">Contratar</button>
              )}
            </div>
          )
        })}
      </div>

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
                  <div><label className="label">Tu número de WhatsApp</label><input className="input" placeholder="52 55 1234 5678" value={form.numero ?? ''} onChange={e => setForm({ ...form, numero: e.target.value })} /></div>
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
