// Cliente de SENHUB (Lite) para el hub de facturación.
// SEGURIDAD (28-oct-2026): SOLO acepta llamadas INTERNAS (otras funciones de este
// proyecto: facturar, facturacion-api, facturacion-admin), que mandan la cabecera
// x-cg-interna con la service role key. Antes era pública: cualquiera podía timbrar
// o cancelar CFDI reales con el RFC del emisor.
// (29-oct-2026) SIN DOBLE TIMBRADO: antes de llamar a SENHUB se aparta el facturable
// (reservar_timbrado: 'pendiente' -> 'timbrando'); una segunda petición simultánea
// recibe 409. La Idempotency-Key ya no es aleatoria: sale del facturable + los datos
// enviados, así SENHUB devuelve el mismo CFDI si la misma petición llega dos veces.
// (29-oct-2026) Apps en grupo (facturacion_apps.grupo): un pago que dos apps
// registraron con la misma referencia_externa se timbra una sola vez.
// (29-oct-2026) Solo compras en MXN: el CFDI se arma con moneda MXN y tipo de
// cambio 1, así que una venta en dólares salía facturada como pesos.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SENHUB = 'https://lite.senhub.mx/api/v1'
const USO_CFDI_FIJO = 'G03' // Regla de negocio: TODAS las facturas van con Gastos en general.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-cg-interna', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE)

/** ¿La llamada viene de otra función de este proyecto? (comparación en tiempo constante) */
function esInterna(req: Request): boolean {
  const h = req.headers.get('x-cg-interna') ?? ''
  if (!SERVICE || h.length !== SERVICE.length) return false
  let d = 0
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ SERVICE.charCodeAt(i)
  return d === 0
}

