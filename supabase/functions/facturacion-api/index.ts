// API pública del hub de facturación para OTRAS apps (DropFlow, etc.).
// Autenticación por llave: Authorization: Bearer fx_live_...  (hash SHA-256 en
// facturacion_apps). Registra ventas facturables y devuelve el enlace de
// autofacturación para que el cliente final genere su CFDI en el portal.
// (28-oct-2026) Llama a 'facturacion' con la cabecera interna x-cg-interna.
// (28-oct-2026) El enlace lleva &k=<clave_acceso>: sin esa clave el folio no
// sirve. La app debe mostrarlo SOLO dentro de la cuenta de su cliente.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SITIO = 'https://cotizago.com.mx'
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE)
const FUN = `${Deno.env.get('SUPABASE_URL')}/functions/v1/facturacion`
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const claveNueva = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('')
const enlace = (token: string, clave: string) => `${SITIO}/facturar?t=${token}&k=${clave}`

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function totales(conceptos: any[]) {
  let subtotal = 0, iva = 0
  for (const c of conceptos) {
    const base = num(c.cantidad, 1) * num(c.valor_unitario)
    subtotal += base
    iva += base * (c.iva_tasa != null ? num(c.iva_tasa, 0.16) : 0.16)
  }
  return { subtotal: +subtotal.toFixed(2), iva: +iva.toFixed(2), total: +(subtotal + iva).toFixed(2) }
}

async function firmar(path: string | null) {
  if (!path) return null
  const { data } = await admin.storage.from('facturas').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    // Auth por llave
    const raw = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!raw) return json({ error: 'Falta la API key (Authorization: Bearer fx_live_...)' }, 401)
    const hash = await sha256hex(raw)
    const { data: app } = await admin.from('facturacion_apps').select('id, nombre, activo').eq('token_hash', hash).maybeSingle()
    if (!app || !app.activo) return json({ error: 'API key inválida o desactivada' }, 401)
    admin.from('facturacion_apps').update({ last_used_at: new Date().toISOString() }).eq('id', app.id).then(() => {})

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Cuerpo JSON inválido' }, 400)
    const accion = body.accion || 'crear'

    // ---- crear: registra una venta facturable y devuelve el enlace ----
    if (accion === 'crear') {
      let conceptos = Array.isArray(body.conceptos) ? body.conceptos : null
      if (!conceptos) {
        // modo simple: descripcion + total (el total ya incluye IVA)
        const total = num(body.total)
        if (!body.descripcion || total <= 0) return json({ error: 'Envía conceptos[] o (descripcion + total)' }, 400)
        const sub = +(total / 1.16).toFixed(2)
        conceptos = [{ clave_prod_serv: body.clave_prod_serv || '01010101', clave_unidad: body.clave_unidad || 'E48', descripcion: body.descripcion, cantidad: 1, valor_unitario: sub, iva_tasa: 0.16 }]
      }
      const t = totales(conceptos)
      const clave = claveNueva()
      const { data: f, error } = await admin.from('facturables').insert({
        app_id: app.id, origen: app.nombre, referencia_externa: body.referencia_externa ?? null,
        descripcion: body.descripcion ?? conceptos[0]?.descripcion ?? 'Venta',
        conceptos, subtotal: t.subtotal, iva: t.iva, total: t.total,
        moneda: ['MXN', 'USD'].includes(body.moneda) ? body.moneda : 'MXN',
        fecha_limite: body.fecha_limite || null, estado: 'pendiente', clave_acceso: clave,
      }).select('token').single()
      if (error) return json({ error: 'No se pudo crear: ' + error.message }, 500)
      return json({ ok: true, token: f.token, facturar_url: enlace(f.token, clave), referencia_externa: body.referencia_externa ?? null, total: t.total })
    }

    // ---- estado: consulta por referencia_externa o token ----
    if (accion === 'estado') {
      let q = admin.from('facturables').select('id, token, estado, total, factura_id, referencia_externa, clave_acceso').eq('app_id', app.id)
      q = body.token ? q.eq('token', body.token) : q.eq('referencia_externa', String(body.referencia_externa ?? ''))
      const { data: f } = await q.maybeSingle()
      if (!f) return json({ error: 'No encontrado' }, 404)
      let clave = f.clave_acceso
      if (!clave) { clave = claveNueva(); await admin.from('facturables').update({ clave_acceso: clave }).eq('id', f.id) }
      let factura: any = null
      if (f.estado === 'facturado' && f.factura_id) {
        const { data: fac } = await admin.from('facturas').select('uuid_sat, pdf_path, xml_path, total').eq('id', f.factura_id).maybeSingle()
        if (fac) factura = { uuid: fac.uuid_sat, total: fac.total, pdf_url: await firmar(fac.pdf_path), xml_url: await firmar(fac.xml_path) }
      }
      return json({ ok: true, estado: f.estado, total: f.total, facturar_url: enlace(f.token, clave), factura })
    }

    // ---- timbrar: la app ya tiene los datos fiscales del cliente ----
    if (accion === 'timbrar') {
      const { data: f } = await admin.from('facturables').select('*').eq('app_id', app.id).eq('token', String(body.token ?? '')).maybeSingle()
      if (!f) return json({ error: 'Facturable no encontrado (envía token de un facturable creado)' }, 404)
      if (f.estado === 'facturado') return json({ error: 'Ya facturado' }, 409)
      const rc = body.receptor || {}
      if (!rc.rfc || !rc.nombre || !rc.cp || !rc.regimen) return json({ error: 'receptor requiere rfc, nombre, cp, regimen' }, 400)
      const { data: cred } = await admin.from('facturacion_credenciales').select('entorno').eq('clave', 'senhub').maybeSingle()
      const sandbox = (cred?.entorno || 'sandbox') !== 'produccion'
      const r = await fetch(FUN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cg-interna': SERVICE }, body: JSON.stringify({
        accion: 'timbrar', facturable_id: f.id, sandbox,
        receptor: { rfc: String(rc.rfc).toUpperCase().trim(), nombre: rc.nombre, cp: String(rc.cp).trim(), regimen: rc.regimen, uso_cfdi: rc.uso_cfdi || 'G03', email: rc.email || null },
        conceptos: f.conceptos,
      }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) return json({ ok: false, error: d.error || 'No se pudo timbrar' }, 400)
      return json({ ok: true, uuid: d.uuid, total: d.total, sandbox: d.sandbox, pdf_url: await firmar(d.pdf_path), xml_url: await firmar(d.xml_path) })
    }

    return json({ error: 'Acción no soportada: ' + accion }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
