// Panel de administración del hub de facturación (solo superadmin).
// Gestiona: el EMISOR (RFC único), las EMPRESAS/marcas (logo, color, config de
// WooCommerce, llave API, secreto de webhook) y sus PRODUCTOS (con claves SAT).
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import ConexionSenhub from '../../components/ConexionSenhub'
import {
  Plus, Save, RefreshCw, KeyRound, Copy, Check, Building2, Package, Webhook, Upload, Trash2, Loader2,
} from 'lucide-react'

const ENDPOINT_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facturacion-api`

export default function AdminFacturacionPage() {
  const [apps, setApps] = useState<any[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [sel, setSel] = useState<any>(null)
  const [productos, setProductos] = useState<any[]>([])
  const [emisor, setEmisor] = useState<any>(null)
  const [tokenNuevo, setTokenNuevo] = useState('')
  const [secretNuevo, setSecretNuevo] = useState('')
  const [busy, setBusy] = useState('')
  const [copiado, setCopiado] = useState('')

  const loadApps = async () => {
    const { data } = await supabase.from('facturacion_apps').select('*').order('created_at')
    setApps(data ?? [])
  }
  const loadEmisor = async () => {
    const { data } = await supabase.from('facturacion_emisor').select('*').limit(1).maybeSingle()
    setEmisor(data ?? { rfc: '', nombre: '', regimen_fiscal: '', lugar_expedicion: '', serie: 'A', activo: true })
  }
  const loadProductos = async (appId: string) => {
    const { data } = await supabase.from('facturacion_productos').select('*').eq('app_id', appId).order('nombre')
    setProductos(data ?? [])
  }

  useEffect(() => { loadApps(); loadEmisor() }, [])
  // Refleja en `sel` los datos de la empresa seleccionada. Corre también cuando
  // se recarga la lista (loadApps) para que el badge "llave ✓" se actualice.
  useEffect(() => {
    const a = apps.find(x => x.id === selId) || null
    setSel(a ? { ...a } : null)
  }, [selId, apps])
  // Limpieza SOLO al cambiar de empresa (no al recargar la lista): antes esto
  // dependía de [selId, apps] y borraba la llave/secreto recién generados en
  // cuanto generarKey() llamaba a loadApps(). Por eso "desaparecía al generar".
  useEffect(() => {
    setTokenNuevo(''); setSecretNuevo('')
    if (selId) loadProductos(selId)
  }, [selId])

  const fnAdmin = async (accion: string) => {
    if (!selId) return
    setBusy(accion)
    try {
      const { data, error } = await supabase.functions.invoke('facturacion-admin', { body: { accion, app_id: selId } })
      if (error || data?.error) { toast.error(data?.error || 'Error'); return null }
      return data
    } finally { setBusy('') }
  }

  const crearApp = async () => {
    const { data, error } = await supabase.from('facturacion_apps').insert({ nombre: 'Nueva empresa', color: '#06213B', activo: true }).select('id').single()
    if (error) { toast.error('No se pudo crear'); return }
    await loadApps(); setSelId(data.id); toast.success('Empresa creada')
  }
  const guardarApp = async () => {
    if (!sel) return
    setBusy('guardar')
    const { error } = await supabase.from('facturacion_apps').update({
      nombre: sel.nombre, nombre_comercial: sel.nombre_comercial, color: sel.color, activo: sel.activo,
      woo_url: sel.woo_url, woo_consumer_key: sel.woo_consumer_key, woo_consumer_secret: sel.woo_consumer_secret,
    }).eq('id', sel.id)
    setBusy('')
    if (error) toast.error('No se pudo guardar'); else { toast.success('Guardado'); loadApps() }
  }
  const subirLogo = async (file: File) => {
    if (!sel) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2 MB'); return }
    setBusy('logo')
    const ext = file.name.split('.').pop()
    const ruta = `facturacion/${sel.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(ruta, file, { upsert: true, contentType: file.type })
    if (error) { toast.error('No se pudo subir'); setBusy(''); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(ruta)
    await supabase.from('facturacion_apps').update({ logo_url: data.publicUrl }).eq('id', sel.id)
    setSel((s: any) => ({ ...s, logo_url: data.publicUrl })); loadApps(); setBusy(''); toast.success('Logo actualizado')
  }
  const generarKey = async () => {
    // Regenerar invalida la llave anterior: las apps que la usan dejan de facturar.
    if (sel?.prefijo && !confirm('¿Regenerar la llave? La llave actual dejará de funcionar y tendrás que actualizarla en las apps que la usan.')) return
    const d = await fnAdmin('generar_key'); if (d?.token) { setTokenNuevo(d.token); loadApps() }
  }
  const generarSecret = async () => { const d = await fnAdmin('webhook_secret'); if (d?.secret) { setSecretNuevo(d.secret); loadApps() } }
  const sincronizar = async () => { const d = await fnAdmin('sync_woo'); if (d?.ok) { toast.success(`${d.sincronizados} productos sincronizados`); loadProductos(selId!) } }

  const setProd = (i: number, campo: string, val: any) => setProductos(prev => prev.map((p, idx) => idx === i ? { ...p, [campo]: val } : p))
  const guardarProd = async (p: any) => {
    const { error } = await supabase.from('facturacion_productos').update({
      nombre: p.nombre, precio: p.precio, iva_tasa: p.iva_tasa, clave_prod_serv: p.clave_prod_serv, clave_unidad: p.clave_unidad, activo: p.activo,
    }).eq('id', p.id)
    if (error) toast.error('No se pudo guardar'); else toast.success('Producto guardado')
  }
  const guardarEmisor = async () => {
    setBusy('emisor')
    const payload = { rfc: emisor.rfc, nombre: emisor.nombre, regimen_fiscal: emisor.regimen_fiscal, lugar_expedicion: emisor.lugar_expedicion, serie: emisor.serie || 'A', activo: true }
    const { error } = emisor.id
      ? await supabase.from('facturacion_emisor').update(payload).eq('id', emisor.id)
      : await supabase.from('facturacion_emisor').insert(payload)
    setBusy('')
    if (error) toast.error('No se pudo guardar'); else { toast.success('Emisor guardado'); loadEmisor() }
  }

  const copiar = (txt: string, id: string) => { navigator.clipboard.writeText(txt); setCopiado(id); setTimeout(() => setCopiado(''), 1500) }
  const setS = (campo: string) => (e: any) => setSel((s: any) => ({ ...s, [campo]: e.target.value }))
  const setE = (campo: string) => (e: any) => setEmisor((s: any) => ({ ...s, [campo]: e.target.value }))

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Facturación · Empresas</h1>
        <p className="text-slate-500 text-sm">Configura el emisor, cada empresa/marca con su logo y sus productos para facturar.</p>
      </div>

      {/* CONEXIÓN CON SENHUB: estado del timbrado y reconexión con código del correo */}
      <ConexionSenhub />

      {/* EMISOR */}
      {emisor && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-700" aria-hidden="true" /> Emisor (tu RFC — aparece en todas las facturas)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="label" htmlFor="emisor-rfc">RFC</label><input id="emisor-rfc" className="input uppercase" autoComplete="off" value={emisor.rfc ?? ''} onChange={setE('rfc')} /></div>
            <div className="lg:col-span-2"><label className="label" htmlFor="emisor-nombre">Razón social</label><input id="emisor-nombre" className="input" value={emisor.nombre ?? ''} onChange={setE('nombre')} /></div>
            <div><label className="label" htmlFor="emisor-regimen">Régimen fiscal</label><input id="emisor-regimen" className="input" inputMode="numeric" value={emisor.regimen_fiscal ?? ''} onChange={setE('regimen_fiscal')} placeholder="612" /></div>
            <div><label className="label" htmlFor="emisor-cp">CP (lugar de expedición)</label><input id="emisor-cp" className="input" inputMode="numeric" value={emisor.lugar_expedicion ?? ''} onChange={setE('lugar_expedicion')} placeholder="08500" /></div>
            <div><label className="label" htmlFor="emisor-serie">Serie</label><input id="emisor-serie" className="input" value={emisor.serie ?? 'A'} onChange={setE('serie')} /></div>
          </div>
          <button type="button" onClick={guardarEmisor} disabled={busy === 'emisor'} aria-busy={busy === 'emisor'} className="btn-navy text-xs mt-4"><Save className="w-4 h-4" aria-hidden="true" /> Guardar emisor</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Lista de empresas */}
        <div className="card p-4 lg:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-navy-900">Empresas</p>
            <button type="button" onClick={crearApp} className="btn-primary text-xs py-1.5 px-2.5"><Plus className="w-3.5 h-3.5" aria-hidden="true" /> Nueva</button>
          </div>
          <div className="space-y-1.5">
            {apps.map(a => (
              <button key={a.id} type="button" onClick={() => setSelId(a.id)} aria-pressed={selId === a.id} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${selId === a.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                <span aria-hidden="true" className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden" style={{ backgroundColor: a.color || '#06213B' }}>
                  {a.logo_url ? <img src={a.logo_url} alt="" className="w-full h-full object-contain bg-white" /> : (a.nombre_comercial || a.nombre || '?')[0]}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-900 truncate">{a.nombre_comercial || a.nombre}</span>
                  <span className="block text-[11px] text-slate-500">{a.activo ? 'Activa' : 'Inactiva'}{a.prefijo ? ' · llave ✓' : ''}</span>
                </span>
              </button>
            ))}
            {apps.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Aún no hay empresas. Crea la primera.</p>}
          </div>
        </div>

        {/* Detalle de la empresa seleccionada */}
        <div className="lg:col-span-2 space-y-5">
          {!sel ? (
            <div className="card p-10 text-center text-slate-500 text-sm">Selecciona o crea una empresa.</div>
          ) : (
            <>
              {/* Datos + marca */}
              <div className="card p-5 space-y-4">
                <p className="text-sm font-semibold text-navy-900">Datos y marca</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-24 h-16 rounded-xl border border-dashed border-slate-300 bg-fondo flex items-center justify-center overflow-hidden shrink-0">
                    {sel.logo_url ? <img src={sel.logo_url} alt={`Logo de ${sel.nombre_comercial || sel.nombre}`} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-slate-500">Sin logo</span>}
                  </div>
                  {/* El input va con sr-only (no display:none) para que se pueda alcanzar con Tab. */}
                  <label className="btn-secondary text-xs cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'logo' ? 'Subiendo…' : 'Subir logo'}
                    <input type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && subirLogo(e.target.files[0])} />
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="label !mb-0" htmlFor="app-color">Color</label>
                    <input id="app-color" type="color" value={sel.color || '#06213B'} onChange={setS('color')} className="w-9 h-9 rounded border border-slate-200" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="app-nombre">Nombre interno</label><input id="app-nombre" className="input" value={sel.nombre ?? ''} onChange={setS('nombre')} /></div>
                  <div><label className="label" htmlFor="app-comercial">Nombre comercial (aparece en el PDF)</label><input id="app-comercial" className="input" value={sel.nombre_comercial ?? ''} onChange={setS('nombre_comercial')} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={!!sel.activo} onChange={e => setSel((s: any) => ({ ...s, activo: e.target.checked }))} /> Empresa activa</label>
                <button type="button" onClick={guardarApp} disabled={busy === 'guardar'} aria-busy={busy === 'guardar'} className="btn-navy text-xs"><Save className="w-4 h-4" aria-hidden="true" /> Guardar datos</button>
              </div>

              {/* Llave API + webhook */}
              <div className="card p-5 space-y-4">
                <p className="text-sm font-semibold text-navy-900 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary-700" aria-hidden="true" /> Llave API y webhook</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={generarKey} disabled={busy === 'generar_key'} aria-busy={busy === 'generar_key'} className="btn-primary text-xs">{busy === 'generar_key' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <KeyRound className="w-4 h-4" aria-hidden="true" />} {sel.prefijo ? 'Regenerar llave' : 'Generar llave'}</button>
                  {sel.prefijo && <span className="text-xs text-slate-500">Prefijo actual: <code className="bg-fondo px-1.5 py-0.5 rounded">{sel.prefijo}…</code></span>}
                </div>
                {tokenNuevo && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-[11px] text-amber-800 mb-1">Guárdala, se muestra una sola vez:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white rounded px-2 py-1.5 break-all">{tokenNuevo}</code>
                      <button type="button" onClick={() => copiar(tokenNuevo, 'tok')} aria-label={copiado === 'tok' ? 'Llave copiada' : 'Copiar llave'} className="btn-secondary text-xs py-1.5 px-2">{copiado === 'tok' ? <Check className="w-4 h-4 text-success-700" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}</button>
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-navy-900 flex items-center gap-1.5 mb-2"><Webhook className="w-3.5 h-3.5" aria-hidden="true" /> WooCommerce (para sincronizar productos y facturar al vender)</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <input className="input text-xs" type="url" aria-label="URL de la tienda WooCommerce" placeholder="https://tienda.com" value={sel.woo_url ?? ''} onChange={setS('woo_url')} />
                    <input className="input text-xs" aria-label="Consumer key de WooCommerce" autoComplete="off" placeholder="Consumer key (ck_...)" value={sel.woo_consumer_key ?? ''} onChange={setS('woo_consumer_key')} />
                    <input className="input text-xs" aria-label="Consumer secret de WooCommerce" autoComplete="off" placeholder="Consumer secret (cs_...)" value={sel.woo_consumer_secret ?? ''} onChange={setS('woo_consumer_secret')} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button type="button" onClick={guardarApp} className="btn-secondary text-xs"><Save className="w-3.5 h-3.5" aria-hidden="true" /> Guardar WooCommerce</button>
                    <button type="button" onClick={sincronizar} disabled={busy === 'sync_woo'} aria-busy={busy === 'sync_woo'} className="btn-primary text-xs">{busy === 'sync_woo' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />} Sincronizar productos</button>
                    <button type="button" onClick={generarSecret} disabled={busy === 'webhook_secret'} aria-busy={busy === 'webhook_secret'} className="btn-secondary text-xs">Generar secreto de webhook</button>
                  </div>
                  {secretNuevo && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 text-xs bg-fondo rounded px-2 py-1.5 break-all">{secretNuevo}</code>
                      <button type="button" onClick={() => copiar(secretNuevo, 'sec')} aria-label={copiado === 'sec' ? 'Secreto copiado' : 'Copiar secreto'} className="btn-secondary text-xs py-1.5 px-2">{copiado === 'sec' ? <Check className="w-4 h-4 text-success-700" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Productos */}
              <div className="card p-5">
                <p className="text-sm font-semibold text-navy-900 flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-primary-700" aria-hidden="true" /> Productos ({productos.length}) — asigna las claves SAT</p>
                {productos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Sin productos. Configura WooCommerce arriba y pulsa “Sincronizar productos”.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="py-2 pr-2 font-medium">Producto</th>
                          <th className="py-2 px-2 font-medium">Precio</th>
                          <th className="py-2 px-2 font-medium">IVA</th>
                          <th className="py-2 px-2 font-medium">Clave SAT (ProdServ)</th>
                          <th className="py-2 px-2 font-medium">Unidad</th>
                          <th className="py-2 pl-2"><span className="sr-only">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productos.map((p, i) => (
                          <tr key={p.id}>
                            <td className="py-2 pr-2"><input className="input py-1.5 text-xs" aria-label="Producto" value={p.nombre ?? ''} onChange={e => setProd(i, 'nombre', e.target.value)} /></td>
                            <td className="py-2 px-2 w-24"><input type="number" inputMode="decimal" step="0.01" className="input py-1.5 text-xs" aria-label={`Precio de ${p.nombre ?? 'producto'}`} value={p.precio ?? 0} onChange={e => setProd(i, 'precio', e.target.value)} /></td>
                            <td className="py-2 px-2 w-20"><input type="number" inputMode="decimal" step="0.01" className="input py-1.5 text-xs" aria-label={`IVA de ${p.nombre ?? 'producto'}`} value={p.iva_tasa ?? 0.16} onChange={e => setProd(i, 'iva_tasa', e.target.value)} /></td>
                            <td className="py-2 px-2 w-32"><input className={`input py-1.5 text-xs ${!p.clave_prod_serv ? 'border-amber-300 bg-amber-50/40' : ''}`} aria-label={`Clave SAT de ${p.nombre ?? 'producto'}`} aria-invalid={!p.clave_prod_serv} placeholder="81112101" value={p.clave_prod_serv ?? ''} onChange={e => setProd(i, 'clave_prod_serv', e.target.value)} /></td>
                            <td className="py-2 px-2 w-20"><input className="input py-1.5 text-xs" aria-label={`Unidad de ${p.nombre ?? 'producto'}`} value={p.clave_unidad ?? 'E48'} onChange={e => setProd(i, 'clave_unidad', e.target.value)} /></td>
                            <td className="py-2 pl-2"><button type="button" onClick={() => guardarProd(p)} aria-label={`Guardar ${p.nombre ?? 'producto'}`} title="Guardar" className="btn-secondary text-xs py-1.5 px-2"><Save className="w-3.5 h-3.5" aria-hidden="true" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-slate-500 mt-2">Los productos sin clave SAT (en ámbar) no se pueden facturar. Búscalas en el catálogo del SAT (c_ClaveProdServ).</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">Endpoint de la API para las apps: <code className="bg-fondo px-1.5 py-0.5 rounded">{ENDPOINT_API}</code></p>
    </div>
  )
}
