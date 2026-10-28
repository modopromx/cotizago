import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2, Plus, AlertTriangle, Package } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import CampoNumero from '../../components/CampoNumero'

interface Item { id?: string; nombre: string; descripcion: string; unidad: string; cantidad: number; precio_unitario: number; iva_porcentaje: number; descuento_porcentaje: number; subtotal: number }

const nuevoItem = (): Item => ({ nombre: '', descripcion: '', unidad: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: 16, descuento_porcentaje: 0, subtotal: 0 })

const UNIDADES = ['servicio', 'hora', 'horas', 'pieza', 'piezas', 'mes', 'meses', 'día', 'días', 'proyecto', 'paquete']

const calcSubtotal = (it: Item) =>
  it.cantidad * it.precio_unitario * (1 - (it.descuento_porcentaje || 0) / 100) * (1 + it.iva_porcentaje / 100)

export default function EditarCotizacionPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  // Prefijo único para enlazar label ↔ campo en las filas repetidas de conceptos.
  const uid = useId()
  const { user } = useAuth()
  const [cot, setCot] = useState<any>(null)
  const [items, setItems] = useState<Item[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [clienteId, setClienteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    supabase.from('cotizaciones').select('*').eq('id', id).single().then(({ data }) => { if (data) { setCot(data); setClienteId(data.cliente_id ?? '') } })
    supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden').then(({ data }) => setItems(data ?? []))
    supabase.from('productos').select('*').eq('user_id', user.id).eq('activo', true).then(({ data }) => setProductos(data ?? []))
    supabase.from('clientes').select('id,nombre,empresa,email,whatsapp,rfc,razon_social,pais,codigo_postal').eq('user_id', user.id).eq('activo', true).then(({ data }) => setClientes(data ?? []))
  }, [user, id])

  const cliente = clientes.find(c => c.id === clienteId)

  // Deduce la unidad de un concepto a partir del catálogo de productos:
  // 1) coincidencia EXACTA de nombre; 2) si no, el nombre de un producto está
  // CONTENIDO en el del concepto (p. ej. "Agente AI Mensual" ← "Agente AI"),
  // ganando el nombre de producto más largo para evitar falsos positivos.
  const unidadDeProducto = (nombreItem?: string): string | null => {
    const n = (nombreItem ?? '').trim().toLowerCase()
    if (!n) return null
    const exacto = productos.find(p => (p.nombre ?? '').trim().toLowerCase() === n)
    if (exacto?.unidad) return exacto.unidad
    const candidatos = productos
      .filter(p => p.unidad && p.nombre && n.includes((p.nombre ?? '').trim().toLowerCase()))
      .sort((a, b) => (b.nombre?.length ?? 0) - (a.nombre?.length ?? 0))
    return candidatos[0]?.unidad ?? null
  }

  // Rellena la unidad vacía de conceptos antiguos con la del producto que
  // coincida (cotizaciones creadas antes de tener unidad por ítem).
  const unidadRellenada = useRef(false)
  useEffect(() => {
    if (unidadRellenada.current || items.length === 0 || productos.length === 0) return
    unidadRellenada.current = true
    setItems(prev => prev.map(it => {
      if (it.unidad) return it
      const u = unidadDeProducto(it.nombre)
      return u ? { ...it, unidad: u } : it
    }))
  }, [items, productos])

  const setItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      next[i].subtotal = calcSubtotal(next[i])
      return next
    })
  }

  const usarProducto = (i: number, prodId: string) => {
    const p = productos.find(p => p.id === prodId)
    if (!p) return
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], nombre: p.nombre, descripcion: p.descripcion ?? '', unidad: p.unidad ?? next[i].unidad, precio_unitario: p.precio, iva_porcentaje: p.iva }
      next[i].subtotal = calcSubtotal(next[i])
      return next
    })
  }

  const moneda = cot?.moneda || 'MXN'
  const subtotalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descMonto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * ((i.descuento_porcentaje || 0) / 100), 0)
  // El IVA se calcula sobre el precio ya descontado.
  const impuestos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (1 - (i.descuento_porcentaje || 0) / 100) * (i.iva_porcentaje / 100), 0)
  const total = subtotalBruto - descMonto + impuestos

  const yaEnviada = cot && !['borrador'].includes(cot.estado)
  const faltanNombres = items.some(i => !i.nombre.trim())

  const handleSave = async () => {
    if (!id) return
    setIntentado(true)
    if (!clienteId) { toast.error(t('qe.faltaCliente')); return }
    if (items.length === 0) { toast.error(t('qe.necesitaConcepto')); return }
    if (faltanNombres) { toast.error(t('qe.faltanNombres')); return }

    setSaving(true)
    // Guarda los datos del cliente en la cotización (para que salgan en el PDF).
    const { error: cliErr } = await supabase.from('cotizaciones').update({
      cliente_id: clienteId || null,
      cliente_nombre: cliente?.nombre ?? '',
      cliente_empresa: cliente?.empresa ?? '',
      cliente_email: cliente?.email ?? '',
      cliente_whatsapp: cliente?.whatsapp ?? '',
      cliente_pais: cliente?.pais ?? '',
      cliente_cp: cliente?.codigo_postal ?? '',
      cliente_rfc: cliente?.rfc ?? '',
      cliente_razon_social: cliente?.razon_social ?? '',
    }).eq('id', id)
    if (cliErr) { toast.error(t('qe.noGuardar') + cliErr.message); setSaving(false); return }

    // Una sola llamada transaccional: reemplaza conceptos y recalcula totales.
    // Si algo falla, la cotización queda intacta.
    const { error } = await supabase.rpc('guardar_cotizacion', {
      p_cotizacion: id,
      p_items: items.map(({ id: _id, ...rest }) => rest),
      p_notas: cot.notas ?? '',
      p_terminos: cot.terminos ?? '',
      p_descuento: 0,
    })
    if (error) toast.error(t('qe.noGuardar') + error.message)
    else { toast.success(t('qe.actualizada')); navigate('/app/cotizaciones') }
    setSaving(false)
  }

  if (!cot) return <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('qe.cargando')}</div>

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-0">
      <datalist id="unidades">{UNIDADES.map(u => <option key={u} value={u} />)}</datalist>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('qe.volver', { defaultValue: 'Volver' })} className="w-10 h-10 -ml-2 inline-flex items-center justify-center text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('qe.editarTitle')}</h1>
          <p className="text-slate-500 text-sm font-mono">{cot.numero}</p>
        </div>
      </div>

      {yaEnviada && (
        <div className="card p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-slate-600">{t('qe.yaEnviada')}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Cliente */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('qe.cliente')}</h2>
            {clientes.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-500">{t('qe.sinClientes')}</p>
                <button onClick={() => navigate('/app/clientes')} className="btn-secondary text-xs mt-3">{t('qe.agregarCliente')}</button>
              </div>
            ) : (
              <>
                <select aria-label={t('qe.cliente')} aria-invalid={intentado && !clienteId} className={`input ${intentado && !clienteId ? 'border-red-300 bg-red-50/30' : ''}`} value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">{t('qe.seleccionarCliente')}</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
                </select>
                {cliente && (
                  <p className="text-xs text-slate-500 mt-2">
                    {cliente.email || t('qe.sinCorreo')} · {cliente.whatsapp ? `+${String(cliente.whatsapp).replace(/\D/g, '')}` : t('qe.sinWa')}
                  </p>
                )}
                {intentado && !clienteId && (
                  <p role="alert" className="text-xs text-red-700 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" /> {t('qe.faltaCliente')}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-900">{t('qe.conceptos')}</h2>
              <span className="text-xs text-slate-500">{t('qe.conceptoCount', { count: items.length })}</span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-500">{t('qe.sinConceptos')}</p>
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
                            <input className="input flex-1" aria-label={`${t('qe.nombreConcepto')} ${i + 1}`} aria-invalid={falta} placeholder={t('qe.nombreConcepto')}
                              value={item.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} />
                            {productos.length > 0 && (
                              <select className="input sm:w-44" aria-label={`${t('qe.delCatalogo')} · ${i + 1}`} value="" onChange={e => { usarProducto(i, e.target.value); e.target.value = '' }}>
                                <option value="">{t('qe.delCatalogo')}</option>
                                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </select>
                            )}
                          </div>
                          <textarea className="input resize-none" rows={2} aria-label={`${t('qe.descripcionOpc')} · ${i + 1}`} placeholder={t('qe.descripcionOpc')}
                            value={item.descripcion ?? ''} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div><label htmlFor={`${uid}-cantidad-${i}`} className="label text-xs">{t('qe.cantidad')}</label>
                              <CampoNumero id={`${uid}-cantidad-${i}`} className="input" value={item.cantidad}
                                onValor={n => setItem(i, 'cantidad', n)} /></div>
                            <div><label htmlFor={`${uid}-unidad-${i}`} className="label text-xs">{t('qe.unidad')}</label>
                              <input id={`${uid}-unidad-${i}`} className="input" list="unidades" placeholder={t('qe.unidadPh')} value={item.unidad ?? ''}
                                onChange={e => setItem(i, 'unidad', e.target.value)} /></div>
                            <div><label htmlFor={`${uid}-precio_unitario-${i}`} className="label text-xs">{t('qe.precioUnitario')}</label>
                              <CampoNumero id={`${uid}-precio_unitario-${i}`} className="input" value={item.precio_unitario}
                                onValor={n => setItem(i, 'precio_unitario', n)} /></div>
                            <div><label htmlFor={`${uid}-descuento_porcentaje-${i}`} className="label text-xs">{t('qe.descuentoPct')}</label>
                              <CampoNumero id={`${uid}-descuento_porcentaje-${i}`} className="input" value={item.descuento_porcentaje ?? 0}
                                onValor={n => setItem(i, 'descuento_porcentaje', n)} /></div>
                            <div><label htmlFor={`${uid}-iva_porcentaje-${i}`} className="label text-xs">{t('qe.ivaPct')}</label>
                              <CampoNumero id={`${uid}-iva_porcentaje-${i}`} className="input" value={item.iva_porcentaje}
                                onValor={n => setItem(i, 'iva_porcentaje', n)} /></div>
                          </div>
                        </div>
                        <button type="button" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          title={t('qe.quitarConcepto')} aria-label={`${t('qe.quitarConcepto')} ${i + 1}`}
                          className="w-10 h-10 inline-flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="text-right mt-2 flex items-baseline justify-end gap-3">
                        <span className="text-xs text-slate-500">
                          {t('qe.subtotal')}: {formatCurrency(item.cantidad * item.precio_unitario * (1 - (item.descuento_porcentaje || 0) / 100), moneda)}
                        </span>
                        <span className="text-sm font-semibold text-navy-900">
                          {formatCurrency(item.subtotal, moneda)}
                          <span className="text-[11px] font-normal text-slate-500">{t('qe.conIva')}</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button type="button" onClick={() => setItems(p => [...p, nuevoItem()])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('qe.agregarConcepto')}
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">{t('qe.notasTerminos')}</h2>
            <div>
              <label htmlFor={`${uid}-notas`} className="label">{t('qe.notasCliente')}</label>
              <textarea id={`${uid}-notas`} className="input resize-none" rows={3} placeholder={t('qe.notasPh')}
                value={cot.notas ?? ''} onChange={e => setCot((c: any) => ({ ...c, notas: e.target.value }))} />
            </div>
            <div>
              <label htmlFor={`${uid}-terminos`} className="label">{t('qe.terminos')}</label>
              <textarea id={`${uid}-terminos`} className="input resize-none" rows={2} value={cot.terminos ?? ''}
                onChange={e => setCot((c: any) => ({ ...c, terminos: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">{t('qe.detalles')}</h2>
            <p className="text-xs text-slate-500">{t('qe.descuentoPorItem')}</p>
            <p className="text-xs text-slate-500">{t('qe.monedaLabel', { moneda })}</p>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('qe.resumen')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>{t('qe.subtotal')}</span><span>{formatCurrency(subtotalBruto, moneda)}</span></div>
              {descMonto > 0 && (
                <div className="flex justify-between text-success-700">
                  <span>{t('qe.descuentoResumen')}</span><span>−{formatCurrency(descMonto, moneda)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600"><span>{t('qe.iva')}</span><span>{formatCurrency(impuestos, moneda)}</span></div>
              <div className="flex justify-between font-extrabold text-navy-900 border-t border-slate-200 pt-2 mt-2 text-base">
                <span>{t('qe.total')}</span><span>{formatCurrency(total, moneda)}</span>
              </div>
            </div>
          </div>

          <button type="button" onClick={handleSave} disabled={saving} className="hidden lg:flex btn-navy w-full justify-center py-2.5">
            {saving ? <span role="status" aria-label={t('qe.cargando')} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {t('qe.guardarCambios')}
          </button>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">{t('qe.total')}</span>
          <span className="font-extrabold text-navy-900">{formatCurrency(total, moneda)}</span>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-navy w-full justify-center text-sm min-h-[44px]">
          {saving ? <span role="status" aria-label={t('qe.cargando')} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          {t('qe.guardarCambios')}
        </button>
      </div>
    </div>
  )
}
