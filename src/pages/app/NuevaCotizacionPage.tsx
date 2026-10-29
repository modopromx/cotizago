import { useState, useEffect, useMemo, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import ModalEnviarCotizacion from '../../components/ModalEnviarCotizacion'
import CampoNumero from '../../components/CampoNumero'
import toast from 'react-hot-toast'
import { Plus, Trash2, Save, ArrowLeft, AlertTriangle, UserPlus, Package } from 'lucide-react'

interface Item { nombre: string; descripcion: string; unidad: string; cantidad: number; precio_unitario: number; iva_porcentaje: number; descuento_porcentaje: number; subtotal: number }

const emptyItem = (iva = 16): Item => ({ nombre: '', descripcion: '', unidad: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: iva, descuento_porcentaje: 0, subtotal: 0 })

// Fecha local «AAAA-MM-DD» a N días de hoy (para la vigencia por defecto).
const enDias = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const UNIDADES = ['servicio', 'hora', 'horas', 'pieza', 'piezas', 'mes', 'meses', 'día', 'días', 'proyecto', 'paquete']

// Importe de una línea: precio con descuento del ítem, con IVA incluido.
const calcSubtotal = (it: Item) =>
  it.cantidad * it.precio_unitario * (1 - (it.descuento_porcentaje || 0) / 100) * (1 + it.iva_porcentaje / 100)

export default function NuevaCotizacionPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  // Prefijo único para enlazar label ↔ campo en las filas repetidas de conceptos.
  const uid = useId()
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [form, setForm] = useState({
    fecha_vencimiento: '',
    notas: '',
    terminos: t('qe.terminosDefault'),
    descuento_porcentaje: 0,
    moneda: 'MXN',
  })
  const [saving, setSaving] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [enviarCot, setEnviarCot] = useState<any>(null)   // cotización recién guardada → modal de envío

  // Valores por defecto de Configuración (moneda, IVA, vigencia y condiciones).
  // Antes se ignoraban: toda cotización nueva salía en MXN, 16% y sin vencimiento.
  const [ivaDefault, setIvaDefault] = useState(16)
  useEffect(() => {
    if (!profile?.workspace_id) return
    supabase.from('empresas').select('moneda,impuesto_default,vigencia_dias,condiciones')
      .eq('workspace_id', profile.workspace_id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const iva = data.impuesto_default != null ? Number(data.impuesto_default) : 16
        setIvaDefault(iva)
        // Solo toca los conceptos que el usuario aún no ha llenado.
        setItems(prev => prev.map(it => (!it.nombre && !it.precio_unitario) ? { ...it, iva_porcentaje: iva } : it))
        setForm(f => ({
          ...f,
          moneda: data.moneda || f.moneda,
          terminos: data.condiciones?.trim() ? data.condiciones : f.terminos,
          fecha_vencimiento: f.fecha_vencimiento || (Number(data.vigencia_dias) > 0 ? enDias(Number(data.vigencia_dias)) : ''),
        }))
      })
  }, [profile?.workspace_id])

  useEffect(() => {
    if (!user) return
    supabase.from('clientes').select('id,nombre,empresa,email,whatsapp,rfc,razon_social,pais,codigo_postal').eq('user_id', user.id).eq('activo', true).then(({ data }) => setClientes(data ?? []))
    supabase.from('productos').select('*').eq('user_id', user.id).eq('activo', true).then(({ data }) => setProductos(data ?? []))
  }, [user])

  const setItem = (i: number, field: keyof Item, val: any) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      next[i].subtotal = calcSubtotal(next[i])
      return next
    })
  }

  const addProductoToItem = (i: number, prodId: string) => {
    const p = productos.find(p => p.id === prodId)
    if (!p) return
    setItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], nombre: p.nombre, descripcion: p.descripcion ?? '', unidad: p.unidad ?? next[i].unidad, precio_unitario: p.precio, iva_porcentaje: p.iva }
      next[i].subtotal = calcSubtotal(next[i])
      return next
    })
  }

  const subtotalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const descMonto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * ((i.descuento_porcentaje || 0) / 100), 0)
  const subtotalNeto = subtotalBruto - descMonto
  const impuestos = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (1 - (i.descuento_porcentaje || 0) / 100) * (i.iva_porcentaje / 100), 0)
  const total = subtotalNeto + impuestos

  const cliente = useMemo(() => clientes.find(c => c.id === clienteId), [clientes, clienteId])
  const folios = profile?.folios_balance ?? 0
  const sinFolios = folios < 1
  const faltanNombres = items.some(i => !i.nombre.trim())
  // Sin correo ni WhatsApp no hay forma de hacerle llegar la cotización.
  const sinContacto = !!cliente && !cliente.email && !cliente.whatsapp
  const moneda = form.moneda

  // Guarda como borrador y abre el modal para enviar de inmediato (WhatsApp /
  // email según módulos, o descargar PDF). El envío consume el folio, no el guardado.
  const handleSave = async () => {
    if (!user) return
    setIntentado(true)
    if (!clienteId) { toast.error(t('qe.faltaCliente')); return }
    if (faltanNombres) { toast.error(t('qe.faltanNombres')); return }

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
      descuento_porcentaje: 0,
      descuento_monto: descMonto,
      impuestos,
      total,
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
    }).select('*').single()

    if (error) { toast.error(t('qe.errorGuardar') + error.message); setSaving(false); return }

    const { error: eItems } = await supabase.from('cotizacion_items').insert(
      items.map((it, idx) => ({ cotizacion_id: cot.id, ...it, orden: idx }))
    )
    // Si los conceptos no se guardaron, una cotización vacía no debe quedar ni
    // ofrecerse para enviar: se borra y el usuario conserva lo que escribió.
    if (eItems) {
      await supabase.from('cotizaciones').delete().eq('id', cot.id)
      toast.error(t('qe.errorGuardar') + eItems.message); setSaving(false); return
    }

    toast.success(t('qe.borradorOk'))
    setSaving(false)
    setEnviarCot(cot)   // abre el modal de envío
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-0">
      <datalist id="unidades">{UNIDADES.map(u => <option key={u} value={u} />)}</datalist>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('qe.volver', { defaultValue: 'Volver' })} className="w-10 h-10 -ml-2 inline-flex items-center justify-center text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-navy-900">{t('qe.nuevaTitle')}</h1>
          <p className="text-slate-500 text-sm">
            {t('qe.teQuedan')}<strong className={sinFolios ? 'text-red-700' : 'text-navy-900'}>{folios}</strong> {t('qe.folioWord', { count: folios })}{t('qe.foliosNota')}
          </p>
        </div>
      </div>

      {sinFolios && (
        <div className="card p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-navy-900">{t('qe.sinFoliosTitle')}</p>
            <p className="text-xs text-slate-500">{t('qe.sinFoliosSub')}</p>
          </div>
          <button onClick={() => navigate('/app/folios')} className="btn-navy text-xs py-1.5 px-3 shrink-0">{t('qe.recargar')}</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Cliente */}
          <div className="card p-5" data-tour="cot-cliente">
            <h2 className="text-sm font-semibold text-navy-900 mb-3">{t('qe.cliente')}</h2>
            {clientes.length === 0 ? (
              <div className="text-center py-6">
                <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-500">{t('qe.sinClientes')}</p>
                <button onClick={() => navigate('/app/clientes')} className="btn-secondary text-xs mt-3">{t('qe.agregarCliente')}</button>
              </div>
            ) : (
              <>
                <select aria-label={t('qe.cliente')} aria-invalid={intentado && !clienteId} className={`input ${intentado && !clienteId ? 'border-red-300 bg-red-50/30' : ''}`} value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">{t('qe.seleccionarCliente')}</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
                </select>
                {intentado && !clienteId && (
                  <p role="alert" className="text-xs text-red-700 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" /> {t('qe.faltaCliente')}
                  </p>
                )}
                {cliente && (
                  <p className="text-xs text-slate-500 mt-2">
                    {cliente.email || t('qe.sinCorreo')} · {cliente.whatsapp ? `+${String(cliente.whatsapp).replace(/\D/g, '')}` : t('qe.sinWa')}
                  </p>
                )}
                {sinContacto && (
                  <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                    {t('qe.sinContacto')}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Conceptos */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-900">{t('qe.conceptos')}</h2>
              <span className="text-xs text-slate-500">{t('qe.conceptoCount', { count: items.length })}</span>
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
                          <input className="input flex-1" aria-label={`${t('qe.nombreConcepto')} ${i + 1}`} aria-invalid={falta} placeholder={t('qe.nombreConcepto')}
                            value={item.nombre} onChange={e => setItem(i, 'nombre', e.target.value)} />
                          {productos.length > 0 && (
                            // Controlado en "": permite volver a elegir el mismo producto.
                            <select className="input sm:w-44" aria-label={`${t('qe.delCatalogo')} · ${i + 1}`} value="" onChange={e => { addProductoToItem(i, e.target.value); e.target.value = '' }}>
                              <option value="">{t('qe.delCatalogo')}</option>
                              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          )}
                        </div>
                        <textarea className="input resize-none" rows={2} aria-label={`${t('qe.descripcionOpc')} · ${i + 1}`} placeholder={t('qe.descripcionOpc')}
                          value={item.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} />
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <label htmlFor={`${uid}-cantidad-${i}`} className="label text-xs">{t('qe.cantidad')}</label>
                            <CampoNumero id={`${uid}-cantidad-${i}`} className="input" value={item.cantidad}
                              onValor={n => setItem(i, 'cantidad', n)} />
                          </div>
                          <div>
                            <label htmlFor={`${uid}-unidad-${i}`} className="label text-xs">{t('qe.unidad')}</label>
                            <input id={`${uid}-unidad-${i}`} className="input" list="unidades" placeholder={t('qe.unidadPh')} value={item.unidad}
                              onChange={e => setItem(i, 'unidad', e.target.value)} />
                          </div>
                          <div>
                            <label htmlFor={`${uid}-precio_unitario-${i}`} className="label text-xs">{t('qe.precioUnitario')}</label>
                            <CampoNumero id={`${uid}-precio_unitario-${i}`} className="input" value={item.precio_unitario}
                              onValor={n => setItem(i, 'precio_unitario', n)} />
                          </div>
                          <div>
                            <label htmlFor={`${uid}-descuento_porcentaje-${i}`} className="label text-xs">{t('qe.descuentoPct')}</label>
                            <CampoNumero id={`${uid}-descuento_porcentaje-${i}`} className="input" value={item.descuento_porcentaje}
                              onValor={n => setItem(i, 'descuento_porcentaje', n)} />
                          </div>
                          <div>
                            <label htmlFor={`${uid}-iva_porcentaje-${i}`} className="label text-xs">{t('qe.ivaPct')}</label>
                            <CampoNumero id={`${uid}-iva_porcentaje-${i}`} className="input" value={item.iva_porcentaje}
                              onValor={n => setItem(i, 'iva_porcentaje', n)} />
                          </div>
                        </div>
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                          title={t('qe.quitarConcepto')} aria-label={`${t('qe.quitarConcepto')} ${i + 1}`}
                          className="w-10 h-10 inline-flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
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
            <button type="button" data-tour="cot-concepto" onClick={() => setItems(prev => [...prev, emptyItem(ivaDefault)])} className="btn-secondary w-full mt-3 justify-center">
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('qe.agregarConcepto')}
            </button>
            {productos.length === 0 && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 justify-center">
                <Package className="w-3 h-3" aria-hidden="true" /> {t('qe.catalogoAyuda')}
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">{t('qe.notasTerminos')}</h2>
            <div>
              <label htmlFor={`${uid}-notas`} className="label">{t('qe.notasCliente')}</label>
              <textarea id={`${uid}-notas`} className="input resize-none" rows={3} placeholder={t('qe.notasPh')}
                value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div>
              <label htmlFor={`${uid}-terminos`} className="label">{t('qe.terminos')}</label>
              <textarea id={`${uid}-terminos`} className="input resize-none" rows={2} value={form.terminos}
                onChange={e => setForm(f => ({ ...f, terminos: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">{t('qe.detalles')}</h2>
            <div>
              <label htmlFor={`${uid}-moneda`} className="label">{t('qe.moneda')}</label>
              <select id={`${uid}-moneda`} className="input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                <option value="MXN">MXN · Peso mexicano</option>
                <option value="USD">USD · Dólar americano</option>
                <option value="COP">COP · Peso colombiano</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-vence`} className="label">{t('qe.vencimiento')}</label>
              <input id={`${uid}-vence`} type="date" className="input" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <p className="text-xs text-slate-500">{t('qe.descuentoPorItem')}</p>
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

          <div className="hidden lg:block" data-tour="cot-guardar">
            <button type="button" onClick={handleSave} disabled={saving} className="btn-navy w-full justify-center py-2.5">
              {saving ? <span role="status" aria-label={t('qe.cargando')} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
              {t('qe.guardarEnviar')}
            </button>
          </div>
        </div>
      </div>

      {/* Barra fija en móvil: el total y la acción siempre a la vista */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">{t('qe.total')}</span>
          <span className="font-extrabold text-navy-900">{formatCurrency(total, moneda)}</span>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-navy w-full justify-center text-sm min-h-[44px]">
          {saving ? <span role="status" aria-label={t('qe.cargando')} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
          {t('qe.guardarEnviar')}
        </button>
      </div>

      {enviarCot && <ModalEnviarCotizacion cot={enviarCot} onClose={() => navigate('/app/cotizaciones')} />}
    </div>
  )
}
