// Envia correos por SMTP (Hostinger). El admin configura host/puerto/from en el
// panel (config_plataforma) y la contrasena del buzon en la boveda
// (plataforma_secretos.smtp_password). Antes usaba Resend; se cambio a SMTP
// porque es lo que el usuario dio de alta (contacto@cotizago.com.mx).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
const render = (txt, vars) => (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')

async function getSecret(admin, clave) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { clave, para, variables = {}, reply_to } = await req.json()
    if (!clave || !para) return json({ error: 'Faltan datos (clave, para)' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    // Limite anti-spam por workspace/dia.
    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).single()
    const wsId = prof?.workspace_id
    if (wsId) {
      const { data: ws } = await admin.from('workspaces').select('limite_emails_dia').eq('id', wsId).single()
      const limite = ws?.limite_emails_dia ?? 50
      const desde = new Date(); desde.setHours(0, 0, 0, 0)
      const { count } = await admin.from('email_envios')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).gte('created_at', desde.toISOString())
      if ((count ?? 0) >= limite) {
        return json({ error: `Limite diario de ${limite} correos alcanzado. Intenta manana.` }, 429)
      }
    }

    const { data: tpl } = await admin.from('email_templates').select('*').eq('clave', clave).maybeSingle()
    if (!tpl) return json({ error: 'Plantilla no encontrada' }, 404)

    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor')
    const c = {}
    ;(cfg ?? []).forEach((r) => { c[r.clave] = r.valor ?? '' })

    const host = c.smtp_host
    const port = Number(c.smtp_port || 465)
    const fromEmail = c.smtp_from
    const fromNombre = c.smtp_from_nombre || 'Cotiza Go'
    const pass = await getSecret(admin, 'smtp_password')
    if (!host || !fromEmail || !pass) {
      return json({ error: 'El administrador aun no configuro el servicio de correo (SMTP).' }, 400)
    }

    const vars = { plataforma: c.nombre_plataforma || 'Cotiza Go', ...variables }
    const asunto = render(tpl.asunto, vars)
    const html = tpl.cuerpo_html ? render(tpl.cuerpo_html, vars) : `<pre style="font-family:sans-serif">${render(tpl.cuerpo, vars)}</pre>`
    const texto = render(tpl.cuerpo, vars)

    let ok = false, detalle = ''
    try {
      const client = new SMTPClient({
        connection: {
          hostname: host,
          port,
          tls: port === 465, // 465 = TLS implicito; 587 = STARTTLS
          auth: { username: fromEmail, password: pass },
        },
      })
      await client.send({
        from: `${fromNombre} <${fromEmail}>`,
        to: para,
        subject: asunto,
        content: texto,
        html,
        ...(reply_to ? { replyTo: reply_to } : {}),
      })
      await client.close()
      ok = true
    } catch (e) {
      detalle = String(e).slice(0, 300)
    }

    await admin.from('email_envios').insert({
      workspace_id: wsId, destinatario: para, asunto,
      estado: ok ? 'enviado' : 'fallido',
    })

    if (!ok) return json({ error: 'No se pudo enviar el correo por SMTP', detalle }, 502)
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
