import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import CampoTelefono from '../../components/CampoTelefono'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Users, X, UserPlus } from 'lucide-react'

const emptyForm = { nombre: '', empresa: '', rfc: '', razon_social: '', email: '', telefono: '', whatsapp: '', pais: 'MX', codigo_postal: '' }

export default function ClientesPage() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<any[]>([])
  const [agg, setAgg] = useState<Record<string, { count: number; valor: number }>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const [{ data: cli }, { data: cot }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('cotizaciones').select('cliente_id,total'),
    ])
    const map: Record<string, { count: number; valor: number }> = {}
    ;(cot ?? []).forEach(c => {
      if (!c.cliente_id) return
      map[c.cliente_id] = map[c.cliente_id] ?? { count: 0, valor: 0 }
      map[c.cliente_id].count++
      map[c.cliente_id].valor += Number(c.total) || 0
    })
    setAgg(map)
    setClientes(cli ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const openModal = (c?: any) => {
    setEditing(c ?? null)
    setForm(c ? { ...emptyForm, ...c } : { ...emptyForm })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    if (editing) {
      await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
      toast.success('Cliente actualizado')
    } else {
      await supabase.from('clientes').insert({ ...form, user_id: user.id })
      toast.success('Cliente creado')
    }
    setModal(false); load(); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cliente?')) return
    await supabase.from('clientes').update({ activo: false }).eq('id', id)
    toast.success('Cliente eliminado'); load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = clientes.filter(c =>
    [c.nombre, c.empresa, c.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )
  const activos = clientes.filter(c => (agg[c.id]?.count ?? 0) > 0).length
  const valorTotal = Object.values(agg).reduce((s, a) => s + a.valor, 0)

  const kpis = [
    { label: 'Clientes totales', value: clientes.length },
    { label: 'Clientes activos', value: activos, sub: clientes.length ? `${Math.round(activos / clientes.length * 100)}% del total` : '—' },
    { label: 'Valor cotizado', value: formatCurrency(valorTotal), sub: 'Histórico' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clientes</h1>
          <p className="text-slate-500 text-sm">Centraliza datos, historial y valor cotizado de cada cliente.</p>
        </div>
        <button onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" /> Agregar cliente</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">{clientes.length === 0 ? 'Sin clientes aún' : 'Sin resultados'}</p>
          <button onClick={() => openModal()} className="btn-navy mt-4"><UserPlus className="w-4 h-4" /> Agregar cliente</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                <th className="px-6 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Cotizaciones</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const a = agg[c.id] ?? { count: 0, valor: 0 }
                const activo = a.count > 0
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {(c.empresa || c.nombre || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-navy-900">{c.empresa || c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{c.nombre}</p>
                      {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.count}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(a.valor)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${activo ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-500'}`}>
                        {activo ? 'Activo' : 'Prospecto'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openModal(c)} className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Nombre / contacto *</label><input className="input" required value={form.nombre} onChange={set('nombre')} /></div>
                <div><label className="label">Empresa</label><input className="input" value={form.empresa} onChange={set('empresa')} /></div>
                <div><label className="label">RFC</label><input className="input" value={form.rfc} onChange={set('rfc')} /></div>
                <div className="col-span-2"><label className="label">Razón social</label><input className="input" value={form.razon_social} onChange={set('razon_social')} /></div>
                <div className="col-span-2"><label className="label">Correo</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
                <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={set('telefono')} /></div>
                <div className="col-span-2">
                  <CampoTelefono label="WhatsApp (para enviarle la cotización)" value={form.whatsapp}
                    onChange={v => setForm(f => ({ ...f, whatsapp: v }))}
                    paisDefault={form.pais || 'MX'} />
                </div>
                <div><label className="label">País</label>
                  <select className="input" value={form.pais} onChange={set('pais')}>
                    <option value="MX">México</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option><option value="PE">Perú</option><option value="US">Estados Unidos</option>
                  </select>
                </div>
                <div><label className="label">C.P.</label><input className="input" value={form.codigo_postal} onChange={set('codigo_postal')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? 'Guardar' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
