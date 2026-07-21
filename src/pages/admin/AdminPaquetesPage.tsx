import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, X, Star, Package, Save } from 'lucide-react'

export default function AdminPaquetesPage() {
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [ventas, setVentas] = useState<Record<string, { n: number; monto: number }>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [beneficiosText, setBeneficiosText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: paks }, { data: pagos }] = await Promise.all([
      supabase.from('paquetes_folios').select('*').order('orden'),
      supabase.from('pagos').select('paquete_nombre,monto,estado').eq('tipo', 'folio_topup'),
    ])
    const v: Record<string, { n: number; monto: number }> = {}
    ;(pagos ?? []).forEach((p: any) => {
      if (!p.paquete_nombre || p.estado === 'pendiente') return
      v[p.paquete_nombre] = v[p.paquete_nombre] ?? { n: 0, monto: 0 }
      v[p.paquete_nombre].n++
      v[p.paquete_nombre].monto += Number(p.monto) || 0
    })
    setPaquetes(paks ?? []); setVentas(v); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openModal = (p?: any) => {
    setEditing(p ?? null)
    setForm(p
      ? { nombre: p.nombre, folios: p.folios, precio: p.precio, moneda: p.moneda, popular: p.popular, activo: p.activo, orden: p.orden, descripcion: p.descripcion ?? '' }
      : { nombre: '', folios: 100, precio: 149, moneda: 'MXN', popular: false, activo: true, orden: paquetes.length + 1, descripcion: '' })
    setBeneficiosText((p?.beneficios ?? []).join('\n'))
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      // Los inputs numéricos entregan texto; la landing calcula con estos valores.
      folios: Number(form.folios) || 0,
      precio: Number(form.precio) || 0,
      orden: Number(form.orden) || 1,
      beneficios: beneficiosText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    const { error } = editing
      ? await supabase.from('paquetes_folios').update(payload).eq('id', editing.id)
      : await supabase.from('paquetes_folios').insert(payload)
    if (error) toast.error('Error: ' + error.message)
    else { toast.success(editing ? 'Paquete actualizado' : 'Paquete creado'); setModal(false); load() }
    setSaving(false)
  }

  const toggleActivo = async (p: any) => {
    await supabase.from('paquetes_folios').update({ activo: !p.activo }).eq('id', p.id)
    toast.success(p.activo ? 'Paquete oculto de la venta' : 'Paquete publicado')
    load()
  }

  const handleDelete = async (p: any) => {
    const vendidos = ventas[p.nombre]?.n ?? 0
    const aviso = vendidos > 0
      ? `Este paquete tiene ${vendidos} venta(s) registrada(s). Eliminarlo no las borra, pero el paquete desaparece para siempre.\n\nSi solo quieres dejar de venderlo, usa "Ocultar" en lugar de eliminarlo.\n\n¿Eliminar de todos modos?`
      : `¿Eliminar el paquete "${p.nombre}"? Esta acción no se puede deshacer.`
    if (!confirm(aviso)) return
    const { error } = await supabase.from('paquetes_folios').delete().eq('id', p.id)
    if (error) toast.error('No se pudo eliminar: ' + error.message)
    else { toast.success('Paquete eliminado'); load() }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const totalVendido = Object.values(ventas).reduce((s, v) => s + v.monto, 0)
  const totalCompras = Object.values(ventas).reduce((s, v) => s + v.n, 0)

  const kpis = [
    { label: 'Paquetes publicados', value: paquetes.filter(p => p.activo).length, sub: `${paquetes.length} en total` },
    { label: 'Compras registradas', value: totalCompras },
    { label: 'Ingresos por folios', value: formatCurrency(totalVendido) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Paquetes de folios</h1>
          <p className="text-slate-500 text-sm">Lo que ve el cliente en la landing y al recargar. Los cambios se reflejan al instante.</p>
        </div>
        <button onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" /> Nuevo paquete</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : paquetes.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">Sin paquetes</p>
          <p className="text-sm text-slate-400 mt-1">Crea al menos uno para que tus usuarios puedan comprar folios.</p>
          <button onClick={() => openModal()} className="btn-navy mt-4"><Plus className="w-4 h-4" /> Nuevo paquete</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paquetes.map(p => {
            const v = ventas[p.nombre] ?? { n: 0, monto: 0 }
            return (
              <div key={p.id} className={`card p-5 flex flex-col relative ${p.popular ? 'ring-2 ring-primary-200' : ''} ${!p.activo ? 'opacity-60' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge bg-primary-600 text-white px-3 py-1 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Más elegido
                    </span>
                  </div>
                )}
                <div className="text-center pt-2">
                  <p className="text-3xl font-extrabold text-navy-900">{p.folios}</p>
                  <p className="text-xs text-slate-400 mb-2">folios</p>
                  <p className="text-2xl font-bold text-primary-600">{formatCurrency(p.precio, p.moneda)}</p>
                  <p className="text-sm font-medium text-navy-800 mt-1">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-slate-400 mt-0.5">{p.descripcion}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{v.n} compra{v.n === 1 ? '' : 's'}</span>
                  <span className="font-semibold text-navy-900">{formatCurrency(v.monto)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button onClick={() => toggleActivo(p)}
                    className={`badge ${p.activo ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-500'}`}>
                    {p.activo ? 'A la venta' : 'Oculto'}
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(p)} className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">{editing ? 'Editar paquete' : 'Nuevo paquete'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Nombre</label><input className="input" required value={form.nombre ?? ''} onChange={set('nombre')} placeholder="Negocio" /></div>
              <div><label className="label">Descripción</label><input className="input" value={form.descripcion ?? ''} onChange={set('descripcion')} placeholder="Para ventas constantes" /></div>
              <div>
                <label className="label">Beneficios (uno por línea)</label>
                <textarea className="input resize-none" rows={3} value={beneficiosText} onChange={e => setBeneficiosText(e.target.value)}
                  placeholder={'PDFs personalizados\nWhatsApp y email\nSin fecha de caducidad'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Folios</label><input type="number" className="input" min="1" required value={form.folios ?? ''} onChange={set('folios')} /></div>
                <div><label className="label">Precio</label><input type="number" className="input" min="0" step="0.01" required value={form.precio ?? ''} onChange={set('precio')} /></div>
                <div><label className="label">Moneda</label>
                  <select className="input" value={form.moneda ?? 'MXN'} onChange={set('moneda')}>
                    <option value="MXN">MXN</option><option value="USD">USD</option>
                  </select>
                </div>
                <div><label className="label">Orden</label><input type="number" className="input" min="1" value={form.orden ?? 1} onChange={set('orden')} /></div>
              </div>
              {Number(form.folios) > 0 && Number(form.precio) > 0 && (
                <p className="text-[11px] text-slate-400">
                  Sale a {formatCurrency(Number(form.precio) / Number(form.folios), form.moneda)} por folio.
                </p>
              )}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                  <input type="checkbox" checked={!!form.popular} onChange={set('popular')} className="rounded border-slate-300" />
                  Más elegido
                </label>
                <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                  <input type="checkbox" checked={form.activo ?? true} onChange={set('activo')} className="rounded border-slate-300" />
                  A la venta
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
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
