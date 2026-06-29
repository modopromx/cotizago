import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Users, X } from 'lucide-react'

const emptyForm = { nombre: '', empresa: '', rfc: '', razon_social: '', email: '', telefono: '', whatsapp: '', pais: 'MX', codigo_postal: '' }

export default function ClientesPage() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('clientes').select('*').eq('user_id', user.id).eq('activo', true).order('nombre')
    setClientes(data ?? [])
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
    setModal(false)
    load()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cliente?')) return
    await supabase.from('clientes').update({ activo: false }).eq('id', id)
    toast.success('Cliente eliminado')
    load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.empresa?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm">{clientes.length} clientes registrados</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo cliente</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Sin clientes aún</p>
          <p className="text-slate-400 text-sm mb-4">Agrega tu primer cliente</p>
          <button onClick={() => openModal()} className="btn-primary"><Plus className="w-4 h-4" /> Agregar cliente</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-700">{c.nombre[0].toUpperCase()}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openModal(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="font-semibold text-slate-800">{c.nombre}</p>
              {c.empresa && <p className="text-xs text-slate-500">{c.empresa}</p>}
              {c.email && <p className="text-xs text-slate-400 mt-1">{c.email}</p>}
              {c.telefono && <p className="text-xs text-slate-400">{c.telefono}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Nombre *</label><input className="input" required value={form.nombre} onChange={set('nombre')} /></div>
                <div><label className="label">Empresa</label><input className="input" value={form.empresa} onChange={set('empresa')} /></div>
                <div><label className="label">RFC</label><input className="input" value={form.rfc} onChange={set('rfc')} /></div>
                <div className="col-span-2"><label className="label">Razón social</label><input className="input" value={form.razon_social} onChange={set('razon_social')} /></div>
                <div className="col-span-2"><label className="label">Correo</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
                <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={set('telefono')} /></div>
                <div><label className="label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={set('whatsapp')} /></div>
                <div><label className="label">País</label>
                  <select className="input" value={form.pais} onChange={set('pais')}>
                    <option value="MX">México</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option><option value="PE">Perú</option><option value="US">Estados Unidos</option>
                  </select>
                </div>
                <div><label className="label">C.P.</label><input className="input" value={form.codigo_postal} onChange={set('codigo_postal')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
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
