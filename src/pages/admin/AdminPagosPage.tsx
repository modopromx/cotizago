import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, formatDatetime } from '../../lib/utils'
import { abrirArchivoPrivado } from '../../lib/storage'
import { CreditCard, Coins, Blocks, AlertTriangle, Search, Receipt, TrendingUp, FileText, Upload, ExternalLink, Building2 } from 'lucide-react'
import Modal from '../../components/Modal'

// Las recargas de folios y los cobros de módulos comparten el estado 'aprobado'.
const PAGADO = ['aprobado', 'pagado']

export default function AdminPagosPage() {
  const { t } = useTranslation()
  const [pagos, setPagos] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [modulos, setModulos] = useState<Record<string, any>>({})
  const [usuarios, setUsuarios] = useState<Record<string, any>>({})
  const [empresas, setEmpresas] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'folio_topup' | 'modulo'>('todos')
  const [search, setSearch] = useState('')
  const [facturas, setFacturas] = useState<any[]>([])
  const [subiendoFac, setSubiendoFac] = useState<string | null>(null)
  const [verFiscal, setVerFiscal] = useState<any>(null)   // { loading, emp, f } popup datos fiscales
  const facInputRef = useRef<HTMLInputElement>(null)
  const facActualRef = useRef<{ f: any; tipo: 'pdf' | 'xml' } | null>(null)

  const cargarFacturas = () =>
    supabase.from('facturas_solicitudes').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setFacturas(data ?? []))

  useEffect(() => {
    (async () => {
      const [pg, ms, mo, us, em] = await Promise.all([
        supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('modulo_suscripciones').select('*'),
        supabase.from('modulos').select('clave,nombre,precio'),
        supabase.from('profiles').select('id,nombre,email'),
        supabase.from('empresas').select('workspace_id,nombre_comercial,razon_social'),
      ])
      const m: Record<string, any> = {}; (mo.data ?? []).forEach((x: any) => { m[x.clave] = x })
      const u: Record<string, any> = {}; (us.data ?? []).forEach((x: any) => { u[x.id] = x })
      const e: Record<string, string> = {}
      ;(em.data ?? []).forEach((x: any) => { if (x.workspace_id) e[x.workspace_id] = x.nombre_comercial || x.razon_social || '—' })
      setPagos(pg.data ?? []); setSubs(ms.data ?? []); setModulos(m); setUsuarios(u); setEmpresas(e)
      await cargarFacturas()
      setLoading(false)
    })()
  }, [])

  // Sube el archivo (PDF o XML) vía Edge Function con service_role: sin líos de
  // RLS de storage desde el navegador y marca la solicitud como emitida.
  const pedirArchivo = (f: any, tipo: 'pdf' | 'xml') => {
    facActualRef.current = { f, tipo }
    if (facInputRef.current) {
      facInputRef.current.accept = tipo === 'xml' ? '.xml,application/xml,text/xml' : 'application/pdf'
      facInputRef.current.click()
    }
  }
  const subirFactura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const ctx = facActualRef.current
    e.target.value = ''
    if (!file || !ctx) return
    if (file.size > 5 * 1024 * 1024) { toast.error(t('adm.pagos.facArchivoGrande')); return }
    const { f, tipo } = ctx
    setSubiendoFac(`${f.id}-${tipo}`)
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subir-factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ solicitud_id: f.id, tipo, contentBase64: b64 }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) { toast.error(t('adm.pagos.facError') + (data?.error ?? '')) }
      else { toast.success(t('adm.pagos.facSubida')); await cargarFacturas() }
    } catch (err: any) {
      toast.error(t('adm.pagos.facError') + (err?.message ?? ''))
    }
    setSubiendoFac(null)
  }

  // Abre el popup con los datos fiscales del cliente (de su empresa).
  const abrirFiscal = async (f: any) => {
    setVerFiscal({ loading: true, f })
    const { data } = await supabase.from('empresas')
      .select('razon_social,nombre_comercial,rfc,regimen_fiscal,uso_cfdi,codigo_postal,direccion,pais,email')
      .eq('workspace_id', f.workspace_id).maybeSingle()
    setVerFiscal({ loading: false, emp: data, f })
  }

  const cobrados = pagos.filter(p => PAGADO.includes(p.estado))
  const ingresoFolios = cobrados.filter(p => p.tipo !== 'modulo').reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const ingresoModulos = cobrados.filter(p => p.tipo === 'modulo').reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const pendientes = pagos.filter(p => p.estado === 'pendiente')

  // MRR: solo lo que se va a volver a cobrar. Las programadas para cancelarse
  // no cuentan, porque el mes que entra ya no entra ese dinero.
  const vigentes = subs.filter(s => ['activa', 'morosa'].includes(s.estado))
  const mrr = vigentes
    .filter(s => !s.cancelar_al_terminar)
    .reduce((s2, s) => s2 + (Number(modulos[s.clave]?.precio) || 0), 0)
  const morosas = vigentes.filter(s => s.estado === 'morosa')
  const porCancelar = vigentes.filter(s => s.cancelar_al_terminar)

  const kpis = [
    { label: t('adm.pagos.kMrr'), value: formatCurrency(mrr), sub: t('adm.pagos.mrrSub', { count: vigentes.length }), icono: TrendingUp },
    { label: t('adm.pagos.kFolios'), value: formatCurrency(ingresoFolios), sub: t('adm.pagos.foliosSub', { n: cobrados.filter(p => p.tipo !== 'modulo').length }), icono: Coins },
    { label: t('adm.pagos.kModulos'), value: formatCurrency(ingresoModulos), sub: t('adm.pagos.modulosSub', { n: cobrados.filter(p => p.tipo === 'modulo').length }), icono: Blocks },
    { label: t('adm.pagos.kTotal'), value: formatCurrency(ingresoFolios + ingresoModulos), sub: t('adm.pagos.historico'), icono: Receipt },
  ]

  const visibles = useMemo(() => {
    const q = search.toLowerCase()
    return pagos.filter(p => {
      if (filtro === 'modulo' && p.tipo !== 'modulo') return false
      if (filtro === 'folio_topup' && p.tipo === 'modulo') return false
      if (!q) return true
      const u = usuarios[p.user_id]
      return [p.paquete_nombre, u?.nombre, u?.email, empresas[p.workspace_id]]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [pagos, filtro, search, usuarios, empresas])

  const nombreCobro = (p: any) =>
    p.tipo === 'modulo' ? (modulos[p.paquete_nombre]?.nombre ?? p.paquete_nombre) : p.paquete_nombre

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('adm.pagos.title')}</h1>
        <p className="text-slate-500 text-sm">{t('adm.pagos.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-start justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k.label}</p>
              <k.icono className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
            </div>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Solicitudes de factura: el admin sube aquí el PDF/XML que pidió el cliente */}
      <input ref={facInputRef} type="file" accept="application/pdf" className="hidden" tabIndex={-1} aria-hidden="true" onChange={subirFactura} />
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-navy-900 flex items-center gap-2"><FileText className="w-4 h-4 text-primary-700" aria-hidden="true" /> {t('adm.pagos.facTitle')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('adm.pagos.facSub')}</p>
        </div>
        {loading ? (
          <div role="status" className="p-6 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-slate-500">{t('adm.pagos.facSin')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">{t('adm.pagos.facColSolicitante')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.facColTipo')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.facColMonto')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.facColEstado')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.colFecha')}</th>
                  <th className="px-4 py-2.5 font-medium text-right">{t('adm.pagos.facColArchivo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facturas.map(f => {
                  const emitida = f.estado === 'emitida'
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <button type="button" onClick={() => abrirFiscal(f)} className="font-medium text-navy-900 hover:text-primary-700 text-left inline-flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          {f.razon_social || empresas[f.workspace_id] || f.rfc || '—'}
                        </button>
                        {f.rfc && <p className="text-[11px] text-slate-500">{f.rfc}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{f.tipo === 'nota_remision' ? t('adm.pagos.facTipoNota') : t('adm.pagos.facTipoFactura')}</td>
                      <td className="px-4 py-2.5 font-semibold text-navy-900">{formatCurrency(f.monto)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${emitida ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'}`}>
                          {emitida ? t('adm.pagos.facEmitida') : t('adm.pagos.facPendiente')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(f.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button type="button" onClick={() => abrirFiscal(f)} title={t('adm.pagos.facDatosFiscales')} aria-label={t('adm.pagos.facDatosFiscales')} className="p-1.5 text-slate-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg"><Building2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                          {f.archivo_url && (
                            <button type="button" onClick={() => abrirArchivoPrivado(f.archivo_url)} className="btn-secondary text-xs py-1 px-2.5"><ExternalLink className="w-3 h-3" aria-hidden="true" /> {t('adm.pagos.facVerPdf')}</button>
                          )}
                          {f.archivo_xml_url && (
                            <button type="button" onClick={() => abrirArchivoPrivado(f.archivo_xml_url)} className="btn-secondary text-xs py-1 px-2.5"><ExternalLink className="w-3 h-3" aria-hidden="true" /> {t('adm.pagos.facVerXml')}</button>
                          )}
                          <button type="button" onClick={() => pedirArchivo(f, 'pdf')} disabled={subiendoFac === `${f.id}-pdf`} aria-busy={subiendoFac === `${f.id}-pdf`} aria-label="Subir PDF" className="btn-navy text-xs py-1 px-2.5">
                            {subiendoFac === `${f.id}-pdf` ? <span aria-hidden="true" className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" aria-hidden="true" />} PDF
                          </button>
                          <button type="button" onClick={() => pedirArchivo(f, 'xml')} disabled={subiendoFac === `${f.id}-xml`} aria-busy={subiendoFac === `${f.id}-xml`} aria-label="Subir XML" className="btn-navy text-xs py-1 px-2.5">
                            {subiendoFac === `${f.id}-xml` ? <span aria-hidden="true" className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" aria-hidden="true" />} XML
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lo que necesita atención va arriba, no escondido en la tabla */}
      {(morosas.length > 0 || pendientes.length > 0 || porCancelar.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-3">
          {morosas.length > 0 && (
            <div className="card p-4 bg-red-50/50 border-red-200">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {t('adm.pagos.morosasN', { n: morosas.length })}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {t('adm.pagos.morosasSub')}
              </p>
            </div>
          )}
          {porCancelar.length > 0 && (
            <div className="card p-4 bg-amber-50/50 border-amber-200">
              <p className="text-xs font-semibold text-amber-700">{t('adm.pagos.porCancelarN', { n: porCancelar.length })}</p>
              <p className="text-[11px] text-slate-500 mt-1">{t('adm.pagos.porCancelarSub')}</p>
            </div>
          )}
          {pendientes.length > 0 && (
            <div className="card p-4 bg-slate-50 border-slate-200">
              <p className="text-xs font-semibold text-slate-600">{t('adm.pagos.pendientesN', { n: pendientes.length })}</p>
              <p className="text-[11px] text-slate-500 mt-1">{t('adm.pagos.pendientesSub')}</p>
            </div>
          )}
        </div>
      )}

      {/* Suscripciones vigentes */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">{t('adm.pagos.suscripciones')}</h2>
          <span className="text-xs text-slate-500">{t('adm.pagos.mesRecurrente', { monto: formatCurrency(mrr) })}</span>
        </div>
        {loading ? (
          <div role="status" className="p-6 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
        ) : vigentes.length === 0 ? (
          <div className="p-8 text-center">
            <Blocks className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-slate-500">{t('adm.pagos.sinModulos')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">{t('adm.pagos.colModulo')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.colEmpresa')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.colPrecio')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.colEstado')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('adm.pagos.colRenueva')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vigentes.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-navy-900">{modulos[s.clave]?.nombre ?? s.clave}</td>
                    <td className="px-4 py-2.5 text-slate-600">{empresas[s.workspace_id] ?? '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-navy-900">{formatCurrency(modulos[s.clave]?.precio ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      {s.estado === 'morosa' ? <span className="badge bg-red-50 text-red-700">{t('adm.pagos.pagoFallido')}</span>
                        : s.cancelar_al_terminar ? <span className="badge bg-amber-50 text-amber-700">{t('adm.pagos.seCancela')}</span>
                        : <span className="badge bg-success-50 text-success-700">{t('adm.pagos.activa')}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {s.periodo_fin ? formatDate(s.periodo_fin) : '—'}
                      {s.modo === 'test' && <span className="ml-2 badge bg-slate-100 text-slate-500">{t('adm.pagos.prueba')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de cobros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input className="input pl-9" type="search" aria-label={t('adm.pagos.buscar')} placeholder={t('adm.pagos.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {([['todos', t('adm.pagos.fTodos')], ['folio_topup', t('adm.pagos.fFolios')], ['modulo', t('adm.pagos.fModulos')]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">{pagos.length === 0 ? t('adm.pagos.sinCobros') : t('adm.pagos.sinResultados')}</p>
          <p className="text-sm text-slate-500 mt-1">
            {pagos.length === 0 ? t('adm.pagos.aparecerCobros') : t('adm.pagos.otroFiltro')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">{t('adm.pagos.colConcepto')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.pagos.colCliente')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.pagos.colMonto')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.pagos.colFolios')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.pagos.colEstado')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.pagos.colFecha')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(p => {
                  const u = usuarios[p.user_id]
                  const esModulo = p.tipo === 'modulo'
                  const pagado = PAGADO.includes(p.estado)
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 ${!pagado ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <span aria-hidden="true" className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            esModulo ? 'bg-primary-50 text-primary-700' : 'bg-fondo text-navy-700'
                          }`}>
                            {esModulo ? <Blocks className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                          </span>
                          <div>
                            <p className="font-medium text-navy-900">{nombreCobro(p) ?? '—'}</p>
                            <p className="text-[11px] text-slate-500">{esModulo ? t('adm.pagos.suscripcionMensual') : t('adm.pagos.recargaFolios')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{empresas[p.workspace_id] ?? u?.nombre ?? '—'}</p>
                        {u?.email && <p className="text-[11px] text-slate-500">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(p.monto, p.moneda)}</td>
                      <td className="px-4 py-3 text-slate-500">{p.folios_cantidad ? `+${p.folios_cantidad}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          pagado ? 'bg-success-50 text-success-700'
                          : p.estado === 'pendiente' ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                        }`}>
                          {pagado ? t('adm.pagos.cobrado') : p.estado}
                        </span>
                        {p.metadata?.modo === 'test' && <span className="ml-1.5 badge bg-slate-100 text-slate-500">{t('adm.pagos.prueba')}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDatetime(p.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Popup: datos fiscales del cliente (solo lo necesario para facturar) */}
      {verFiscal && (
        <Modal titulo={<span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-700" aria-hidden="true" /> {t('adm.pagos.facFiscalTitle')}</span>}
          onClose={() => setVerFiscal(null)} ancho="max-w-md">
            <div>
              {verFiscal.loading ? (
                <div role="status" className="py-6 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
              ) : (() => {
                const e = verFiscal.emp
                const filas: [string, string | null][] = [
                  [t('cfg.razonSocial'), e?.razon_social || e?.nombre_comercial || verFiscal.f?.razon_social],
                  [t('cfg.rfc'), e?.rfc || verFiscal.f?.rfc],
                  [t('cfg.regimenFiscal'), e?.regimen_fiscal],
                  [t('cfg.usoCfdi'), e?.uso_cfdi],
                  [t('cfg.cp'), e?.codigo_postal],
                  [t('cfg.direccion'), e?.direccion],
                  [t('cfg.pais'), e?.pais],
                  [t('cfg.emailEmpresa'), e?.email],
                ]
                const hayAlgo = filas.some(([, v]) => !!v)
                if (!hayAlgo) return <div className="py-4 text-center text-slate-500 text-sm">{t('adm.pagos.facSinFiscal')}</div>
                return (
                  <dl className="divide-y divide-slate-100">
                    {filas.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4 py-2.5">
                        <dt className="text-xs text-slate-500 shrink-0">{k}</dt>
                        <dd className="text-sm font-medium text-navy-900 text-right break-words">{v || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )
              })()}
            </div>
            <div className="pt-5">
              <button type="button" onClick={() => setVerFiscal(null)} className="btn-secondary w-full justify-center">{t('adm.pagos.facCerrar')}</button>
            </div>
        </Modal>
      )}
    </div>
  )
}
