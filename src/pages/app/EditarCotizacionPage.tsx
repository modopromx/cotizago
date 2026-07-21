import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2, Plus, AlertTriangle, Package } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

interface Item { id?: string; nombre: string; descripcion: string; cantidad: number; precio_unitario: number; iva_porcentaje: number; subtotal: number }

const nuevoItem = (): Item => ({ nombre: '', descripcion: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: 16, subtotal: 0 })

export default function EditarCotizacionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cot, setCot] = useState<any>(null)
  const [items, setItems] = useState<Item[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    supabase.from('cotizaciones').select('*').eq('id', id).single().then(({ data }) => { if (data) setCot(data) })
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

  const usarProducto = (i: number, prodId: string) => {
    const p = productos.find(p => p.id === prodId)
    if (!p) return
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], nombre: p.nombre, descripcion: p.descripcion ?? '', precio_unitario: p.precio, iva_porcentaje: p.iva }
      const it = next[i]
      it.subtotal = it.cantidad * it.precio_unitario * (1 + it.iva_porcentaje / 100)
      return next
    })
  }

  const descuento = Number(cot?.descuento_porcentaje) || 0
  const moneda = cot?.moneda || 'MXN'
  const subtotalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descMonto = subtotalBruto * (descuento / 100)
  // El descuento también reduce el IVA, igual que al crear la cotización.
  const impuestos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (i.iva_porcentaje / 100), 0) * (1 - descuento / 100)
  const total = subtotalBruto - descMonto + impuestos

  const yaEnviada = cot && !['borrador'].includes(cot.estado)
  const faltanNombres = items.some(i => !i.nombre.trim())

  const handleSave = async () => {
    if (!id) return
    setIntentado(true)
    if (items.length === 0) { toast.error('La cotización necesita al menos un concepto'); return }
    if (faltanNombres) { toast.error('Todos los conceptos deben tener nombre'); return }

    setSaving(true)
    // Una sola llamada transaccional: reemplaza conceptos y recalcula totales.
    // Si algo falla, la cotización queda intacta.
    const { error } = await supabase.rpc('guardar_cotizacion', {
      p_cotizacion: id,
      p_items: items.map(({ id: _id, ...rest }) => rest),
      p_notas: cot.notas ?? '',
      p_terminos: cot.terminos ?? '',
      p_descuento: descuento,
    })
    if (error) toast.error('No se pudo guardar: ' + error.message)
    else { toast.success('Cotización actualizada'); navigate('/app/cotizaciones') }
    setSaving(false)
  }

  if (!cot) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28 lg:pb-0">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Editar cotización</h1>
          <p className="text-slate-500 text-sm font-mono">{cot.numero}</p>
        </div>
      </div>

      {yaEnviada && (
        <div className="card p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600">
            Esta cotización ya se envió. Si la modificas, cambia también lo que ve tu cliente en el enlace
            que ya le compartiste, y el PDF que descargue será distinto al que recibió.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-900">Conceptos</h2>
              <span className="text-xs text-slate-400">{items.length} {items.length === 1 ? 'concepto' : 'conceptos'}</span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Esta cotización no tiene conceptos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, i) => {
                  const falta = intentado && !item.nombre.trim()
                  return (
                    <div key={i} className={`rounded-xl p-4 border ${falta ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className="w-6 h-6 rounded-md bg-fondo text-navy-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-2">{i + 1}</span>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input className="input flex-1" placeholder="Nombre del concepto"
                              value={item.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} />
                            {productos.length > 0 && (
                              <select className="input sm:w-44" value="" onChange={e => { usarProducto(i, e.target.value); e.target.value = '' }}>
                                <option value="">Del catálogo...</option>
                                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </select>
                            )}
                          </div>
                          <textarea className="input resize-none" rows={2} placeholder="Descripción (opcional)"
                            value={item.descripcion ?? ''} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="label text-xs">Cantidad</label>
                              <input type="number" className="input" min="0.01" step="0.01" value={item.cantidad}
                                onChange={e => setItem(i, 'cantidad', parseFloat(e.target.value) || 0)} /></div>
                            <div><label className="label text-xs">Precio unitario</label>
                              <input type="number" className="input" min="0" step="0.01" value={item.precio_unitario}
                                onChange={e => setItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)} /></div>
                            <div><label className="label text-xs">IVA %</label>
                              <input type="number" className="input" min="0" step="1" value={item.iva_porcentaje}
                                onChange={e => setItem(i, 'iva_porcentaje', parseFloat(e.target.value) || 0)} /></div>
                          </div>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          title="Quitar concepto"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-1.5 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right text-sm font-semibold text-navy-900 mt-2">
                        {formatCurrency(item.subtotal, moneda)}
                        <span className="text-[11px] font-normal text-slate-400"> con IVA</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={() => setItems(p => [...p, nuevoItem()])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" /> Agregar concepto
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Notas y términos</h2>
            <div>
              <label className="label">Notas para el cliente</label>
              <textarea className="input resize-none" rows={3} placeholder="Instrucciones de pago, condiciones especiales..."
                value={cot.notas ?? ''} onChange={e => setCot((c: any) => ({ ...c, notas: e.target.value }))} />
            </div>
            <div>
              <label className="label">Términos y condiciones</label>
              <textarea className="input resize-none" rows={2} value={cot.terminos ?? ''}
                onChange={e => setCot((c: any) => ({ ...c, terminos: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Detalles</h2>
            <div>
              <label className="label">Descuento %</label>
              <input type="number" className="input" min="0" max="100" step="1" value={descuento}
                onChange={e => setCot((c: any) => ({ ...c, descuento_porcentaje: parseFloat(e.target.value) || 0 }))} />
            </div>
            <p className="text-[11px] text-slate-400">Moneda: {moneda}</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotalBruto, moneda)}</span></div>
              {descuento > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Descuento ({descuento}%)</span><span>−{formatCurrency(descMonto, moneda)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(impuestos, moneda)}</span></div>
              <div className="flex justify-between font-extrabold text-navy-900 border-t border-slate-200 pt-2 mt-2 text-base">
                <span>Total</span><span>{formatCurrency(total, moneda)}</span>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="hidden lg:flex btn-navy w-full justify-center py-2.5">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Total</span>
          <span className="font-extrabold text-navy-900">{formatCurrency(total, moneda)}</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-navy w-full justify-center text-sm">
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
