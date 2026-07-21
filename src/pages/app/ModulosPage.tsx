import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, CreditCard, Users, Code2, Blocks, Check, Settings, Save } from 'lucide-react'

const ICONOS: Record<string, any> = {
  whatsapp_propio: MessageCircle, email_profesional: Mail, pagos_linea: CreditCard,
  crm: Blocks, api_webhooks: Code2, equipo_ventas: Users,
}

export default function ModulosPage() {
  const { profile } = useAuth()
  const wsId = profile?.workspace_id
  const [modulos, setModulos] = useState<any[]>([])
  const [subs, setSubs] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [smtp, setSmtp] = useState<any>({ puerto: 587 })

  const load = async () => {
    const [{ data: mods }, subsRes] = await Promise.all([
      supabase.from('modulos').select('*').eq('activo', true).order('orden'),
      wsId ? supabase.from('modulo_suscripciones').select('*').eq('workspace_id', wsId) : Promise.resolve({ data: [] as any[] }),
    ])
    setModulos(mods ?? [])
    const map: Record<string, any> = {}
    ;(subsRes.data ?? []).forEach((s: any) => { map[s.clave] = s })
    setSubs(map)
    if (wsId) {
      const { data: conn } = await supabase.from('email_conexiones').select('*').eq('workspace_id', wsId).maybeSingle()
      if (conn) setSmtp(conn)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [wsId])

  const activos = Object.values(subs).filter((s: any) => s.estado === 'activa')
  const gastoMensual = activos.reduce((sum, s: any) => sum + (Number(modulos.find(m => m.clave === s.clave)?.precio) || 0), 0)

  const contratar = async (m: any) => {
    if (!wsId) return
    // Nota: cuando Stripe esté integrado, aquí se cobra ($/mes) antes de activar.
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

  const guardarSMTP = async () => {
    if (!wsId) return
    const { error } = await supabase.from('email_conexiones').upsert(
      { ...smtp, workspace_id: wsId, activa: true, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' }
    )
    if (error) toast.error('Error al guardar')
    else { toast.success('Configuración SMTP guardada'); setConfigOpen(false); load() }
  }

  const emailActivo = subs['email_profesional']?.estado === 'activa'

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
          const sub = subs[m.clave]
          const activo = sub?.estado === 'activa'
          return (
            <div key={m.clave} className={`card p-5 flex flex-col ${activo ? 'ring-1 ring-primary-200' : ''}`}>
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-fondo flex items-center justify-center text-navy-700"><Icon className="w-5 h-5" /></span>
                {activo && <span className="badge bg-success-50 text-success-600">Activo</span>}
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{m.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 flex-1">{m.descripcion}</p>
              <p className="mt-3 text-lg font-extrabold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-400">/mes</span></p>
              <p className="text-[11px] text-slate-400">Adicional a tus folios</p>

              {activo ? (
                <div className="mt-4 flex gap-2">
                  {m.clave === 'email_profesional' && (
                    <button onClick={() => setConfigOpen(true)} className="btn-secondary flex-1 justify-center text-xs"><Settings className="w-3.5 h-3.5" /> Configurar</button>
                  )}
                  <button onClick={() => cancelar(m.clave)} className="btn-secondary flex-1 justify-center text-xs text-red-600">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => contratar(m)} className="btn-navy mt-4 w-full justify-center text-xs">Contratar</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Config SMTP propia (solo tras activar Email profesional) */}
      {emailActivo && configOpen && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Tu servidor de email (SMTP)</h2>
              <button onClick={() => setConfigOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Con este módulo tus cotizaciones se envían desde tu propio dominio.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Servidor SMTP</label><input className="input" placeholder="smtp.tudominio.com" value={smtp.host ?? ''} onChange={e => setSmtp({ ...smtp, host: e.target.value })} /></div>
                <div><label className="label">Puerto</label><input type="number" className="input" value={smtp.puerto ?? 587} onChange={e => setSmtp({ ...smtp, puerto: Number(e.target.value) })} /></div>
                <div><label className="label">Usuario</label><input className="input" value={smtp.usuario ?? ''} onChange={e => setSmtp({ ...smtp, usuario: e.target.value })} /></div>
                <div className="col-span-2"><label className="label">Contraseña</label><input type="password" className="input" value={smtp.password ?? ''} onChange={e => setSmtp({ ...smtp, password: e.target.value })} /></div>
                <div><label className="label">From (correo)</label><input className="input" placeholder="ventas@tudominio.com" value={smtp.from_email ?? ''} onChange={e => setSmtp({ ...smtp, from_email: e.target.value })} /></div>
                <div><label className="label">From (nombre)</label><input className="input" value={smtp.from_nombre ?? ''} onChange={e => setSmtp({ ...smtp, from_nombre: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setConfigOpen(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button onClick={guardarSMTP} className="btn-navy flex-1 justify-center"><Save className="w-4 h-4" /> Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
