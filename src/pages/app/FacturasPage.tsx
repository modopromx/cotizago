// Notas y facturas del usuario (separado de "Comprar folios").
// Por cada pago: en México el CFDI se genera solo al pagar si «Mi empresa» tiene
// los datos fiscales completos (factura-automatica); si no, el cliente lo pide
// aquí. Fuera de México se genera al instante una nota de remisión (no fiscal).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import { descargarNotaRemision } from '../../lib/cotizacionPdf'
import { abrirArchivoPrivado } from '../../lib/storage'
import toast from 'react-hot-toast'
import { FileText, Download } from 'lucide-react'

export default function FacturasPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [historial, setHistorial] = useState<any[]>([])
  const [facturasPorPago, setFacturasPorPago] = useState<Record<string, any>>({})
  const [facturablesPorPago, setFacturablesPorPago] = useState<Record<string, any>>({})
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [facturando, setFacturando] = useState('')

  const esMexico = (empresa?.pais ?? 'MX') === 'MX'
  const docFiscal = esMexico ? t('fol.factura') : t('fol.notaRemision')
  // Factura automática detenida porque se acabaron los timbres: se genera sola en breve.
  const enEspera = esMexico && Object.values(facturablesPorPago).some((f: any) => f.estado !== 'facturado' && f.auto_estado === 'en_espera_timbres')

  const loadHistorial = () => {
    if (!user || !profile?.workspace_id) return
    supabase.from('pagos').select('*').eq('workspace_id', profile.workspace_id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setHistorial(data ?? []); setLoading(false) })
  }

  const loadFacturas = () => {
    if (!user) return
    supabase.from('facturas_solicitudes').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        const map: Record<string, any> = {}
        ;(data ?? []).forEach((f: any) => { if (f.pago_id) map[f.pago_id] = f })
        setFacturasPorPago(map)
      })
  }

  // Facturables por pago (nuevo flujo automático de CFDI vía el hub).
  const loadFacturables = () => {
    if (!profile?.workspace_id) return
    supabase.from('facturables').select('pago_id, token, estado, auto_estado').eq('workspace_id', profile.workspace_id)
      .then(({ data }) => {
        const map: Record<string, any> = {}
        ;(data ?? []).forEach((f: any) => { if (f.pago_id) map[f.pago_id] = f })
        setFacturablesPorPago(map)
      })
  }

  // Facturar un pago: crea/recupera su facturable y abre el portal de facturación.
  const facturarPago = async (pago: any) => {
    setFacturando(pago.id)
    try {
      const { data, error } = await supabase.functions.invoke('facturar-pago', { body: { pago_id: pago.id } })
      if (error || !data?.token) { toast.error(t('fol.noSolicitar')); return }
      navigate(`/facturar?t=${data.token}`)
    } catch { toast.error(t('fol.noSolicitar')) }
    finally { setFacturando('') }
  }

  useEffect(() => {
    if (profile?.workspace_id) {
      supabase.from('empresas').select('pais,rfc,razon_social,nombre_comercial').eq('workspace_id', profile.workspace_id).maybeSingle()
        .then(({ data }) => setEmpresa(data))
    }
    loadHistorial()
    loadFacturas()
    loadFacturables()
    if (!user) return
    // En vivo: cuando el admin sube la factura, aparece sin recargar.
    const canal = supabase
      .channel('facturas_usuario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_solicitudes', filter: `user_id=eq.${user.id}` }, loadFacturas)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [user, profile?.workspace_id])

  const solicitarFactura = async (pago: any) => {
    if (!user) return
    if (!empresa?.rfc) { toast.error(t('fol.agregaRfc', { doc: docFiscal })); return }

    // Nota de remisión (fuera de México): NO es fiscal, se genera al instante.
    if (!esMexico) {
      const tid = toast.loading(t('fol.genNota'))
      try {
        const descargada = await descargarNotaRemision({
          folio: `NR-${(pago.id as string).slice(0, 8).toUpperCase()}`,
          fecha: pago.created_at,
          receptor: { nombre: empresa?.razon_social ?? empresa?.nombre_comercial, rfc: empresa?.rfc, pais: empresa?.pais },
          concepto: `${pago.paquete_nombre ?? 'Recarga de folios'} · ${pago.folios_cantidad ?? 0} folios`,
          monto: pago.monto, moneda: pago.moneda ?? 'MXN',
        })
        await supabase.from('facturas_solicitudes').insert({
          user_id: user.id, pago_id: pago.id, monto: pago.monto, estado: 'emitida',
          tipo: 'nota_remision', pais: empresa?.pais ?? null,
          rfc: empresa?.rfc ?? null, razon_social: empresa?.razon_social ?? empresa?.nombre_comercial ?? null,
        })
        // Si el navegador pidió confirmar la descarga, ya se ve el botón «Descargar».
        if (descargada) toast.success(t('fol.notaOk'), { id: tid })
        else toast.dismiss(tid)
        loadFacturas()
      } catch { toast.error(t('fol.notaErr'), { id: tid }) }
      return
    }

    // Factura fiscal (México): la emite administración con CFDI (PDF + XML).
    const { error } = await supabase.from('facturas_solicitudes').insert({
      user_id: user.id, pago_id: pago.id, monto: pago.monto, estado: 'pendiente',
      tipo: 'factura', pais: 'MX',
      rfc: empresa?.rfc ?? null,
      razon_social: empresa?.razon_social ?? empresa?.nombre_comercial ?? null,
    })
    if (error) toast.error(t('fol.noSolicitar'))
    else { toast.success(t('fol.solicitudEnviada')); loadFacturas() }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('fol.facturasTitle')}</h1>
        <p className="text-slate-500 text-sm">{t('fol.facturasSubtitle')}</p>
      </div>

      {enEspera && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('fol.facAutoAviso')}
        </div>
      )}

      {loading ? (
        <div className="card p-6 text-center text-slate-500 text-sm">{t('fol.cargando')}</div>
      ) : historial.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
          <p className="text-slate-500 text-sm">{t('fol.sinRecargas')}</p>
          <Link to="/app/folios" className="text-xs text-primary-700 mt-1 inline-block hover:underline">{t('fol.compraMas')}</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">{t('fol.colFecha')}</th>
                  <th className="px-4 py-3 font-medium">{t('fol.colPaquete')}</th>
                  <th className="px-4 py-3 font-medium">{t('fol.colFolios')}</th>
                  <th className="px-4 py-3 font-medium">{t('fol.colTotal')}</th>
                  <th className="px-4 py-3 font-medium">{docFiscal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-500">{formatDate(h.created_at)}</td>
                    <td className="px-4 py-3 text-navy-900">{h.paquete_nombre ?? t('fol.recarga')}</td>
                    <td className="px-4 py-3 text-success-700 font-semibold">+{h.folios_cantidad ?? 0}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(h.monto, h.moneda)}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        // México: autofacturación con CFDI (nuevo flujo automático).
                        if (esMexico) {
                          const fb = facturablesPorPago[h.id]
                          if (fb?.estado === 'facturado') {
                            return (
                              <button onClick={() => navigate(`/facturar?t=${fb.token}`)} className="py-2 text-xs font-medium text-primary-700 hover:underline inline-flex items-center gap-1">
                                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Ver factura
                              </button>
                            )
                          }
                          if (fb?.auto_estado === 'en_espera_timbres') {
                            return <span className="badge bg-amber-50 text-amber-700">{t('fol.facAutoEspera')}</span>
                          }
                          if (fb) {
                            return (
                              <button onClick={() => navigate(`/facturar?t=${fb.token}`)} className="py-2 text-xs font-medium text-amber-700 hover:underline">
                                Continuar factura
                              </button>
                            )
                          }
                          return (
                            <button onClick={() => facturarPago(h)} disabled={facturando === h.id} className="py-2 text-xs font-medium text-primary-700 hover:underline">
                              {facturando === h.id ? 'Abriendo…' : 'Facturar'}
                            </button>
                          )
                        }
                        // Fuera de México: nota de remisión (no fiscal).
                        const fac = facturasPorPago[h.id]
                        if (fac && (fac.archivo_url || fac.archivo_xml_url)) {
                          return (
                            <div className="flex items-center gap-3">
                              {fac.archivo_url && (
                                <button onClick={() => abrirArchivoPrivado(fac.archivo_url)} className="py-2 text-xs font-medium text-primary-700 hover:underline inline-flex items-center gap-1">
                                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> {t('fol.facPdf')}
                                </button>
                              )}
                              {fac.archivo_xml_url && (
                                <button onClick={() => abrirArchivoPrivado(fac.archivo_xml_url)} className="py-2 text-xs font-medium text-primary-700 hover:underline inline-flex items-center gap-1">
                                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> {t('fol.facXml')}
                                </button>
                              )}
                            </div>
                          )
                        }
                        if (fac && fac.estado === 'emitida') return <span className="badge bg-success-50 text-success-700">{t('fol.facEmitida')}</span>
                        if (fac) return <span className="badge bg-amber-50 text-amber-700">{t('fol.facEnProceso')}</span>
                        return (
                          <button onClick={() => solicitarFactura(h)} className="py-2 text-xs font-medium text-primary-700 hover:underline">
                            {t('fol.solicitar', { doc: docFiscal })}
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">
        {esMexico
          ? <>{t('fol.pieMxA')}<Link to="/app/configuracion" className="text-primary-700 hover:underline">{t('fol.miEmpresa')}</Link>{t('fol.pieMxB')}</>
          : <>{t('fol.pieIntlA')}<Link to="/app/configuracion" className="text-primary-700 hover:underline">{t('fol.miEmpresa')}</Link>{t('fol.pieIntlB')}</>}
      </p>
    </div>
  )
}