/** Llave de idempotencia estable (formato UUID) a partir de un texto. */
async function llaveEstable(texto: string): Promise<string> {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

async function accessToken(): Promise<string> {
  const { data: cred } = await admin.from('facturacion_credenciales').select('*').eq('clave', 'senhub').maybeSingle()
  if (!cred) throw new Error('Sin credencial de SENHUB configurada')
  if (cred.modo === 'apikey' && cred.api_key) return cred.api_key
  if (cred.access_token && cred.access_expires_at && new Date(cred.access_expires_at).getTime() - Date.now() > 120000) return cred.access_token
  const r = await fetch(`${SENHUB}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: cred.refresh_token }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw new Error('No se pudo renovar el token de SENHUB: ' + JSON.stringify(d))
  const expires = new Date(Date.now() + (Number(d.expires_in) || 1800) * 1000).toISOString()
  const upd: any = { access_token: d.access_token, access_expires_at: expires, updated_at: new Date().toISOString() }
  if (d.refresh_token) upd.refresh_token = d.refresh_token   // guarda el token rotado si SENHUB lo devuelve
  await admin.from('facturacion_credenciales').update(upd).eq('clave', 'senhub')
  return d.access_token as string
}

async function senhub(path: string, opts: any = {}) {
  const token = await accessToken()
  const r = await fetch(`${SENHUB}${path}`, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  const text = await r.text(); let body: any; try { body = JSON.parse(text) } catch { body = text }
  return { ok: r.ok, status: r.status, body }
}

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d }

function construirCFDI(p: any) {
  const conceptos = (p.conceptos ?? []).map((c: any) => {
    const cantidad = n(c.cantidad, 1), vu = n(c.valor_unitario), descuento = n(c.descuento)
    const tasa = c.iva_tasa != null ? n(c.iva_tasa, 0.16) : 0.16
    const concepto: any = { clave_prod_serv: c.clave_prod_serv || '01010101', cantidad, clave_unidad: c.clave_unidad || 'E48', descripcion: c.descripcion || 'Servicio', valor_unitario: vu, objeto_imp: tasa > 0 ? '02' : '01' }
    if (descuento > 0) concepto.descuento = descuento
    if (tasa > 0) concepto.traslados = [{ impuesto: '002', tipo_factor: 'Tasa', tasa_o_cuota: tasa.toFixed(6) }]
    return concepto
  })
  const payload: any = { emisor_rfc: p.emisor.rfc, emisor_nombre: p.emisor.nombre, emisor_regimen: p.emisor.regimen_fiscal, lugar_expedicion: p.emisor.lugar_expedicion, tipo_de_comprobante: 'I', moneda: 'MXN', tipo_cambio: '1', exportacion: '01', forma_pago: p.forma_pago || '03', metodo_pago: p.metodo_pago || 'PUE', receptor: { rfc: p.receptor.rfc, nombre: p.receptor.nombre, domicilio_fiscal_receptor: p.receptor.cp, regimen_fiscal_receptor: p.receptor.regimen, uso_cfdi: USO_CFDI_FIJO }, conceptos }
  if (p.sandbox) payload.sandbox = true
  return payload
}

function totales(conceptos: any[]) {
  let subtotal = 0, descuento = 0, iva = 0
  for (const c of conceptos) { const cantidad = n(c.cantidad, 1), vu = n(c.valor_unitario), d = n(c.descuento); const tasa = c.iva_tasa != null ? n(c.iva_tasa, 0.16) : 0.16; const base = cantidad * vu - d; subtotal += cantidad * vu; descuento += d; iva += base * tasa }
  return { subtotal: +subtotal.toFixed(2), descuento: +descuento.toFixed(2), iva: +iva.toFixed(2), total: +(subtotal - descuento + iva).toFixed(2) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!esInterna(req)) return json({ error: 'No autorizado' }, 401)
  try {
    const input = await req.json().catch(() => ({} as any))
    const accion = input.accion || 'ping'

    if (accion === 'ping') {
      const bal = await senhub('/creditos/balance')
      const ent = await senhub(`/timbrado/entorno?emisor_rfc=${encodeURIComponent(input.emisor_rfc || 'EKU9003173C9')}`)
      return json({ ok: true, balance: bal.body, entorno: ent.body })
    }

    if (accion === 'catalogo') {
      const nombre = String(input.nombre || 'clave-prod-serv')
      const q = encodeURIComponent(String(input.q || ''))
      const r = await senhub(`/catalogos/${nombre}?q=${q}&limit=${n(input.limit, 15)}`)
      return json({ ok: r.ok, resultados: r.body })
    }

    if (accion === 'cancelar') {
      let emisor_rfc = input.emisor_rfc
      if (!emisor_rfc) { const { data } = await admin.from('facturacion_emisor').select('rfc').eq('activo', true).limit(1).maybeSingle(); emisor_rfc = data?.rfc }
      if (!emisor_rfc || !input.uuid) return json({ error: 'Falta emisor_rfc o uuid' }, 400)
      const res = await senhub('/timbrado/cancelar', { method: 'POST', body: JSON.stringify({ emisor_rfc, uuid: input.uuid, motivo: input.motivo || '02', folio_sustitucion: input.folio_sustitucion || null }) })
      if (res.ok) await admin.from('facturas').update({ estado: 'cancelada' }).eq('uuid_sat', input.uuid)
      return json({ ok: res.ok, status: res.status, resultado: res.body })
    }

    if (accion === 'timbrar') {
      let emisor = input.emisor
      if (!emisor) { const { data } = await admin.from('facturacion_emisor').select('*').eq('activo', true).limit(1).maybeSingle(); emisor = data }
      if (!emisor) return json({ error: 'Sin emisor configurado' }, 400)
      if (!input.receptor?.rfc) return json({ error: 'Falta receptor.rfc' }, 400)
      input.receptor.uso_cfdi = USO_CFDI_FIJO   // Regla de negocio: siempre Gastos en general.
      const conceptos = input.conceptos ?? []
      if (!conceptos.length) return json({ error: 'Falta al menos un concepto' }, 400)
      const payload = construirCFDI({ ...input, emisor })

      // Candado: una sola petición a la vez por facturable, y nunca si ya se facturó.
      const fid = input.facturable_id ?? null
      if (fid) {
        const { data: fm } = await admin.from('facturables').select('moneda, app_id, referencia_externa').eq('id', fid).maybeSingle()
        const moneda = String(fm?.moneda || 'MXN').toUpperCase()
        if (moneda !== 'MXN') return json({ ok: false, error: `Esta compra se pagó en ${moneda}; por ahora solo se facturan compras en pesos mexicanos. Escríbenos y te ayudamos.` }, 409)
        // Mismo pago registrado por otra app del grupo (Fidelízalo: tienda y panel):
        // si allá ya se facturó o se está facturando, aquí no se vuelve a timbrar.
        if (fm?.app_id && fm.referencia_externa) {
          const { data: grupo } = await admin.rpc('apps_del_grupo', { p_app: fm.app_id })
          if (Array.isArray(grupo) && grupo.length > 1) {
            const { data: gemelo } = await admin.from('facturables').select('id').in('app_id', grupo)
              .eq('referencia_externa', fm.referencia_externa).neq('id', fid).in('estado', ['facturado', 'timbrando']).limit(1).maybeSingle()
            if (gemelo) return json({ ok: false, error: 'Esta compra ya fue facturada.' }, 409)
          }
        }
        const { data: reservado, error: eRes } = await admin.rpc('reservar_timbrado', { facturable: fid })
        if (eRes) return json({ ok: false, error: 'No se pudo apartar la factura: ' + eRes.message }, 500)
        if (!reservado) {
          const { data: f } = await admin.from('facturables').select('estado').eq('id', fid).maybeSingle()
          return json({ ok: false, error: f?.estado === 'facturado' ? 'Esta compra ya fue facturada.' : 'Esta factura ya se está generando. Espera unos segundos y recarga.' }, 409)
        }
      }
      const liberar = async () => { if (fid) await admin.from('facturables').update({ estado: 'pendiente', timbrando_at: null }).eq('id', fid).eq('estado', 'timbrando') }

      const idem = fid ? await llaveEstable(`${fid}:${JSON.stringify(payload)}`) : crypto.randomUUID()
      let res
      try {
        res = await senhub('/timbrado/timbrar', { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify(payload) })
      } catch (e) { await liberar(); throw e }
      if (!res.ok) { await liberar(); return json({ ok: false, status: res.status, error: res.body }, res.status) }
      const uuid = res.body?.uuid; const t = totales(conceptos); const sandbox = !!(res.body?.sandbox)
      let xml_path: string | null = null, pdf_path: string | null = null
      if (uuid) {
        try { const xr = await senhub(`/timbrado/cfdi/${uuid}/xml`); if (xr.ok) { const p = `${uuid}.xml`; const blob = new Blob([typeof xr.body === 'string' ? xr.body : JSON.stringify(xr.body)], { type: 'application/xml' }); const up = await admin.storage.from('facturas').upload(p, blob, { upsert: true, contentType: 'application/xml' }); if (!up.error) xml_path = p } } catch { /* */ }
        try { const token = await accessToken(); const pr = await fetch(`${SENHUB}/timbrado/cfdi/${uuid}/pdf`, { headers: { Authorization: 'Bearer ' + token } }); if (pr.ok) { const buf = new Uint8Array(await pr.arrayBuffer()); const p = `${uuid}.pdf`; const up = await admin.storage.from('facturas').upload(p, buf, { upsert: true, contentType: 'application/pdf' }); if (!up.error) pdf_path = p } } catch { /* */ }
      }
      // Si SENHUB devolvió un CFDI ya registrado (misma llave), no se duplica la fila.
      let factura: any = null
      if (uuid) { const { data } = await admin.from('facturas').select('*').eq('uuid_sat', uuid).maybeSingle(); factura = data }
      if (!factura) {
        const { data } = await admin.from('facturas').insert({ facturable_id: fid, emisor_rfc: emisor.rfc, receptor_rfc: input.receptor.rfc, receptor_nombre: input.receptor.nombre, receptor_cp: input.receptor.cp, receptor_regimen: input.receptor.regimen, uso_cfdi: USO_CFDI_FIJO, receptor_email: input.receptor.email ?? null, uuid_sat: uuid ?? null, serie: res.body?.serie ?? null, folio: res.body?.folio ?? null, subtotal: t.subtotal, iva: t.iva, total: t.total, moneda: 'MXN', xml_path, pdf_path, estado: 'vigente', sandbox, senhub_id: res.body?.id ?? null }).select('*').single()
        factura = data
      }
      if (fid && factura) { await admin.from('facturables').update({ estado: 'facturado', factura_id: factura.id, facturado_at: new Date().toISOString(), timbrando_at: null }).eq('id', fid) }
      return json({ ok: true, uuid, sandbox, serie: res.body?.serie, folio: res.body?.folio, total: t.total, factura_id: factura?.id, xml_path, pdf_path })
    }

    return json({ error: 'Acción no soportada: ' + accion }, 400)
  } catch (e) { return json({ error: String(e) }, 500) }
})
