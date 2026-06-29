import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

interface Item { id?: string; nombre: string; descripcion: string; cantidad: number; precio_unitario: number; iva_porcentaje: number; subtotal: number }

export default function EditarCotizacionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cot, setCot] = useState<any>(null)
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [productos, setProductos] = useState<any[]>([])

  useEffect(() => {
    if (!user || !id) return
    supabase.from('cotizaciones').select('*').eq('id', id).eq('user_id', user.id).single().then(({ data }) => { if (data) setCot(data) })
    supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden').then(({ data }) => setItems(data ?? []))
    supabase.from('productos').select('*').eq('user_id', user.id).eq('activo', true).then(({ data }) => setProductos(data ?? []))
  }, [user, id])

  const setItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      const it = next[i]
      it.subtotal = it.cantidad * it.precio_unitario * (1 + it.iva_porcentaje / 100)
      return next
    })
  }

  const subtotalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descMonto = subtotalBruto * ((cot?.descuento_porcentaje ?? 0) / 100)
  const impuestos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (i.iva_porcentaje / 100), 0)
  const total = subtotalBruto - descMonto + impuestos

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    await supabase.from('cotizaciones').update({ subtotal: subtotalBruto, impuestos, total, notas: cot.notas, terminos: cot.terminos, updated_at: new Date().toISOString() }).eq('id', id)
    // Delete old items and reinsert
    await supabase.from('cotizacion_items').delete().eq('cotizacion_id', id)
    await supabase.from('cotizacion_items').insert(items.map((it, idx) => {
      const { id: _id, ...rest } = it
      return { cotizacion_id: id, ...rest, orden: idx }
    }))
    toast.success('Cotización actualizada')
    navigate('/app/cotizaciones')
    setSaving(false)
  }

  if (!cot) return <div className="card p-8 text-center text-slate-500">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar cotización</h1>
          <p className="text-slate-500 text-sm font-mono">{cot.numero}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Conceptos</h2>
            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex gap-2">
                    <input className="input flex-1" placeholder="Nombre" value={item.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} />
                    <select className="input w-40" onChange={e => {
                      const p = productos.find(p => p.id === e.target.value)
                      if (p) { setItem(i, 'nombre', p.nombre); setItem(i, 'precio_unitario', p.precio); setItem(i, 'iva_porcentaje', p.iva) }
                    }} defaultValue="">
                      <option value="">Catálogo</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {items.length > 1 && (
                      <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea className="input resize-none" rows={2} placeholder="Descripción" value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="label text-xs">Cantidad</label><input type="number" className="input" value={item.cantidad} onChange={e => setItem(i, 'cantidad', parseFloat(e.target.value) || 0)} /></div>
                    <div><label className="label text-xs">Precio</label><input type="number" className="input" value={item.precio_unitario} onChange={e => setItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)} /></div>
                    <div><label className="label text-xs">IVA %</label><input type="number" className="input" value={item.iva_porcentaje} onChange={e => setItem(i, 'iva_porcentaje', parseFloat(e.target.value) || 0)} /></div>
                  </div>
                  <div className="text-right text-sm font-semibold">{formatCurrency(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setItems(p => [...p, { nombre:'', descripcion:'', cantidad:1, precio_unitario:0, iva_porcentaje:16, subtotal:0 }])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" /> Agregar concepto
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Notas y términos</h2>
            <textarea className="input resize-none" rows={3} placeholder="Notas..." value={cot.notas ?? ''} onChange={e => setCot((c: any) => ({ ...c, notas: e.target.value }))} />
            <textarea className="input resize-none" rows={2} placeholder="Términos..." value={cot.terminos ?? ''} onChange={e => setCot((c: any) => ({ ...c, terminos: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotalBruto)}</span></div>
              <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(impuestos)}</span></div>
              <div className="flex justify-between font-bold text-slate-800 border-t pt-2 mt-2 text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <Save className="w-4 h-4" /> Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
