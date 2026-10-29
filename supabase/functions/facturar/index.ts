// Portal público de autofacturación: pre-llena datos guardados, timbra, genera PDF
// con logo, manda la factura por correo y guarda datos. Regla: solo se factura
// dentro del MES del pago.
// (28-oct-2026) Las llamadas a facturacion / facturacion-pdf / facturacion-enviar
// llevan la cabecera interna x-cg-interna (esas funciones ya no son públicas).
// (28-oct-2026) SOLO DESDE LA CUENTA DE CADA QUIEN. El folio (token) o el # de
// pedido ya no bastan para ver ni timbrar una compra:
//  - Compras de Cotiza Go (facturable.workspace_id): sesión iniciada del dueño.
//  - Ventas de WooCommerce: además la clave del pedido (order_key), que la tienda
//    solo muestra a su dueño en «Mi cuenta» (botón Facturar).
//  - Ventas por API: la clave_acceso aleatoria que la app enseña a su cliente.
// (29-oct-2026) Apps en grupo (Fidelízalo: tienda + panel): el pedido de la tienda
// encuentra la factura que el negocio ya sacó desde su panel, y viceversa.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const admin = createClient(BASE, SERVICE)
const FUN = `${BASE}/functions/v1/facturacion`
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const jh = { 'Content-Type': 'application/json', 'x-cg-interna': SERVICE }
const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d }
const mesMX = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(d)
function finDeMes(base: Date): string {
  const y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(base))
  const m = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', month: '2-digit' }).format(base))
  return new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString()
}
const vencido = (fl: string | null) => !!fl && new Date(fl).getTime() < Date.now()
/** Comparación en tiempo constante. */
function iguales(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const NO_AUT = 'Para facturar entra a tu cuenta (en la tienda donde compraste: Mi cuenta › Pedidos › Facturar; en Cotiza Go: Notas y facturas).'

async function firmar(path: string | null) { if (!path) return null; const { data } = await admin.storage.from('facturas').createSignedUrl(path, 3600); return data?.signedUrl ?? null }
async function descargaDe(factura_id: string | null) { if (!factura_id) return null; const { data: fac } = await admin.from('facturas').select('uuid_sat, pdf_path, xml_path').eq('id', factura_id).maybeSingle(); if (!fac) return null; return { uuid: fac.uuid_sat, pdf_url: await firmar(fac.pdf_path), xml_url: await firmar(fac.xml_path) } }
async function marcaDe(f: any) {
  if (f.app_id) { const { data } = await admin.from('facturacion_apps').select('nombre_comercial, logo_url, color').eq('id', f.app_id).maybeSingle(); if (data) return { nombre: data.nombre_comercial ?? null, logo_url: data.logo_url ?? null, color: data.color ?? '#06213B' } }
  if (f.workspace_id) { const { data } = await admin.from('empresas').select('nombre_comercial, razon_social, logo_url, color_principal').eq('workspace_id', f.workspace_id).maybeSingle(); if (data) return { nombre: data.nombre_comercial ?? data.razon_social ?? null, logo_url: data.logo_url ?? null, color: data.color_principal ?? '#06213B' } }
  return { nombre: 'Cotiza Go', logo_url: null, color: '#06213B' }
}
async function receptorDe(f: any) {
  if (!f.app_id || !f.cliente_email) return null
  // ILIKE con los comodines escapados: un correo con % o _ ya no trae los datos
  // fiscales de otra persona.
  const correo = String(f.cliente_email).replace(/[\\%_]/g, (c) => '\\' + c)
  const { data } = await admin.from('facturacion_receptores').select('rfc,nombre,cp,regimen,uso_cfdi,email').eq('app_id', f.app_id).ilike('email', correo).limit(1).maybeSingle()
  return data ?? null
}
// Conceptos de un pedido de Woo con las claves SAT del catálogo del negocio.
async function conceptosDePedido(app_id: string, items: any[]) {
  const out: any[] = []
  for (const li of items) {
    const { data: prod } = await admin.from('facturacion_productos').select('clave_prod_serv, clave_unidad, iva_tasa').eq('app_id', app_id).eq('woo_id', li.product_id).maybeSingle()
    const cantidad = n(li.quantity, 1), base = n(li.total)
    out.push({ clave_prod_serv: prod?.clave_prod_serv || null, clave_unidad: prod?.clave_unidad || 'E48', descripcion: li.name || 'Producto', cantidad, valor_unitario: cantidad ? +(base / cantidad).toFixed(2) : base, iva_tasa: prod?.iva_tasa != null ? Number(prod.iva_tasa) : 0.16 })
  }
  return out
}
async function pedidoWoo(app: any, pedido: string) {
  if (!app?.woo_url || !app?.woo_consumer_key) return null
  const auth = 'Basic ' + btoa(`${app.woo_consumer_key}:${app.woo_consumer_secret}`)
  const r = await fetch(`${String(app.woo_url).replace(/\/$/, '')}/wp-json/wc/v3/orders/${encodeURIComponent(pedido)}`, { headers: { Authorization: auth } })
  return r.ok ? await r.json() : null
}

/** ¿Quien llama es el dueño de este facturable? */
async function esDueno(f: any, input: any, req: Request): Promise<boolean> {
  // Compra de Cotiza Go: sesión del usuario del mismo workspace.
  if (f.workspace_id) {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!/^Bearer\s+\S+/i.test(authHeader)) return false
    const uc = createClient(BASE, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await uc.auth.getUser()
    if (!user) return false
    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).maybeSingle()
    return prof?.workspace_id === f.workspace_id
  }
  // Venta de una tienda/app: su clave de acceso.
  const k = String(input.k ?? '').trim()
  if (!f.app_id || !k) return false
  if (f.clave_acceso && iguales(k, f.clave_acceso)) return true
  // Si no, se valida contra la tienda: la clave del pedido (order_key) que solo ve su
  // dueño. Sirve para ventas de Woo creadas antes de guardar la clave y para el mismo
  // pago registrado por otra app del grupo (Fidelízalo: el panel y la tienda).
  if (!f.referencia_externa) return false
  const { data: grupo } = await admin.rpc('apps_del_grupo', { p_app: f.app_id })
  const ids = Array.isArray(grupo) && grupo.length ? grupo : [f.app_id]
  const { data: tiendas } = await admin.from('facturacion_apps').select('id, woo_url, woo_consumer_key, woo_consumer_secret').in('id', ids).not('woo_url', 'is', null)
  for (const app of tiendas ?? []) {
    const order = await pedidoWoo(app, String(f.referencia_externa))
    if (order?.order_key && iguales(k, String(order.order_key))) {
      if (!f.clave_acceso && app.id === f.app_id) await admin.from('facturables').update({ clave_acceso: String(order.order_key) }).eq('id', f.id)
      return true
    }
  }
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const input = await req.json().catch(() => ({} as any))
    const accion = input.accion || 'buscar'

    // Botón «Facturar» de Mi cuenta en la tienda: # de pedido + clave del pedido.
    // Crea el facturable desde el pedido de Woo si aún no existe. Aplica la regla del mes.
    if (accion === 'resolver_pedido') {
      const app_id = input.app; const pedido = String(input.pedido || '').trim(); const k = String(input.k || '').trim()
      if (!app_id || !pedido) return json({ error: 'Falta app o pedido' }, 400)
      if (!k) return json({ ok: false, motivo: 'sin_clave', error: NO_AUT }, 403)
      const { data: app } = await admin.from('facturacion_apps').select('id, nombre, nombre_comercial, woo_url, woo_consumer_key, woo_consumer_secret').eq('id', app_id).maybeSingle()
      if (!app) return json({ error: 'Empresa no encontrada' }, 404)
      if (!app.woo_url || !app.woo_consumer_key) return json({ ok: false, motivo: 'sin_woo' })
      const order = await pedidoWoo(app, pedido)
      if (!order) return json({ ok: false, motivo: 'pedido_no_encontrado' })
      if (!order.order_key || !iguales(k, String(order.order_key))) return json({ ok: false, motivo: 'sin_clave', error: NO_AUT }, 403)

      let { data: existe } = await admin.from('facturables').select('id, app_id, token, estado, fecha_limite, clave_acceso').eq('app_id', app_id).eq('referencia_externa', pedido).maybeSingle()
      // El mismo pago pudo registrarse desde otra app del grupo (Fidelízalo: el panel
      // del negocio). Si allá ya se facturó, aquí se muestra esa misma factura.
      const { data: grupo } = await admin.rpc('apps_del_grupo', { p_app: app_id })
      if (Array.isArray(grupo) && grupo.length > 1) {
        const { data: gemelos } = await admin.from('facturables').select('id, app_id, token, estado, fecha_limite, clave_acceso')
          .in('app_id', grupo).neq('app_id', app_id).eq('referencia_externa', pedido)
        const hecho = (gemelos ?? []).find((g: any) => g.estado === 'facturado' || g.estado === 'timbrando')
        if (hecho && existe?.estado !== 'facturado') existe = hecho
        else if (!existe && gemelos?.length) existe = gemelos[0]
      }
      if (existe) {
        if (!existe.clave_acceso && existe.app_id === app_id) await admin.from('facturables').update({ clave_acceso: String(order.order_key) }).eq('id', existe.id)
        if (existe.estado !== 'facturado' && vencido(existe.fecha_limite)) return json({ ok: false, motivo: 'fuera_de_mes' })
        return json({ ok: true, token: existe.token })
      }
      const pagado = ['processing', 'completed'].includes(order.status) || !!order.date_paid
      if (!pagado) return json({ ok: false, motivo: 'no_pagado' })
      const fechaPago = order.date_paid ? new Date(order.date_paid) : new Date()
      if (mesMX(fechaPago) !== mesMX(new Date())) return json({ ok: false, motivo: 'fuera_de_mes' })
      const items = order.line_items || []
      const conceptos = await conceptosDePedido(app_id, items)
      const subtotal = conceptos.reduce((s, c) => s + c.cantidad * c.valor_unitario, 0)
      const iva = conceptos.reduce((s, c) => s + c.cantidad * c.valor_unitario * (c.iva_tasa || 0), 0)
      const { data: nuevo } = await admin.from('facturables').insert({ app_id, origen: app.nombre_comercial || app.nombre, referencia_externa: pedido, clave_acceso: String(order.order_key), cliente_email: order.billing?.email || null, descripcion: items[0]?.name || 'Compra', conceptos, subtotal: +subtotal.toFixed(2), iva: +iva.toFixed(2), total: +(subtotal + iva).toFixed(2), moneda: order.currency || 'MXN', estado: 'pendiente', fecha_limite: finDeMes(fechaPago) }).select('token').single()
      return json({ ok: true, token: nuevo?.token })
    }

    const token = String(input.token || '').trim()
    if (!token) return json({ error: 'Falta el folio de facturación' }, 400)
    const { data: f } = await admin.from('facturables').select('*').eq('token', token).maybeSingle()
    // Mismo mensaje si no existe o no es suyo: no se revela qué folios existen.
    if (!f || !(await esDueno(f, input, req))) return json({ error: NO_AUT }, 403)
    const marca = await marcaDe(f)

    if (accion === 'buscar') {
      const descarga = f.estado === 'facturado' ? await descargaDe(f.factura_id) : null
      const receptor = f.estado !== 'facturado' ? await receptorDe(f) : null
      const vencido_mes = f.estado !== 'facturado' && vencido(f.fecha_limite)
      return json({ ok: true, marca, receptor, vencido: vencido_mes, facturable: { descripcion: f.descripcion, total: f.total, moneda: f.moneda, estado: f.estado, ya_facturado: f.estado === 'facturado', fecha_limite: f.fecha_limite }, descarga })
    }

    if (accion === 'timbrar') {
      if (f.estado === 'facturado') return json({ error: 'Este folio ya fue facturado.', descarga: await descargaDe(f.factura_id), marca }, 409)
      if (f.estado === 'cancelado') return json({ error: 'Este folio fue cancelado.' }, 409)
      if (vencido(f.fecha_limite)) return json({ error: 'El plazo para facturar venció: las facturas solo se generan dentro del mes de la compra.' }, 409)
      const rc = input.receptor || {}
      if (!rc.rfc || !rc.nombre || !rc.cp || !rc.regimen) return json({ error: 'Faltan datos fiscales: RFC, razón social, CP y régimen.' }, 400)
      const receptor = { rfc: String(rc.rfc).toUpperCase().trim(), nombre: String(rc.nombre).trim(), cp: String(rc.cp).trim(), regimen: rc.regimen, uso_cfdi: 'G03', email: rc.email || f.cliente_email || null }

      const { data: cred } = await admin.from('facturacion_credenciales').select('entorno').eq('clave', 'senhub').maybeSingle()
      const sandbox = (cred?.entorno || 'sandbox') !== 'produccion'

      const r = await fetch(FUN, { method: 'POST', headers: jh, body: JSON.stringify({ accion: 'timbrar', facturable_id: f.id, sandbox, receptor, conceptos: f.conceptos }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) return json({ ok: false, error: d.error || 'No se pudo timbrar', detalle: d }, 400)

      if (d.uuid && f.app_id) {
        try { await fetch(`${BASE}/functions/v1/facturacion-pdf`, { method: 'POST', headers: jh, body: JSON.stringify({ uuid: d.uuid, app_id: f.app_id }) }) } catch { /* */ }
        if (receptor.email) { try { await fetch(`${BASE}/functions/v1/facturacion-enviar`, { method: 'POST', headers: jh, body: JSON.stringify({ uuid: d.uuid, para: receptor.email, app_id: f.app_id }) }) } catch { /* */ } }
      }

      if (f.app_id) { await admin.from('facturacion_receptores').upsert({ app_id: f.app_id, rfc: receptor.rfc, nombre: receptor.nombre, cp: receptor.cp, regimen: receptor.regimen, uso_cfdi: 'G03', email: receptor.email, updated_at: new Date().toISOString() }, { onConflict: 'app_id,rfc' }) }

      return json({ ok: true, uuid: d.uuid, total: d.total, sandbox: d.sandbox, marca, correo_enviado: !!receptor.email, pdf_url: await firmar(d.pdf_path), xml_url: await firmar(d.xml_path) })
    }

    return json({ error: 'Acción no soportada' }, 400)
  } catch (e) { return json({ error: String(e) }, 500) }
})
