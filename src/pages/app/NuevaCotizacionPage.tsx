import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Trash2, Save, ArrowLeft, Search } from 'lucide-react'

interface Item { nombre: string; descripcion: string; cantidad: number; precio_unitario: number; iva_porcentaje: number; subtotal: number }

const emptyItem = (): Item => ({ nombre: '', descripcion: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: 16, subtotal: 0 })

export default function NuevaCotizacionPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [form, setForm] = useState({
    fecha_vencimiento: '',
    notas: '',
    terminos: 'Precios en MXN. Vigencia de 15 días. Precios no incluyen IVA salvo indicación.',
    descuento_porcentaje: 0,
    moneda: 'MXN',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('clientes').select('id,nombre,empresa,email,whatsapp,rfc,razon_social,pais,codigo_postal').eq('user_id', user.id).eq('activo', true).then(({ data }) => setClientes(data ?? []))
    supabase.from('productos').select('*').eq('user_id', user.id).eq('activo', true).then(({ data }) => setProductos(data ?? []))
  }, [user])

  const setItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      const it = next[i]
      it.subtotal = it.cantidad * it.precio_unitario * (1 + it.iva_porcentaje / 100)
      return next
    })
  }

  const addProductoToItem = (i: number, prodId: string) => {
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

  const subtotalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descMonto = subtotalBruto * (form.descuento_porcentaje / 100)
  const subtotalNeto = subtotalBruto - descMonto
  const impuestos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (i.iva_porcentaje / 100), 0) * (1 - form.descuento_porcentaje / 100)
  const total = subtotalNeto + impuestos

  const handleSave = async (estado: 'borrador' | 'enviada') => {
    if (!user) return
    if (items.some(i => !i.nombre)) { toast.error('Todos los conceptos deben tener nombre'); return }
    if (estado === 'enviada' && (profile?.folios_balance ?? 0) < 1) {
      toast.error('No tienes folios disponibles. Recarga para enviar cotizaciones.')
      return
    }

    setSaving(true)
    const numero = await supabase.rpc('generate_cotizacion_number', { user_uuid: user.id })
    const cliente = clientes.find(c => c.id === clienteId)

    const { data: cot, error } = await supabase.from('cotizaciones').insert({
      user_id: user.id,
      cliente_id: clienteId || null,
      numero: numero.data,
      fecha_vencimiento: form.fecha_vencimiento || null,
      moneda: form.moneda,
      notas: form.notas,
      terminos: form.terminos,
      subtotal: subtotalBruto,
      descuento_porcentaje: form.descuento_porcentaje,
      descuento_monto: descMonto,
      impuestos,
      total,
      estado,
      folio_consumido: estado === 'enviada',
      cliente_nombre: cliente?.nombre ?? '',
      cliente_empresa: cliente?.empresa ?? '',
      cliente_email: cliente?.email ?? '',
      cliente_whatsapp: cliente?.whatsapp ?? '',
      cliente_pais: cliente?.pais ?? '',
      cliente_cp: cliente?.codigo_postal ?? '',
      cliente_rfc: cliente?.rfc ?? '',
      cliente_razon_social: cliente?.razon_social ?? '',
    }).select('id').single()

    if (error) { toast.error('Error al guardar: ' + error.message); setSaving(false); return }

    // Items
    await supabase.from('cotizacion_items').insert(
      items.map((it, idx) => ({ cotizacion_id: cot.id, ...it, orden: idx }))
    )

    // Descontar folio si enviada
    if (estado === 'enviada') {
      await supabase.from('profiles').update({ folios_balance: (profile!.folios_balance - 1) }).eq('id', user.id)
      await refreshProfile()
    }

    toast.success(estado === 'enviada' ? 'Cotización enviada ✓' : 'Borrador guardado')
    navigate('/app/cotizaciones')
    setSaving(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nueva cotización</h1>
          <p className="text-slate-500 text-sm">Folios disponibles: <strong>{profile?.folios_balance ?? 0}</strong></p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cliente */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Cliente</h2>
            <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">— Seleccionar cliente (opcional) —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.empresa ? `· ${c.empresa}` : ''}</option>)}
            </select>
          </div>

          {/* Conceptos */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Conceptos</h2>
            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input className="input flex-1" placeholder="Nombre del concepto" value={item.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} />
                        <select className="input w-48" onChange={e => addProductoToItem(i, e.target.value)} defaultValue="">
                          <option value="">Catálogo...</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <textarea className="input resize-none" rows={2} placeholder="Descripción (opcional)" value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label text-xs">Cantidad</label>
                          <input type="number" className="input" min="0.01" step="0.01" value={item.cantidad} onChange={e => setItem(i, 'cantidad', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label text-xs">Precio unitario</label>
                          <input type="number" className="input" min="0" step="0.01" value={item.precio_unitario} onChange={e => setItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="label text-xs">IVA %</label>
                          <input type="number" className="input" min="0" step="1" value={item.iva_porcentaje} onChange={e => setItem(i, 'iva_porcentaje', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 mt-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-700">{formatCurrency(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" /> Agregar concepto
            </button>
          </div>

          {/* Notas */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Notas y términos</h2>
            <div>
              <label className="label">Notas para el cliente</label>
              <textarea className="input resize-none" rows={3} placeholder="Instrucciones de pago, condiciones especiales..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div>
              <label className="label">Términos y condiciones</label>
              <textarea className="input resize-none" rows={2} value={form.terminos} onChange={e => setForm(f => ({ ...f, terminos: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Detalles</h2>
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="MXN">MXN - Peso mexicano</option>
                <option value="USD">USD - Dólar americano</option>
                <option value="COP">COP - Peso colombiano</option>
              </select>
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input type="date" className="input" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Descuento %</label>
              <input type="number" className="input" min="0" max="100" step="1" value={form.descuento_porcentaje} onChange={e => setForm(f => ({ ...f, descuento_porcentaje: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          {/* Totales */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotalBruto)}</span></div>
              {form.descuento_porcentaje > 0 && <div className="flex justify-between text-green-600"><span>Descuento ({form.descuento_porcentaje}%)</span><span>-{formatCurrency(descMonto)}</span></div>}
              <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(impuestos)}</span></div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2 mt-2 text-base">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={() => handleSave('enviada')} disabled={saving} className="btn-primary w-full justify-center py-2.5">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              Enviar cotización (1 folio)
            </button>
            <button onClick={() => handleSave('borrador')} disabled={saving} className="btn-secondary w-full justify-center">
              <Save className="w-4 h-4" /> Guardar borrador
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
