// Portal de autofacturación. Solo se llega DESDE LA CUENTA de cada quien:
//  - Cotiza Go: Notas y facturas -> /facturar?t=<token> con la sesión iniciada.
//  - Tiendas (Woo): Mi cuenta › Pedidos › Facturar -> ?pedido=&app=&k=<clave del pedido>.
//  - Apps por API: el enlace con &k= que la app muestra a su cliente.
// El folio solo, o el # de pedido solo, ya no sirven (28-oct-2026). Ve lo que va
// a facturar, captura sus datos fiscales y genera su CFDI (PDF + XML) al instante.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NavPublica from '../../components/NavPublica'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { descargarCFDI } from '../../lib/cfdiPdf'
import { FileText, Download, CheckCircle, Loader2, Building2, UserRound } from 'lucide-react'

const EP = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facturar`

const REGIMENES: [string, string][] = [
  ['605', 'Sueldos y Salarios e Ingresos Asimilados'],
  ['606', 'Arrendamiento'],
  ['608', 'Demás ingresos'],
  ['611', 'Ingresos por Dividendos'],
  ['612', 'Personas Físicas con Actividades Empresariales y Profesionales'],
  ['614', 'Ingresos por intereses'],
  ['616', 'Sin obligaciones fiscales'],
  ['621', 'Incorporación Fiscal'],
  ['625', 'Actividades Empresariales con ingresos por Plataformas Tecnológicas'],
  ['626', 'Régimen Simplificado de Confianza (RESICO)'],
  ['601', 'General de Ley Personas Morales'],
  ['603', 'Personas Morales con Fines no Lucrativos'],
]

const money = (v: number, m = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: m }).format(Number(v) || 0)

export default function FacturarPage() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  // Modo embed: el portal se incrusta dentro del sitio del negocio (ej.
  // fidelizalo.com.mx/facturar). Ocultamos la barra de Cotiza Go y mostramos la
  // marca del negocio, para que el cliente sienta que nunca salió de su tienda.
  const embed = params.get('embed') === '1'
  const [marca, setMarca] = useState<any>(null)
  const [token, setToken] = useState(params.get('t') || '')
  // Clave de acceso de la venta (la da la tienda/app desde la cuenta del cliente).
  const clave = params.get('k') || ''
  const [paso, setPaso] = useState<'folio' | 'datos' | 'listo'>('folio')
  const [fact, setFact] = useState<any>(null)
  const [form, setForm] = useState({ rfc: '', nombre: '', cp: '', regimen: '', uso_cfdi: 'G03', email: '' })
  const [cargando, setCargando] = useState(false)
  const [pdfCargando, setPdfCargando] = useState(false)
  const [error, setError] = useState('')
  const [res, setRes] = useState<any>(null)
  // El aviso de error va arriba: en teléfono puede quedar fuera de vista al
  // enviar el formulario, así que lo traemos a pantalla cuando aparece.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  // Descarga el PDF del CFDI generado por nosotros (con el logo de la marca),
  // renderizado a partir del XML fiscal.
  async function descargarPdf() {
    if (!res?.xml_url) return
    setPdfCargando(true)
    try {
      const r = await fetch(res.xml_url)
      const xml = await r.text()
      await descargarCFDI(xml, res.marca || {})
    } catch { setError('No se pudo generar el PDF. Descarga el XML mientras tanto.') }
    finally { setPdfCargando(false) }
  }

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))
  // El RFC se guarda en mayúsculas de verdad (antes solo se veía así por CSS).
  const setRfc = (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))

  async function llamar(body: any) {
    // Compras de Cotiza Go: el servidor comprueba que la sesión sea del dueño.
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session) headers.Authorization = `Bearer ${session.access_token}`
    const r = await fetch(EP, { method: 'POST', headers, body: JSON.stringify({ ...body, ...(clave ? { k: clave } : {}) }) })
    const d = await r.json().catch(() => ({}))
    return { ok: r.ok, d }
  }

  async function buscar(tk: string) {
    setError(''); setCargando(true)
    try {
      const { ok, d } = await llamar({ accion: 'buscar', token: tk.trim() })
      if (!ok || !d.ok) { setError(d.error || 'No encontramos ese folio.'); return }
      if (d.marca) setMarca(d.marca)
      setFact(d.facturable); setToken(tk.trim())
      if (d.facturable.ya_facturado) {
        if (d.descarga) { setRes({ ...d.descarga, marca: d.marca }); setPaso('listo') }   // ya facturado → mostrar descarga
        else setError('Este folio ya fue facturado.')
        return
      }
      // Regla del mes: solo se factura dentro del mes de la compra.
      if (d.vencido) {
        setError('El plazo para facturar esta compra venció. Las facturas solo se pueden generar dentro del mes en que se realizó el pago.')
        return
      }
      // Memoria: si ya facturó antes, pre-llenamos sus datos fiscales guardados.
      if (d.receptor) {
        setForm(f => ({
          rfc: d.receptor.rfc || f.rfc,
          nombre: d.receptor.nombre || f.nombre,
          cp: d.receptor.cp || f.cp,
          regimen: d.receptor.regimen || f.regimen,
          uso_cfdi: 'G03',
          email: d.receptor.email || f.email,
        }))
      }
      setPaso('datos')
    } catch { setError('Error de conexión. Intenta de nuevo.') }
    finally { setCargando(false) }
  }

  async function timbrar(e: React.FormEvent) {
    e.preventDefault(); setError(''); setCargando(true)
    try {
      const { ok, d } = await llamar({ accion: 'timbrar', token, receptor: form })
      if (!ok || !d.ok) { setError(typeof d.error === 'string' ? d.error : 'No se pudo generar la factura. Revisa tus datos fiscales.'); return }
      setRes(d); setPaso('listo')
    } catch { setError('Error de conexión. Intenta de nuevo.') }
    finally { setCargando(false) }
  }

  // Resuelve el folio a partir del # de pedido (botón "Facturar" de Mi cuenta).
  async function resolverPedido(pedido: string, app: string) {
    setError(''); setCargando(true)
    try {
      const { ok, d } = await llamar({ accion: 'resolver_pedido', pedido, app })
      if (!ok || !d.ok) {
        if (d.motivo === 'fuera_de_mes') setError('El plazo para facturar esta compra venció. Las facturas solo se pueden generar dentro del mes en que se realizó el pago.')
        else if (d.motivo === 'no_pagado') setError('Esta compra aún no aparece como pagada.')
        else if (d.motivo === 'sin_clave') setError(d.error)
        else setError('No pudimos preparar la facturación de este pedido. Entra de nuevo desde Mi cuenta › Pedidos.')
        return
      }
      await buscar(d.token)
    } catch { setError('Error de conexión. Intenta de nuevo.') }
    finally { setCargando(false) }
  }

  // Autobúsqueda: por folio (?t=) o por número de pedido (?pedido=&app=)
  useEffect(() => {
    const t = params.get('t'); const pedido = params.get('pedido'); const app = params.get('app')
    if (t) buscar(t)
    else if (pedido && app) resolverPedido(pedido, app)
    /* eslint-disable-next-line */
  }, [])

  // Si el usuario está logueado, pre-llena sus datos fiscales desde su empresa.
  useEffect(() => {
    if (!profile?.workspace_id) return
    supabase.from('empresas').select('rfc,razon_social,nombre_comercial,regimen_fiscal,uso_cfdi,codigo_postal')
      .eq('workspace_id', profile.workspace_id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setForm(f => ({
          rfc: f.rfc || (data.rfc ?? ''),
          nombre: f.nombre || (data.razon_social ?? data.nombre_comercial ?? ''),
          cp: f.cp || (data.codigo_postal ?? ''),
          regimen: f.regimen || (data.regimen_fiscal ?? ''),
          uso_cfdi: 'G03',
          email: f.email,
        }))
      })
  }, [profile?.workspace_id])

  return (
    <div className={embed ? 'min-h-screen bg-white' : 'min-h-screen bg-slate-50'}>
      {!embed && <NavPublica />}
      <main className="max-w-xl mx-auto px-4 py-8 lg:py-12">
        <div className="flex items-center gap-3 mb-6">
          {embed && marca?.logo_url ? (
            <img src={marca.logo_url} alt={marca.nombre || ''} className="h-11 max-w-[170px] object-contain" />
          ) : (
            <span className="w-11 h-11 rounded-xl bg-primary-600 text-navy-900 flex items-center justify-center"><FileText className="w-5 h-5" aria-hidden="true" /></span>
          )}
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary-700 uppercase">Facturación en línea</p>
            <h1 className="text-2xl font-extrabold text-navy-900">Genera tu factura (CFDI)</h1>
          </div>
        </div>

        {error && <div ref={errorRef} role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 scroll-mt-20">{error}</div>}

        {/* Paso 1: se llega desde la cuenta del cliente; aquí no se escribe ningún folio */}
        {paso === 'folio' && (cargando ? (
          <div className="card p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-700" role="status" aria-label="Cargando" /></div>
        ) : (
          <div className="card p-6">
            <p className="text-sm font-semibold text-navy-900 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary-700" aria-hidden="true" /> Factura desde tu cuenta</p>
            <p className="text-sm text-slate-600 mt-2">Por seguridad, cada compra se factura solo desde la cuenta de quien la hizo:</p>
            <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc pl-5">
              <li>Si compraste en una tienda: entra a <strong>Mi cuenta › Pedidos</strong> y pulsa <strong>Facturar</strong>.</li>
              <li>Si eres cliente de Cotiza Go: inicia sesión y ve a <strong>Notas y facturas</strong>.</li>
            </ul>
          </div>
        ))}

        {/* Paso 2: datos fiscales */}
        {paso === 'datos' && fact && (
          <form onSubmit={timbrar} className="space-y-4">
            <div className="card p-5 bg-primary-50/40 border border-primary-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vas a facturar</p>
              <p className="text-navy-900 font-medium mt-1">{fact.descripcion}</p>
              <p className="text-2xl font-extrabold text-navy-900 mt-1">{money(fact.total, fact.moneda)}</p>
            </div>
            <div className="card p-5 space-y-4">
              <p className="text-sm font-semibold text-navy-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-700" aria-hidden="true" /> Tus datos fiscales</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label htmlFor="fac-rfc" className="label">RFC</label><input id="fac-rfc" className="input uppercase" required maxLength={13} autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={form.rfc} onChange={setRfc} placeholder="XAXX010101000" /></div>
                <div><label htmlFor="fac-cp" className="label">Código postal (fiscal)</label><input id="fac-cp" className="input" required maxLength={5} inputMode="numeric" pattern="\d{5}" autoComplete="postal-code" value={form.cp} onChange={set('cp')} placeholder="06600" /></div>
              </div>
              <div><label htmlFor="fac-nombre" className="label">Razón social / Nombre (como en tu Constancia)</label><input id="fac-nombre" className="input" required autoComplete="organization" value={form.nombre} onChange={set('nombre')} placeholder="Tal como aparece en el SAT" /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label htmlFor="fac-regimen" className="label">Régimen fiscal</label>
                  <select id="fac-regimen" className="input" required value={form.regimen} onChange={set('regimen')}>
                    <option value="">Selecciona…</option>
                    {REGIMENES.map(([v, l]) => <option key={v} value={v}>{v} · {l}</option>)}
                  </select>
                </div>
                {/* Fijo en G03: campo de solo lectura (antes era un div con look de input, sin etiqueta ligada) */}
                <div><label htmlFor="fac-uso" className="label">Uso del CFDI</label>
                  <input id="fac-uso" className="input bg-slate-50 text-slate-600 cursor-not-allowed" readOnly aria-readonly="true" value="G03 · Gastos en general" />
                </div>
              </div>
              <div><label htmlFor="fac-email" className="label">Correo (para enviarte la factura)</label><input id="fac-email" type="email" inputMode="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} placeholder="tu@correo.com" /></div>
            </div>
            <button type="submit" disabled={cargando} className="btn-primary w-full justify-center py-3">
              {cargando ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando…</> : 'Generar mi factura'}
            </button>
            <p className="text-center text-[11px] text-slate-500">Verifica que tus datos coincidan EXACTO con tu Constancia de Situación Fiscal.</p>
          </form>
        )}

        {/* Paso 3: listo */}
        {paso === 'listo' && res && (
          <div className="card p-6 text-center">
            <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-xl font-bold text-navy-900">¡Tu factura está lista!</h2>
            <p className="text-sm text-slate-500 mt-1">Folio fiscal (UUID):</p>
            <p className="font-mono text-xs text-slate-600 break-all mt-0.5">{res.uuid}</p>
            {res.sandbox && <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">Modo prueba (sandbox)</p>}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              {res.xml_url && (
                <button onClick={descargarPdf} disabled={pdfCargando} className="btn-primary flex-1 justify-center">
                  {pdfCargando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />} Descargar PDF
                </button>
              )}
              {res.xml_url && <a href={res.xml_url} target="_blank" rel="noreferrer" className="btn-secondary flex-1 justify-center"><Download className="w-4 h-4" aria-hidden="true" /> Descargar XML</a>}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">Facturación CFDI 4.0{embed ? (marca?.nombre ? ` · ${marca.nombre}` : '') : ' · Cotiza Go'}</p>
      </main>
    </div>
  )
}
