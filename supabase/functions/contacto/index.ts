// Formulario de contacto público (sin login). Envía el mensaje al buzón de la
// plataforma (smtp_from) con reply-to del visitante, para que el equipo pueda
// responderle directo. Solo escribe al correo propio, nunca a terceros.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

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

    const client = new SMTPClient({
      connection: { hostname: host, port, tls: port === 465, auth: { username: fromEmail, password: pass } },
    })
    await client.send({
      from: `${fromNombre} <${fromEmail}>`,
      to: fromEmail,                       // llega al buzón de la plataforma
      replyTo: `${nom} <${mail}>`,         // responder = responderle al visitante
      subject: `Contacto web · ${nom}`,
      content: `De: ${nom} <${mail}>\n\n${msg}`,
      html,
    })
    await client.close()

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
