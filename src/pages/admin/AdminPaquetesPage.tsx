import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, X, Star } from 'lucide-react'

export default function AdminPaquetesPage() {
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', folios: 100, precio: 149, moneda: 'MXN', popular: false, activo: true, orden: 1 })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('paquetes_folios').select('*').order('orden')
    setPaquetes(data ?? [])
  }

  useEffect(() => { load() }, [])

  const openModal = (p?: any) => {
    setEditing(p ?? null)
    setForm(p ? { nombre: p.nombre, folios: p.folios, precio: p.precio, moneda: p.moneda, popular: p.popular, activo: p.activo, orden: p.orden } : { nombre: '', folios: 100, precio: 149, moneda: 'MXN', popular: false, activo: true, orden: paquetes.length + 1 })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await supabase.from('paquetes_folios').update(form).eq('id', editing.id)
      toast.success('Paquete actualizado')
    } else {
      await supabase.from('paquetes_folios').insert(form)
      toast.success('Paquete creado')
    }
    setModal(false)
    load()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar paquete?')) return
    await supabase.from('paquetes_folios').delete().eq('id', id)
    toast.success('Paquete eliminado')
    load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paquetes de Folios</h1>
          <p className="text-slate-500 text-sm">Configura los planes disponibles para los usuarios</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo paquete</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {paquetes.map(p => (
          <div key={p.id} className={`card p-5 relative ${p.popular ? 'border-primary-300 ring-2 ring-primary-200' : ''}`}>
            {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="badge bg-primary-600 text-white px-3 py-1 flex items-center gap-1"><Star className="w-3 h-3" />Popular</span></div>}
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-800 mt-2">{p.folios}</p>
              <p className="text-xs text-slate-500 mb-2">folios</p>
              <p className="text-2xl font-bold text-primary-600 mb-1">{formatCurrency(p.precio, p.moneda)}</p>
              <p className="text-xs text-slate-400 mb-4">{p.nombre}</p>
              <span className={`badge ${p.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openModal(p)} className="btn-secondary flex-1 justify-center text-xs"><Edit2 className="w-3.5 h-3.5" />Editar</button>
              <button onClick={() => handleDelete(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">{editing ? 'Editar paquete' : 'Nuevo paquete'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Nombre</label><input className="input" required value={form.nombre} onChange={set('nombre')} placeholder="Pack 100" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Folios</label><input type="number" className="input" min="1" value={form.folios} onChange={set('folios')} /></div>
                <div><label className="label">Precio</label><input type="number" className="input" min="0" step="0.01" value={form.precio} onChange={set('precio')} /></div>
                <div><label className="label">Moneda</label>
                  <select className="input" value={form.moneda} onChange={set('moneda')}>
                    <option value="MXN">MXN</option><option value="USD">USD</option>
                  </select>
                </div>
                <div><label className="label">Orden</label><input type="number" className="input" min="1" value={form.orden} onChange={set('orden')} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.popular} onChange={set('popular')} className="w-4 h-4" />
                  Marcar como popular
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={set('activo')} className="w-4 h-4" />
                  Activo
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
