import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, ESTADO_LABELS } from '../../lib/utils'
import { FileText, CheckCircle, XCircle, Eye, MapPin, Calendar, Phone, Mail } from 'lucide-react'

export default function CotizacionPublicaPage() {
  const { token } = useParams()
  const [cot, setCot] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [respondida, setRespondida] = useState(false)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      const { data: cotData } = await supabase.from('cotizaciones').select('*').eq('token', token).single()
      if (!cotData) { setLoading(false); return }
      setCot(cotData)

      const [{ data: itemsData }, { data: profData }] = await Promise.all([
        supabase.from('cotizacion_items').select('*').eq('cotizacion_id', cotData.id).order('orden'),
        supabase.from('profiles').select('nombre,empresa,telefono,email,email_empresa,banco,titular,clabe,link_pago,logo_url,color_marca').eq('id', cotData.user_id).single(),
      ])
      setItems(itemsData ?? [])
      setProfile(profData)

      // Registrar vista
      await supabase.from('quote_views').insert({ cotizacion_id: cotData.id, ip: '', user_agent: navigator.userAgent })
      if (cotData.estado === 'enviada') {
        await supabase.from('cotizaciones').update({
          estado: 'vista',
          visto_at: new Date().toISOString(),
          visto_count: (cotData.visto_count ?? 0) + 1
        }).eq('id', cotData.id)
      } else {
        await supabase.from('cotizaciones').update({ visto_count: (cotData.visto_count ?? 0) + 1 }).eq('id', cotData.id)
      }

      setLoading(false)
    }
    load()
  }, [token])

  const handleRespuesta = async (resp: 'aceptada' | 'rechazada') => {
    if (!cot) return
    await supabase.from('cotizaciones').update({ estado: resp, respuesta: resp }).eq('id', cot.id)
    setRespondida(true)
    setCot((c: any) => ({ ...c, estado: resp }))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!cot) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-700">Cotización no encontrada</h1>
        <p className="text-slate-500 text-sm mt-1">El link puede haber expirado o no ser válido.</p>
      </div>
    </div>
  )

  const accentColor = profile?.color_marca ?? '#1e7363'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="" className="h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accentColor }}>
                {(profile?.empresa ?? profile?.nombre ?? 'C')[0].toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-slate-800 text-sm">{profile?.empresa ?? profile?.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-mono">{cot.numero}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Banner estado */}
        {cot.estado === 'aceptada' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-700 font-medium">Esta cotización fue <strong>aceptada</strong>. ¡Gracias!</p>
          </div>
        )}
        {cot.estado === 'rechazada' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
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
                <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /><span>Emisión: {formatDate(cot.fecha_emision)}</span></div>
                {cot.fecha_vencimiento && <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /><span>Vence: {formatDate(cot.fecha_vencimiento)}</span></div>}
              </div>
            </div>
          </div>

          {/* De / Para */}
          <div className="grid sm:grid-cols-2 gap-6 p-6 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">De</p>
              <p className="font-semibold text-slate-800">{profile?.empresa ?? profile?.nombre}</p>
              {profile?.email_empresa && <p className="text-sm text-slate-500">{profile.email_empresa}</p>}
              {profile?.telefono && <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5"><Phone className="w-3 h-3" />{profile.telefono}</div>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Para</p>
              <p className="font-semibold text-slate-800">{cot.cliente_nombre || 'Cliente'}</p>
              {cot.cliente_empresa && <p className="text-sm text-slate-500">{cot.cliente_empresa}</p>}
              {cot.cliente_email && <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5"><Mail className="w-3 h-3" />{cot.cliente_email}</div>}
              {cot.cliente_rfc && <p className="text-xs text-slate-400">RFC: {cot.cliente_rfc}</p>}
            </div>
          </div>

          {/* Conceptos */}
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-2 font-semibold text-slate-600">Concepto</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">Cant.</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">P. Unit.</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">IVA</th>
                    <th className="text-right pb-2 font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(it => (
                    <tr key={it.id}>
                      <td className="py-3">
                        <p className="font-medium text-slate-800">{it.nombre}</p>
                        {it.descripcion && <p className="text-xs text-slate-500 mt-0.5">{it.descripcion}</p>}
                      </td>
                      <td className="py-3 text-right text-slate-600">{it.cantidad}</td>
                      <td className="py-3 text-right text-slate-600">{formatCurrency(it.precio_unitario, cot.moneda)}</td>
                      <td className="py-3 text-right text-slate-500">{it.iva_porcentaje}%</td>
                      <td className="py-3 text-right font-semibold text-slate-800">{formatCurrency(it.subtotal, cot.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(cot.subtotal, cot.moneda)}</span></div>
                {cot.descuento_monto > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{formatCurrency(cot.descuento_monto, cot.moneda)}</span></div>}
                <div className="flex justify-between text-slate-600"><span>IVA</span><span>{formatCurrency(cot.impuestos, cot.moneda)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2 text-base">
                  <span>Total</span><span style={{ color: accentColor }}>{formatCurrency(cot.total, cot.moneda)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notas y términos */}
          {(cot.notas || cot.terminos) && (
            <div className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
              {cot.notas && <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notas</p><p className="text-sm text-slate-600">{cot.notas}</p></div>}
              {cot.terminos && <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Términos</p><p className="text-sm text-slate-600">{cot.terminos}</p></div>}
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
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: accentColor }}>
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
              <button onClick={() => handleRespuesta('aceptada')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: accentColor }}>
                <CheckCircle className="w-5 h-5" /> Aceptar cotización
              </button>
              <button onClick={() => handleRespuesta('rechazada')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
                <XCircle className="w-5 h-5" /> Rechazar
              </button>
            </div>
          </div>
        )}

        {respondida && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800">¡Respuesta registrada!</p>
            <p className="text-green-600 text-sm mt-1">El vendedor ha sido notificado.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Generado con <a href="https://cotizago.com" className="text-primary-600 hover:underline">CotizaGo</a>
        </p>
      </div>
    </div>
  )
}
