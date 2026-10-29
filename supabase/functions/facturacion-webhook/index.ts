// Webhook de WooCommerce: al PAGARSE un pedido, crea el facturable de esa venta
// (solo pedidos pagados), verifica la firma, y le avisa al cliente por correo que
// ya puede facturar desde su cuenta. La factura solo se puede generar dentro del
// MES del pago (fecha_limite = fin de mes). URL: .../facturacion-webhook?app=<app_id>
// SEGURIDAD (28-oct-2026): la firma X-WC-Webhook-Signature es OBLIGATORIA. Antes,
// si la petición llegaba sin firma, se aceptaba: cualquiera podía crear ventas
// falsas, mandar correos desde el dominio y obtener el token de pedidos ajenos.
// (28-oct-2026) Se factura solo desde la cuenta de cada quien: el facturable
// guarda la clave del pedido (order_key) y el correo lleva a «Mi cuenta › Pedidos»
// de la tienda (facturacion_apps.cuenta_url), no a un enlace con el folio.
import { createClient } from 'npm:@supabase/supabase-js@2'
// (29-oct-2026) nodemailer en vez de denomailer: denomailer se comía puntos al
// partir líneas largas y los enlaces llegaban rotos (cotizago.commx).
import nodemailer from 'npm:nodemailer@6.9.16'
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const DEFECTO = 'https://cotizago.com.mx/facturar'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-wc-webhook-signature', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d }
const money = (v: number, m = 'MXN') => new Intl.NumberFormat('es-MX', { style: 'currency', currency: m }).format(Number(v) || 0)
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const render = (txt: string, vars: Record<string, string>) => (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')
// Fin del mes (hora de México) de la fecha dada -> ISO. Después de esto ya no se factura.
function finDeMes(base: Date): string {
  const y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(base))
  const m = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', month: '2-digit' }).format(base))
  return new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString()
}
async function hmacB64(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}
/** Comparación en tiempo constante. */
function igual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
async function enviarCorreo(para: string, vars: Record<string, string>) {
  try {
    const { data: tpl } = await admin.from('email_templates').select('asunto, cuerpo, cuerpo_html').eq('clave', 'factura_disponible').maybeSingle()
    if (!tpl) return { ok: false, detalle: 'sin plantilla' }
    const { data: cfg } = await admin.from('config_plataforma').select('clave, valor')
    const c: Record<string, string> = {}; (cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'smtp_password').maybeSingle()
    const host = c.smtp_host, port = Number(c.smtp_port || 465), fromEmail = c.smtp_from, fromNombre = vars.marca || c.smtp_from_nombre || 'Cotiza Go', pass = sec?.valor || ''
    if (!host || !fromEmail || !pass) return { ok: false, detalle: 'SMTP no configurado' }
    const v = { plataforma: c.nombre_plataforma || 'Cotiza Go', ...vars }
    const vHtml: Record<string, string> = {}; for (const k of Object.keys(v)) vHtml[k] = esc((v as any)[k])
    const asunto = render(tpl.asunto, v)
    const html = tpl.cuerpo_html ? render(tpl.cuerpo_html, vHtml) : `<pre>${esc(render(tpl.cuerpo, v))}</pre>`
    const texto = render(tpl.cuerpo, v)
    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: fromEmail, pass }, connectionTimeout: 15000 })
    await t.sendMail({ from: `${fromNombre} <${fromEmail}>`, to: para, subject: asunto, text: texto, html })
    t.close()
    return { ok: true }
  } catch (e) { return { ok: false, detalle: String(e).slice(0, 200) } }
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const app_id = new URL(req.url).searchParams.get('app')
    if (!app_id) return json({ error: 'Falta ?app=<id>' }, 400)
    const { data: app } = await admin.from('facturacion_apps').select('id, nombre, nombre_comercial, woo_webhook_secret, portal_url, cuenta_url, woo_url').eq('id', app_id).maybeSingle()
    if (!app) return json({ error: 'Empresa no encontrada' }, 404)

    const raw = await req.text()
    // Firma OBLIGATORIA: sin secreto configurado o sin firma válida no se procesa nada.
    if (!app.woo_webhook_secret) return json({ error: 'Webhook sin secreto configurado' }, 401)
    const sig = req.headers.get('x-wc-webhook-signature') ?? ''
    const esperado = await hmacB64(app.woo_webhook_secret, raw)
    if (!sig || !igual(esperado, sig)) return json({ error: 'Firma inválida' }, 401)

    let order: any
    try { order = JSON.parse(raw) } catch { return json({ ok: true, ping: true }) }
    if (!order || !order.id) return json({ ok: true, ping: true })

    const pagado = ['processing', 'completed'].includes(order.status) || !!order.date_paid
    if (!pagado) return json({ ok: true, ignorado: 'pedido no pagado', estado: order.status })

    const marcaNombre = app.nombre_comercial || app.nombre
    const { data: existe } = await admin.from('facturables').select('token').eq('app_id', app_id).eq('referencia_externa', String(order.id)).maybeSingle()
    if (existe) return json({ ok: true, ya_existia: true })

    const items = order.line_items || []
    const conceptos: any[] = []
    for (const li of items) {
      const { data: prod } = await admin.from('facturacion_productos').select('clave_prod_serv, clave_unidad, iva_tasa').eq('app_id', app_id).eq('woo_id', li.product_id).maybeSingle()
      const cantidad = n(li.quantity, 1)
      const base = n(li.total)
      conceptos.push({ clave_prod_serv: prod?.clave_prod_serv || null, clave_unidad: prod?.clave_unidad || 'E48', descripcion: li.name || 'Producto', cantidad, valor_unitario: cantidad ? +(base / cantidad).toFixed(2) : base, iva_tasa: prod?.iva_tasa != null ? Number(prod.iva_tasa) : 0.16 })
    }
    const subtotal = conceptos.reduce((s, c) => s + c.cantidad * c.valor_unitario, 0)
    const iva = conceptos.reduce((s, c) => s + c.cantidad * c.valor_unitario * (c.iva_tasa || 0), 0)
    const total = +(subtotal + iva).toFixed(2)
    const moneda = order.currency || 'MXN'
    const correo = order.billing?.email || null
    const fechaPago = order.date_paid ? new Date(order.date_paid) : new Date()
    const fecha_limite = finDeMes(fechaPago)
    const { data: nuevo } = await admin.from('facturables').insert({
      app_id, origen: marcaNombre, referencia_externa: String(order.id), cliente_email: correo,
      clave_acceso: order.order_key ? String(order.order_key) : null,
      descripcion: items[0]?.name || 'Compra', conceptos, subtotal: +subtotal.toFixed(2), iva: +iva.toFixed(2), total,
      moneda, estado: 'pendiente', fecha_limite,
    }).select('token').single()

    // El correo lleva a la cuenta del cliente en la tienda, donde está el botón Facturar.
    const cuenta = app.cuenta_url || (app.woo_url ? `${String(app.woo_url).replace(/\/$/, '')}/mi-cuenta/orders/` : (app.portal_url || DEFECTO))
    let correo_estado: any = 'sin_correo'
    if (correo && nuevo?.token) {
      const nombreCliente = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || 'cliente'
      const r = await enviarCorreo(correo, { cliente: nombreCliente, marca: marcaNombre, total: money(total, moneda), enlace: cuenta })
      correo_estado = r.ok ? 'enviado' : `fallido: ${r.detalle}`
    }
    return json({ ok: true, correo: correo_estado })
  } catch (e) { return json({ error: String(e) }, 500) }
})
