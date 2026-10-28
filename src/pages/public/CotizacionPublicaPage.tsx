import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, ESTADO_LABELS } from '../../lib/utils'
import { buildCotizacionPDF } from '../../lib/pdf'
import { descargarPDF } from '../../lib/descarga'
import toast from 'react-hot-toast'
import { FileText, CheckCircle, XCircle, Eye, MapPin, Calendar, Phone, Mail, Download, Sparkles, ArrowRight } from 'lucide-react'

// Contraste del color de marca del emisor (WCAG): el emisor elige cualquier
// color, y uno claro (amarillo, cian…) con texto blanco o como texto sobre
// blanco no se lee. Si no llega a 4.5:1 contra blanco, usamos navy.
const NAVY = '#06213B'
function luminancia(hex: string) {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}
// Contraste del color contra blanco (1 a 21).
const contrasteConBlanco = (hex: string) => 1.05 / (luminancia(hex) + 0.05)

export default function CotizacionPublicaPage() {
  const { token } = useParams()
  const [cot, setCot] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [respondida, setRespondida] = useState(false)
  const [enviando, setEnviando] = useState<null | 'aceptada' | 'rechazada'>(null)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    const load = async () => {
      // Acceso público seguro: la función exige el token y solo devuelve los
      // campos publicables del emisor (nunca datos privados ni otras cotizaciones).
      const { data, error } = await supabase.rpc('get_cotizacion_publica', { cotizacion_token: token })
      if (error) setErrorCarga(true)
      if (!data) { setLoading(false); return }
      setCot(data.cotizacion)
      setItems(data.items ?? [])
      setProfile(data.emisor)

      // Registrar la apertura (marca "vista" y suma el contador en el servidor).
      supabase.rpc('registrar_vista', { cotizacion_token: token, ua: navigator.userAgent })

      setLoading(false)
    }
    load()
  }, [token])

  const handleRespuesta = async (resp: 'aceptada' | 'rechazada') => {
    if (!cot || !token || enviando) return
    if (resp === 'rechazada' && !window.confirm('¿Seguro que quieres rechazar esta cotización?')) return
    setEnviando(resp)
    const { data, error } = await supabase.rpc('responder_cotizacion', { cotizacion_token: token, respuesta_cliente: resp })
    setEnviando(null)
    // Error de red/servidor: no se guardó nada, se puede reintentar.
    if (error) { toast.error('No pudimos registrar tu respuesta. Revisa tu conexión e inténtalo de nuevo.'); return }
    // Sin error pero sin cambios: ya estaba respondida o cancelada.
    if (data === false) {
      toast.error('Esta cotización ya no admite respuesta. Contacta al vendedor.')
      const { data: fresca } = await supabase.rpc('get_cotizacion_publica', { cotizacion_token: token })
      if (fresca?.cotizacion) setCot(fresca.cotizacion)
      return
    }
    setRespondida(true)
    setCot((c: any) => ({ ...c, estado: resp }))
  }

  const handleDescargarPDF = async () => {
    if (!cot) return
    const t = toast.loading('Generando PDF...')
    try {
      const doc = await buildCotizacionPDF({ emisor: profile ?? {}, cotizacion: cot, items, publicUrl: window.location.href })
      if (descargarPDF(doc, `${cot.numero || 'cotizacion'}.pdf`)) toast.success('PDF descargado', { id: t })
      else toast.dismiss(t)
    } catch { toast.error('No se pudo generar el PDF', { id: t }) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Cargando cotización" />
    </div>
  )

  if (!cot) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
        {errorCarga ? (
          <>
            <h1 className="text-xl font-bold text-slate-700">No pudimos cargar la cotización</h1>
            <p className="text-slate-500 text-sm mt-1">Revisa tu conexión e inténtalo de nuevo.</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium">Reintentar</button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-700">Cotización no encontrada</h1>
            <p className="text-slate-500 text-sm mt-1">El link puede haber expirado o no ser válido.</p>
          </>
        )}
      </div>
    </div>
  )

  // El emisor puede no tener nombre de empresa (cadena vacía): antes `''[0]`
  // tronaba el render y la página quedaba en blanco.
  const nombreEmisor = profile?.empresa || profile?.nombre || 'Cotización'
  const accentColor = /^#[0-9a-f]{6}$/i.test(profile?.color_marca ?? '') ? profile.color_marca : '#1e7363'
  // Con un acento claro: texto navy sobre el botón y el total en navy.
  const acentoLegible = contrasteConBlanco(accentColor) >= 4.5
  const textoSobreAcento = acentoLegible ? '#FFFFFF' : NAVY
  const colorTotal = acentoLegible ? accentColor : NAVY
  const hayDesc = items.some((it: any) => Number(it.descuento_porcentaje) > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="" className="h-8 object-contain" />
            ) : (
              <div aria-hidden="true" className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: accentColor, color: textoSobreAcento }}>
                {nombreEmisor.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-slate-800 text-sm">{nombreEmisor}</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="text-xs text-slate-500 font-mono">{cot.numero}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Banner estado */}
        {cot.estado === 'aceptada' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-700" aria-hidden="true" />
            <p className="text-green-700 font-medium">Esta cotización fue <strong>aceptada</strong>. ¡Gracias!</p>
          </div>
        )}
        {cot.estado === 'rechazada' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-700" aria-hidden="true" />
            <p className="text-red-700 font-medium">Esta cotización fue <strong>rechazada</strong>.</p>
          </div>
        )}

        {/* Encabezado cotización */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100" style={{ backgroundColor: accentColor + '10' }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Cotización</h1>
                <p className="font-mono text-slate-500 text-sm mt-0.5">{cot.numero}</p>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" /><span>Emisión: {formatDate(cot.fecha_emision)}</span></div>
                {cot.fecha_vencimiento && <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" /><span>Vence: {formatDate(cot.fecha_vencimiento)}</span></div>}
              </div>
            </div>
          </div>

          {/* De / Para */}
          <div className="grid sm:grid-cols-2 gap-6 p-6 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">De</p>
              <p className="font-semibold text-slate-800">{nombreEmisor}</p>
              {profile?.email_empresa && <p className="text-sm text-slate-500">{profile.email_empresa}</p>}
              {profile?.telefono && <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5"><Phone className="w-3 h-3" aria-hidden="true" />{profile.telefono}</div>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Para</p>
              <p className="font-semibold text-slate-800">{cot.cliente_nombre || 'Cliente'}</p>
              {cot.cliente_empresa && <p className="text-sm text-slate-500">{cot.cliente_empresa}</p>}
              {cot.cliente_email && <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5"><Mail className="w-3 h-3" aria-hidden="true" />{cot.cliente_email}</div>}
              {cot.cliente_rfc && <p className="text-xs text-slate-500">RFC: {cot.cliente_rfc}</p>}
            </div>
          </div>

          {/* Conceptos */}
          <div className="p-6">
            {/* Celular: un concepto por fila, sin deslizar de lado (el total quedaba oculto). */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {items.map(it => (
                <li key={it.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-800">{it.nombre}</p>
                    <p className="font-semibold text-slate-800 whitespace-nowrap tabular">{formatCurrency(it.subtotal, cot.moneda)}</p>
                  </div>
                  {it.descripcion && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{it.descripcion}</p>}
                  <p className="text-xs text-slate-600 mt-1 tabular">
                    {it.cantidad}{it.unidad ? ` ${it.unidad}` : ''} × {formatCurrency(it.precio_unitario, cot.moneda)}
                    {Number(it.descuento_porcentaje) > 0 && <span className="text-green-700"> · −{it.descuento_porcentaje}%</span>}
                    {' · '}IVA {it.iva_porcentaje}%
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-2 pr-4 font-semibold text-slate-600">Concepto</th>
                    <th className="text-right pb-2 px-4 font-semibold text-slate-600 whitespace-nowrap">Cant.</th>
                    <th className="text-right pb-2 px-4 font-semibold text-slate-600 whitespace-nowrap">P. Unit.</th>
                    {hayDesc && <th className="text-right pb-2 px-4 font-semibold text-slate-600 whitespace-nowrap">Desc.</th>}
                    <th className="text-right pb-2 px-4 font-semibold text-slate-600 whitespace-nowrap">IVA</th>
                    <th className="text-right pb-2 pl-4 font-semibold text-slate-600 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id} className={`align-top ${idx % 2 === 0 ? 'bg-slate-50' : ''}`}>
                      <td className="py-3 pl-3 pr-4 min-w-[160px] rounded-l-lg">
                        <p className="font-medium text-slate-800">{it.nombre}</p>
                        {it.descripcion && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{it.descripcion}</p>}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">{it.cantidad}{it.unidad ? ` ${it.unidad}` : ''}</td>
                      <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">{formatCurrency(it.precio_unitario, cot.moneda)}</td>
                      {hayDesc && <td className="py-3 px-4 text-right text-green-700 whitespace-nowrap">{Number(it.descuento_porcentaje) > 0 ? `${it.descuento_porcentaje}%` : '—'}</td>}
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">{it.iva_porcentaje}%</td>
                      <td className="py-3 pl-4 pr-3 text-right font-semibold text-slate-800 whitespace-nowrap rounded-r-lg">{formatCurrency(it.subtotal, cot.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(cot.subtotal, cot.moneda)}</span></div>
                {cot.descuento_monto > 0 && <div className="flex justify-between text-green-700"><span>Descuento</span><span>-{formatCurrency(cot.descuento_monto, cot.moneda)}</span></div>}
                <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(cot.impuestos, cot.moneda)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2 text-base">
                  <span>Total</span><span style={{ color: colorTotal }}>{formatCurrency(cot.total, cot.moneda)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notas y términos */}
          {(cot.notas || cot.terminos) && (
            <div className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
              {cot.notas && <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p><p className="text-sm text-slate-600">{cot.notas}</p></div>}
              {cot.terminos && <div><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Términos</p><p className="text-sm text-slate-600">{cot.terminos}</p></div>}
            </div>
          )}

          {/* Datos bancarios */}
          {(profile?.banco || profile?.clabe || profile?.link_pago) && (
            <div className="mx-6 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datos de pago</p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
                {profile?.banco && <p><span className="font-medium">Banco:</span> {profile.banco}</p>}
                {profile?.titular && <p><span className="font-medium">Titular:</span> {profile.titular}</p>}
                {profile?.clabe && <p className="col-span-2"><span className="font-medium">CLABE:</span> <span className="font-mono">{profile.clabe}</span></p>}
              </div>
              {profile?.link_pago && (
                <a href={profile.link_pago} target="_blank" rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: accentColor, color: textoSobreAcento }}>
                  Pagar en línea
                </a>
              )}
            </div>
          )}
        </div>

        {/* Acciones del cliente */}
        {!respondida && cot.estado !== 'aceptada' && cot.estado !== 'rechazada' && cot.estado !== 'borrador' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm font-semibold text-slate-700 mb-4 text-center">¿Deseas proceder con esta cotización?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleRespuesta('aceptada')} disabled={!!enviando} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: accentColor, color: textoSobreAcento }}>
                {enviando === 'aceptada'
                  ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" role="status" aria-label="Enviando" />
                  : <CheckCircle className="w-5 h-5" aria-hidden="true" />} Aceptar cotización
              </button>
              <button onClick={() => handleRespuesta('rechazada')} disabled={!!enviando} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-60">
                {enviando === 'rechazada'
                  ? <span className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" role="status" aria-label="Enviando" />
                  : <XCircle className="w-5 h-5" aria-hidden="true" />} Rechazar
              </button>
            </div>
            <button onClick={handleDescargarPDF} className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all">
              <Download className="w-4 h-4" aria-hidden="true" /> Descargar PDF
            </button>
          </div>
        )}

        {/* Descarga siempre disponible (aunque ya haya respondido) */}
        {(respondida || cot.estado === 'aceptada' || cot.estado === 'rechazada') && (
          <button onClick={handleDescargarPDF} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" aria-hidden="true" /> Descargar PDF
          </button>
        )}

        {respondida && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" aria-hidden="true" />
            <p className="font-bold text-green-800">¡Respuesta registrada!</p>
            <p className="text-green-700 text-sm mt-1">El vendedor ha sido notificado.</p>
          </div>
        )}

        {/* Gancho de registro (bucle viral): quien recibe esta cotización es un
            negocio que también cotiza. Marca propia de Cotiza Go (no del emisor). */}
        <div className="bg-gradient-to-br from-navy-900 to-primary-600 rounded-2xl p-6 text-center shadow-sm">
          <span className="inline-flex w-11 h-11 rounded-xl bg-white/15 items-center justify-center mb-2">
            <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
          </span>
          <p className="text-white font-bold text-lg">¿Tú también envías cotizaciones?</p>
          {/* Textos opacos: con transparencia no llegaban a 4.5:1 sobre el degradado */}
          <p className="text-primary-100 text-sm mt-1 max-w-md mx-auto">
            Crea cotizaciones profesionales en PDF y envíalas por WhatsApp o correo en minutos.
            Regístrate y llévate <strong className="text-white">5 cotizaciones gratis</strong>.
          </p>
          <Link to="/registro"
            className="mt-4 inline-flex items-center gap-2 bg-white text-navy-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-50 transition-colors text-sm">
            Empezar gratis <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <p className="text-primary-100 text-[11px] mt-3">
            Hecho con <Link to="/" className="underline hover:text-white">Cotiza Go</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
