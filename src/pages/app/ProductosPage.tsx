import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react'

const emptyForm = { nombre: '', descripcion: '', precio: 0, unidad: 'servicio', iva: 16 }

export default function ProductosPage() {
  const { user } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('productos').select('*').eq('user_id', user.id).eq('activo', true).order('nombre')
    setProductos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const openModal = (p?: any) => {
    setEditing(p ?? null)
    setForm(p ? { nombre: p.nombre, descripcion: p.descripcion ?? '', precio: p.precio, unidad: p.unidad, iva: p.iva } : { ...emptyForm })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    if (editing) {
      await supabase.from('productos').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
      toast.success('Producto actualizado')
    } else {
      await supabase.from('productos').insert({ ...form, user_id: user.id })
      toast.success('Producto creado')
    }
    setModal(false)
    load()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    toast.success('Producto eliminado')
    load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = productos.filter(p =>
    p.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos y Servicios</h1>
          <p className="text-slate-500 text-sm">{productos.length} productos en catálogo</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo producto</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Sin productos aún</p>
          <button onClick={() => openModal()} className="btn-primary mt-4"><Plus className="w-4 h-4" /> Agregar producto</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Precio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unidad</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">IVA</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-slate-400">{p.descripcion}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(p.precio)}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{p.unidad}</td>
                  <td className="px-4 py-3 text-slate-500">{p.iva}%</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openModal(p)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Nombre *</label><input className="input" required value={form.nombre} onChange={set('nombre')} /></div>
              <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.descripcion} onChange={set('descripcion') as any} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Precio</label><input type="number" className="input" min="0" step="0.01" value={form.precio} onChange={set('precio')} /></div>
                <div><label className="label">Unidad</label>
                  <select className="input" value={form.unidad} onChange={set('unidad')}>
                    <option value="servicio">Servicio</option><option value="pieza">Pieza</option><option value="hora">Hora</option><option value="mes">Mes</option><option value="proyecto">Proyecto</option>
                  </select>
                </div>
                <div><label className="label">IVA %</label><input type="number" className="input" min="0" step="1" value={form.iva} onChange={set('iva')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? 'Guardar' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
