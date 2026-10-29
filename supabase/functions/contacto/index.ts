// Formulario de contacto público (sin login). Envía el mensaje al buzón de la
// plataforma (smtp_from) con reply-to del visitante, para que el equipo pueda
// responderle directo. Solo escribe al correo propio, nunca a terceros.
// (29-oct-2026) Con límite: 3 mensajes por hora por visitante (huella de su IP,
// nunca la IP en claro) y 40 al día en total. Antes no había tope y un bot podía
// agotar la cuota del correo que también usan los avisos de la app.
import { createClient } from 'npm:@supabase/supabase-js@2'
// (29-oct-2026) nodemailer en vez de denomailer (se comía puntos de los enlaces).
import nodemailer from 'npm:nodemailer@6.9.16'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const POR_HORA_IP = 3
const POR_DIA_TOTAL = 40

async function huella(texto: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cg-contacto:' + texto))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const esc = (s: string) => (s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { nombre, email, mensaje, website } = await req.json()
    // Honeypot: campo oculto que solo los bots rellenan. Si viene con algo,
    // fingimos éxito y no enviamos nada.
    if (String(website ?? '').trim() !== '') return json({ ok: true })
    const nom = String(nombre ?? '').trim()
    const mail = String(email ?? '').trim()
    const msg = String(mensaje ?? '').trim()
    if (!nom || !mail || !msg) return json({ error: 'Faltan datos' }, 400)
    if (nom.length > 120 || mail.length > 160) return json({ error: 'Datos demasiado largos' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json({ error: 'Correo inválido' }, 400)
    if (msg.length > 4000) return json({ error: 'Mensaje demasiado largo' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Límite de envíos.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'sin-ip'
    const ipHash = await huella(ip)
    const haceUnaHora = new Date(Date.now() - 3600_000).toISOString()
    const haceUnDia = new Date(Date.now() - 86_400_000).toISOString()
    const [{ count: deEsteIp }, { count: delDia }] = await Promise.all([
      admin.from('contacto_envios').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', haceUnaHora),
      admin.from('contacto_envios').select('*', { count: 'exact', head: true }).gte('created_at', haceUnDia),
    ])
    if ((deEsteIp ?? 0) >= POR_HORA_IP || (delDia ?? 0) >= POR_DIA_TOTAL) {
      return json({ error: 'Recibimos varios mensajes seguidos. Intenta de nuevo más tarde.' }, 429)
    }
    await admin.from('contacto_envios').insert({ ip_hash: ipHash })
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor')
    const c: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'smtp_password').maybeSingle()
    const pass = sec?.valor ?? ''

    const host = c.smtp_host
    const port = Number(c.smtp_port || 465)
    const fromEmail = c.smtp_from
    const fromNombre = c.smtp_from_nombre || 'Cotiza Go'
    if (!host || !fromEmail || !pass) return json({ error: 'El correo aún no está configurado.' }, 400)

    const html = `<div style="font-family:sans-serif;font-size:14px;color:#222">
      <p><strong>Nuevo mensaje de contacto</strong></p>
      <p><strong>Nombre:</strong> ${esc(nom)}<br/>
         <strong>Correo:</strong> ${esc(mail)}</p>
      <p style="white-space:pre-wrap;border-left:3px solid #08AEB6;padding-left:10px">${esc(msg)}</p>
    </div>`

    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: fromEmail, pass }, connectionTimeout: 15000 })
    await t.sendMail({
      from: `${fromNombre} <${fromEmail}>`,
      to: fromEmail,                       // llega al buzón de la plataforma
      replyTo: `${nom} <${mail}>`,         // responder = responderle al visitante
      subject: `Contacto web · ${nom}`,
      text: `De: ${nom} <${mail}>\n\n${msg}`,
      html,
    })
    t.close()

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
