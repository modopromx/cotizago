// Envía una factura (CFDI) por correo con el PDF y el XML adjuntos,
// con el DISEÑO de la marca del negocio (logo, color, nombre). Reusa el SMTP
// del panel. Uso: POST {uuid, para, app_id}.
// SEGURIDAD (28-oct-2026): solo llamadas INTERNAS (cabecera x-cg-interna). Antes
// cualquiera podía mandar la factura de un tercero a cualquier correo.
// (29-oct-2026) nodemailer en vez de denomailer (se comía puntos de los enlaces).
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-cg-interna', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
function esInterna(req: Request): boolean {
  const h = req.headers.get('x-cg-interna') ?? ''
  if (!SERVICE || h.length !== SERVICE.length) return false
  let d = 0
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ SERVICE.charCodeAt(i)
  return d === 0
}
const money = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0)
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
function b64(bytes: Uint8Array): string {
  let s = ''; const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}
function plantilla(marca: { nombre: string; logo?: string | null; color: string }, f: any) {
  const c = marca.color || '#2563EB'
  const header = marca.logo
    ? `<img src="${esc(marca.logo)}" alt="${esc(marca.nombre)}" style="max-height:44px;max-width:200px">`
    : `<span style="font-size:20px;font-weight:800;color:#fff">${esc(marca.nombre)}</span>`
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 0;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:${esc(c)};padding:22px 28px">${header}</td></tr>
<tr><td style="padding:28px">
<p style="font-size:16px;margin:0 0 6px">Hola <strong>${esc(f.receptor_nombre || 'cliente')}</strong>,</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 18px">Gracias por tu compra en <strong>${esc(marca.nombre)}</strong>. Adjuntamos tu <strong>factura (CFDI 4.0)</strong>. Encontrarás dos archivos: el <strong>PDF</strong> (tu comprobante para imprimir) y el <strong>XML</strong> (el documento fiscal válido ante el SAT, el que necesita tu contador).</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 18px">
<tr><td style="padding:14px 16px;font-size:13px;color:#64748b">Folio fiscal (UUID)</td><td style="padding:14px 16px;font-size:12px;text-align:right;font-family:monospace;color:#0f172a">${esc(f.uuid_sat)}</td></tr>
<tr><td style="padding:0 16px 14px;font-size:13px;color:#64748b">Total</td><td style="padding:0 16px 14px;font-size:16px;text-align:right;font-weight:800;color:${esc(c)}">${money(f.total)}</td></tr>
</table>
<p style="font-size:12px;color:#94a3b8;line-height:1.5;margin:0">Verifica tu factura en el portal del SAT con el folio fiscal. Si tienes dudas, responde a este correo.</p>
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">Enviado por ${esc(marca.nombre)} · Facturación CFDI 4.0</td></tr>
</table></td></tr></table></body></html>`
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!esInterna(req)) return json({ error: 'No autorizado' }, 401)
  try {
    const { uuid, para, app_id } = await req.json().catch(() => ({}))
    if (!uuid || !para) return json({ error: 'Falta uuid o para' }, 400)
    const { data: f } = await admin.from('facturas').select('*').eq('uuid_sat', uuid).maybeSingle()
    if (!f) return json({ error: 'Factura no encontrada' }, 404)
    // Marca del negocio
    let marca = { nombre: 'Factura', logo: null as string | null, color: '#2563EB' }
    if (app_id) {
      const { data: app } = await admin.from('facturacion_apps').select('nombre, nombre_comercial, logo_url, color').eq('id', app_id).maybeSingle()
      if (app) marca = { nombre: app.nombre_comercial || app.nombre || 'Factura', logo: app.logo_url, color: app.color || '#2563EB' }
    }
    // Adjuntos desde el bucket privado
    const attachments: any[] = []
    for (const [ext, ct] of [['pdf', 'application/pdf'], ['xml', 'application/xml']] as const) {
      const { data: blob } = await admin.storage.from('facturas').download(`${uuid}.${ext}`)
      if (blob) attachments.push({ filename: `Factura-${uuid}.${ext}`, content: b64(new Uint8Array(await blob.arrayBuffer())), encoding: 'base64', contentType: ct })
    }
    // SMTP del panel
    const { data: cfg } = await admin.from('config_plataforma').select('clave, valor')
    const cc: Record<string, string> = {}; (cfg ?? []).forEach((r: any) => { cc[r.clave] = r.valor ?? '' })
    const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'smtp_password').maybeSingle()
    const host = cc.smtp_host, port = Number(cc.smtp_port || 465), fromEmail = cc.smtp_from, pass = sec?.valor || ''
    if (!host || !fromEmail || !pass) return json({ error: 'SMTP no configurado' }, 400)
    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: fromEmail, pass }, connectionTimeout: 15000 })
    await t.sendMail({
      from: `${marca.nombre} <${fromEmail}>`,
      to: para,
      subject: `Tu factura de ${marca.nombre} · ${money(f.total)}`,
      html: plantilla(marca, f),
      text: `Adjuntamos tu factura (CFDI) de ${marca.nombre}. Folio: ${uuid}. Total: ${money(f.total)}.`,
      attachments,
    })
    t.close()
    return json({ ok: true, enviado_a: para, adjuntos: attachments.map(a => a.filename), marca: marca.nombre })
  } catch (e) { return json({ error: String(e) }, 500) }
})
