import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, CreditCard, Code2, Blocks, Edit2, X, Save, Plus, Users } from 'lucide-react'

const ICONOS: Record<string, any> = {
  whatsapp_propio: MessageCircle, email_profesional: Mail, pagos_linea: CreditCard,
  api_webhooks: Code2, crm: Blocks, equipo_ventas: Users,
}

export default function AdminModulosPage() {
  const [modulos, setModulos] = useState<any[]>([])
  const [subs, setSubs] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editar, setEditar] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: mods }, { data: ss }] = await Promise.all([
      supabase.from('modulos').select('*').order('orden'),
      supabase.from('modulo_suscripciones').select('clave,estado').eq('estado', 'activa'),
    ])
    const conteo: Record<string, number> = {}
    ;(ss ?? []).forEach((s: any) => { conteo[s.clave] = (conteo[s.clave] ?? 0) + 1 })
    setModulos(mods ?? []); setSubs(conteo); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const mrr = modulos.reduce((s, m) => s + (Number(m.precio) || 0) * (subs[m.clave] ?? 0), 0)

  const abrir = (m?: any) => {
    setEditar(m ?? { nuevo: true })
    setForm(m ? { ...m } : { clave: '', nombre: '', descripcion: '', precio: 99, periodicidad: 'mensual', activo: true, orden: modulos.length + 1 })
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { nuevo, id, created_at, ...payload } = form
    const { error } = editar?.nuevo
      ? await supabase.from('modulos').insert(payload)
      : await supabase.from('modulos').update(payload).eq('id', editar.id)
    if (error) toast.error('Error: ' + error.message)
    else { toast.success('Módulo guardado'); setEditar(null); load() }
    setSaving(false)
  }

  const toggleActivo = async (m: any) => {
    await supabase.from('modulos').update({ activo: !m.activo }).eq('id', m.id)
    toast.success(m.activo ? 'Módulo ocultado del marketplace' : 'Módulo publicado'); load()
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Planes y módulos</h1>
          <p className="text-slate-500 text-sm">Define qué módulos se ofrecen y su precio mensual.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">MRR de módulos</p>
            <p className="font-bold text-navy-900">{formatCurrency(mrr)}</p>
          </div>
          <button onClick={() => abrir()} className="btn-navy"><Plus className="w-4 h-4" /> Nuevo módulo</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
              <th className="px-6 py-3 font-medium">Módulo</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Contratados</th>
              <th className="px-4 py-3 font-medium">Ingreso mensual</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modulos.map(m => {
              const Icon = ICONOS[m.clave] ?? Blocks
              const n = subs[m.clave] ?? 0
              return (
                <tr key={m.id} className={`hover:bg-slate-50 ${!m.activo ? 'opacity-55' : ''}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-fondo flex items-center justify-center text-navy-700 shrink-0"><Icon className="w-4 h-4" /></span>
                      <div>
                        <p className="font-medium text-navy-900">{m.nombre}</p>
                        <p className="text-xs text-slate-400 max-w-md truncate">{m.descripcion}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-400">/{m.periodicidad === 'mensual' ? 'mes' : m.periodicidad}</span></td>
                  <td className="px-4 py-3 text-slate-600">{n}</td>
                  <td className="px-4 py-3 font-semibold text-primary-600">{formatCurrency((Number(m.precio) || 0) * n)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActivo(m)} className={`badge ${m.activo ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-500'}`}>
                      {m.activo ? 'Publicado' : 'Oculto'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => abrir(m)} className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editar && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">{editar.nuevo ? 'Nuevo módulo' : 'Editar módulo'}</h2>
              <button onClick={() => setEditar(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={guardar} className="p-5 space-y-3">
              <div><label className="label">Nombre</label><input className="input" required value={form.nombre ?? ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
              {editar.nuevo && (
                <div><label className="label">Clave interna</label><input className="input" required placeholder="mi_modulo" value={form.clave ?? ''} onChange={e => setForm({ ...form, clave: e.target.value })} /></div>
              )}
              <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.descripcion ?? ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Precio</label><input type="number" className="input" min="0" step="1" value={form.precio ?? 0} onChange={e => setForm({ ...form, precio: Number(e.target.value) })} /></div>
                <div><label className="label">Periodicidad</label>
                  <select className="input" value={form.periodicidad ?? 'mensual'} onChange={e => setForm({ ...form, periodicidad: e.target.value })}>
                    <option value="mensual">Mensual</option><option value="anual">Anual</option>
                  </select>
                </div>
                <div><label className="label">Orden</label><input type="number" className="input" min="1" value={form.orden ?? 1} onChange={e => setForm({ ...form, orden: Number(e.target.value) })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                <input type="checkbox" checked={form.activo ?? true} onChange={e => setForm({ ...form, activo: e.target.checked })} className="rounded border-slate-300" />
                Publicado en el marketplace
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditar(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
