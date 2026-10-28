import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal'
import { Plus, Search, Edit2, Trash2, Package, ArrowRight } from 'lucide-react'

const emptyForm = { nombre: '', descripcion: '', precio: 0, unidad: 'servicio', iva: 16 }

export default function ProductosPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const wsId = profile?.workspace_id
  const navigate = useNavigate()
  const [productos, setProductos] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    // Aísla al workspace propio (el superadmin no ve productos de otros aquí).
    if (!user || !wsId) return
    const { data } = await supabase.from('productos').select('*').eq('workspace_id', wsId).eq('activo', true).order('nombre')
    setProductos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user, wsId])

  const openModal = (p?: any) => {
    setEditing(p ?? null)
    setForm(p ? { nombre: p.nombre, descripcion: p.descripcion ?? '', precio: p.precio, unidad: p.unidad, iva: p.iva } : { ...emptyForm })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    // Los campos numéricos se editan como texto (se pueden vaciar); aquí se convierten.
    const datos = { ...form, precio: Number(form.precio) || 0, iva: Number(form.iva) || 0 }
    if (editing) {
      await supabase.from('productos').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', editing.id)
      toast.success(t('prod.actualizado'))
    } else {
      await supabase.from('productos').insert({ ...datos, user_id: user.id })
      toast.success(t('prod.creado'))
    }
    setModal(false); load(); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('prod.confEliminar'))) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    toast.success(t('prod.eliminado')); load()
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
          <h1 className="text-2xl font-bold text-navy-900">{t('prod.title')}</h1>
          <p className="text-slate-500 text-sm">{t('prod.subtitle')}</p>
        </div>
        <button data-tour="prod-nuevo" onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('prod.nuevo')}</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
        <input type="search" aria-label={t('prod.buscar')} className="input pl-9" placeholder={t('prod.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">{t('prod.cargando')}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">{productos.length === 0 ? t('prod.sinConceptos') : t('prod.sinResultados')}</p>
          <p className="text-slate-500 text-sm mb-4">{t('prod.crearReutil')}</p>
          <button onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('prod.nuevo')}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card p-5 flex flex-col hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <span className="badge bg-primary-50 text-primary-700 uppercase text-[10px] tracking-wide">{t(`prod.${p.unidad}`, { defaultValue: p.unidad })}</span>
                <div className="flex gap-1">
                  <button onClick={() => openModal(p)} aria-label={`Editar ${p.nombre}`} className="p-2 text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  <button onClick={() => handleDelete(p.id)} aria-label={`Eliminar ${p.nombre}`} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-navy-900">{p.nombre}</h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2 flex-1">
                {p.descripcion || t('prod.descDefault')}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-lg font-extrabold text-navy-900">{formatCurrency(p.precio)}</p>
                  <p className="text-[11px] text-slate-500">{t('prod.iva')} {p.iva}%</p>
                </div>
                <span className="badge bg-success-50 text-success-700">{t('prod.activo')}</span>
              </div>
              <button onClick={() => navigate('/app/cotizaciones/nueva')}
                className="mt-4 text-xs font-medium text-primary-700 inline-flex items-center gap-1 hover:gap-2 transition-all">
                {t('prod.agregarA')} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal ancho="max-w-md" onClose={() => setModal(false)} sinCerrar={saving}
          titulo={editing ? t('prod.editarConcepto') : t('prod.nuevoConcepto')}>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label htmlFor="prod-nombre" className="label">{t('prod.nombre')}</label><input id="prod-nombre" className="input" required value={form.nombre} onChange={set('nombre')} /></div>
              <div><label htmlFor="prod-descripcion" className="label">{t('prod.descripcion')}</label><textarea id="prod-descripcion" className="input resize-none" rows={2} value={form.descripcion} onChange={set('descripcion') as any} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label htmlFor="prod-precio" className="label">{t('prod.precio')}</label><input id="prod-precio" type="number" inputMode="decimal" className="input" min="0" step="0.01" value={form.precio} onChange={set('precio')} /></div>
                <div><label htmlFor="prod-unidad" className="label">{t('prod.unidad')}</label>
                  <select id="prod-unidad" className="input" value={form.unidad} onChange={set('unidad')}>
                    <option value="servicio">{t('prod.servicio')}</option><option value="pieza">{t('prod.pieza')}</option><option value="hora">{t('prod.hora')}</option><option value="mes">{t('prod.mes')}</option><option value="proyecto">{t('prod.proyecto')}</option>
                  </select>
                </div>
                <div><label htmlFor="prod-ivaPct" className="label">{t('prod.ivaPct')}</label><input id="prod-ivaPct" type="number" inputMode="numeric" className="input" min="0" step="1" value={form.iva} onChange={set('iva')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">{t('prod.cancelar')}</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving && <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? t('prod.guardar') : t('prod.crear')}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
