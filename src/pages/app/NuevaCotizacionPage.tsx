import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { avisarSaldoFolios } from '../../lib/envios'
import toast from 'react-hot-toast'
import { Plus, Trash2, Save, ArrowLeft, Send, AlertTriangle, UserPlus, Package } from 'lucide-react'

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
  const [intentado, setIntentado] = useState(false)

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

  const cliente = useMemo(() => clientes.find(c => c.id === clienteId), [clientes, clienteId])
  const folios = profile?.folios_balance ?? 0
  const sinFolios = folios < 1
  const faltanNombres = items.some(i => !i.nombre.trim())
  // Sin correo ni WhatsApp no hay forma de hacerle llegar la cotización.
  const sinContacto = !!cliente && !cliente.email && !cliente.whatsapp
  const moneda = form.moneda

  const handleSave = async (estado: 'borrador' | 'enviada') => {
    if (!user) return
    setIntentado(true)
    if (faltanNombres) { toast.error('Todos los conceptos deben tener nombre'); return }
    if (estado === 'enviada' && sinFolios) {
      toast.error('No tienes folios disponibles. Recarga para enviar cotizaciones.')
      return
    }

    setSaving(true)
    const numero = await supabase.rpc('generate_cotizacion_number', { user_uuid: user.id })

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
      // Siempre se inserta como borrador; el envío (y el consumo de folio) lo
      // hace la función enviar_cotizacion en el servidor, de forma atómica.
      estado: 'borrador',
      folio_consumido: false,
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

    await supabase.from('cotizacion_items').insert(
      items.map((it, idx) => ({ cotizacion_id: cot.id, ...it, orden: idx }))
    )

    // Enviar: consume un folio de forma atómica en el servidor (RPC).
    if (estado === 'enviada') {
      const { error: envError } = await supabase.rpc('enviar_cotizacion', { cotizacion_uuid: cot.id })
      if (envError) {
        toast.error(envError.message.includes('folios') ? 'No tienes folios disponibles.' : 'No se pudo enviar: ' + envError.message)
        // La cotización queda guardada como borrador; el usuario puede reintentar.
        navigate('/app/cotizaciones')
        setSaving(false)
        return
      }
      await refreshProfile()
      const { data: p } = await supabase.from('profiles').select('folios_balance,email,nombre').eq('id', user.id).single()
      if (p) avisarSaldoFolios(p.folios_balance ?? 0, p.email, p.nombre ?? undefined)
    }

    toast.success(estado === 'enviada' ? 'Cotización enviada ✓' : 'Borrador guardado')
    navigate('/app/cotizaciones')
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28 lg:pb-0">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">Nueva cotización</h1>
          <p className="text-slate-500 text-sm">
            Te quedan <strong className={sinFolios ? 'text-red-600' : 'text-navy-900'}>{folios}</strong> folio{folios === 1 ? '' : 's'}.
            Enviar consume 1; guardar borrador no consume.
          </p>
        </div>
      </div>

      {sinFolios && (
        <div className="card p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-navy-900">Te quedaste sin folios</p>
            <p className="text-xs text-slate-500">Puedes preparar la cotización y guardarla como borrador; para enviarla necesitas recargar.</p>
          </div>
          <button onClick={() => navigate('/app/folios')} className="btn-navy text-xs py-1.5 px-3 shrink-0">Recargar</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Cliente */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">Cliente</h2>
            {clientes.length === 0 ? (
              <div className="text-center py-6">
                <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Todavía no tienes clientes registrados.</p>
                <button onClick={() => navigate('/app/clientes')} className="btn-secondary text-xs mt-3">Agregar cliente</button>
              </div>
            ) : (
              <>
                <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">— Seleccionar cliente (opcional) —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
                </select>
                {cliente && (
                  <p className="text-[11px] text-slate-400 mt-2">
                    {cliente.email || 'sin correo'} · {cliente.whatsapp ? `+${String(cliente.whatsapp).replace(/\D/g, '')}` : 'sin WhatsApp'}
                  </p>
                )}
                {sinContacto && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    Este cliente no tiene correo ni WhatsApp: no vas a poder enviarle la cotización.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Conceptos */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-900">Conceptos</h2>
              <span className="text-xs text-slate-400">{items.length} {items.length === 1 ? 'concepto' : 'conceptos'}</span>
            </div>
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
                            // Controlado en "": permite volver a elegir el mismo producto.
                            <select className="input sm:w-44" value="" onChange={e => { addProductoToItem(i, e.target.value); e.target.value = '' }}>
                              <option value="">Del catálogo...</option>
                              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          )}
                        </div>
                        <textarea className="input resize-none" rows={2} placeholder="Descripción (opcional)"
                          value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="label text-xs">Cantidad</label>
                            <input type="number" className="input" min="0.01" step="0.01" value={item.cantidad}
                              onChange={e => setItem(i, 'cantidad', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="label text-xs">Precio unitario</label>
                            <input type="number" className="input" min="0" step="0.01" value={item.precio_unitario}
                              onChange={e => setItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label className="label text-xs">IVA %</label>
                            <input type="number" className="input" min="0" step="1" value={item.iva_porcentaje}
                              onChange={e => setItem(i, 'iva_porcentaje', parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          title="Quitar concepto"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-1.5 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold text-navy-900 mt-2">
                      {formatCurrency(item.subtotal, moneda)}
                      <span className="text-[11px] font-normal text-slate-400"> con IVA</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" /> Agregar concepto
            </button>
            {productos.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 justify-center">
                <Package className="w-3 h-3" /> Si cargas tu catálogo de productos, los conceptos se llenan solos.
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Notas y términos</h2>
            <div>
              <label className="label">Notas para el cliente</label>
              <textarea className="input resize-none" rows={3} placeholder="Instrucciones de pago, condiciones especiales..."
                value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div>
              <label className="label">Términos y condiciones</label>
              <textarea className="input resize-none" rows={2} value={form.terminos}
                onChange={e => setForm(f => ({ ...f, terminos: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Detalles</h2>
            <div>
              <label className="label">Moneda</label>
              <select className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="MXN">MXN · Peso mexicano</option>
                <option value="USD">USD · Dólar americano</option>
                <option value="COP">COP · Peso colombiano</option>
              </select>
            </div>
            <div>
              <label className="label">Vencimiento</label>
              <input type="date" className="input" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Descuento %</label>
              <input type="number" className="input" min="0" max="100" step="1" value={form.descuento_porcentaje}
                onChange={e => setForm(f => ({ ...f, descuento_porcentaje: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotalBruto, moneda)}</span></div>
              {form.descuento_porcentaje > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Descuento ({form.descuento_porcentaje}%)</span><span>−{formatCurrency(descMonto, moneda)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(impuestos, moneda)}</span></div>
              <div className="flex justify-between font-extrabold text-navy-900 border-t border-slate-200 pt-2 mt-2 text-base">
                <span>Total</span><span>{formatCurrency(total, moneda)}</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block space-y-2">
            <button onClick={() => handleSave('enviada')} disabled={saving || sinFolios} className="btn-navy w-full justify-center py-2.5">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar cotización · 1 folio
            </button>
            <button onClick={() => handleSave('borrador')} disabled={saving} className="btn-secondary w-full justify-center">
              <Save className="w-4 h-4" /> Guardar borrador
            </button>
          </div>
        </div>
      </div>

      {/* Barra fija en móvil: el total y las acciones siempre a la vista */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Total</span>
          <span className="font-extrabold text-navy-900">{formatCurrency(total, moneda)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave('borrador')} disabled={saving} className="btn-secondary flex-1 justify-center text-sm">
            <Save className="w-4 h-4" /> Borrador
          </button>
          <button onClick={() => handleSave('enviada')} disabled={saving || sinFolios} className="btn-navy flex-1 justify-center text-sm">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
