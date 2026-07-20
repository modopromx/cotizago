import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Package, X, ArrowRight } from 'lucide-react'

const emptyForm = { nombre: '', descripcion: '', precio: 0, unidad: 'servicio', iva: 16 }

const UNIDAD_LABEL: Record<string, string> = {
  servicio: 'Servicio', pieza: 'Pieza', hora: 'Hora', mes: 'Suscripción', proyecto: 'Proyecto',
}

export default function ProductosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
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
    setModal(false); load(); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    toast.success('Producto eliminado'); load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = productos.filter(p =>
    [p.nombre, p.descripcion].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Productos y servicios</h1>
          <p className="text-slate-500 text-sm">Crea un catálogo para cotizar más rápido y sin errores.</p>
        </div>
        <button onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" /> Nuevo concepto</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar productos y servicios..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">{productos.length === 0 ? 'Sin conceptos aún' : 'Sin resultados'}</p>
          <p className="text-slate-400 text-sm mb-4">Crea conceptos reutilizables para tus cotizaciones</p>
          <button onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" /> Nuevo concepto</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card p-5 flex flex-col hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <span className="badge bg-primary-50 text-primary-700 uppercase text-[10px] tracking-wide">{UNIDAD_LABEL[p.unidad] ?? p.unidad}</span>
                <div className="flex gap-1">
                  <button onClick={() => openModal(p)} className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{p.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2 flex-1">
                {p.descripcion || 'Concepto reutilizable listo para agregar a cualquier cotización.'}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-lg font-extrabold text-navy-900">{formatCurrency(p.precio)}</p>
                  <p className="text-[11px] text-slate-400">IVA {p.iva}%</p>
                </div>
                <span className="badge bg-success-50 text-success-600">Activo</span>
              </div>
              <button onClick={() => navigate('/app/cotizaciones/nueva')}
                className="mt-4 text-xs font-medium text-primary-600 inline-flex items-center gap-1 hover:gap-2 transition-all">
                Agregar a cotización <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">{editing ? 'Editar concepto' : 'Nuevo concepto'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Nombre *</label><input className="input" required value={form.nombre} onChange={set('nombre')} /></div>
              <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.descripcion} onChange={set('descripcion') as any} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Precio</label><input type="number" className="input" min="0" step="0.01" value={form.precio} onChange={set('precio')} /></div>
                <div><label className="label">Unidad</label>
                  <select className="input" value={form.unidad} onChange={set('unidad')}>
                    <option value="servicio">Servicio</option><option value="pieza">Pieza</option><option value="hora">Hora</option><option value="mes">Suscripción</option><option value="proyecto">Proyecto</option>
                  </select>
                </div>
                <div><label className="label">IVA %</label><input type="number" className="input" min="0" step="1" value={form.iva} onChange={set('iva')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? 'Guardar' : 'Crear concepto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
