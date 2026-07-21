// Edge Function: envía un email usando las plantillas del sistema.
// - Toma la plantilla de email_templates por `clave` y sustituye {{variables}}.
// - Aplica el LÍMITE ANTI-SPAM por workspace (workspaces.limite_emails_dia).
// - Envía con Resend (API key en la bóveda plataforma_secretos o en el entorno).
// - Registra cada envío en email_envios.
// verify_jwt = true: solo usuarios autenticados.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function getSecret(admin: any, clave: string, envName: string) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || Deno.env.get(envName) || ''
}

const render = (txt: string, vars: Record<string, string>) =>
  (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { clave, para, variables = {}, reply_to } = await req.json()
    if (!clave || !para) return json({ error: 'Faltan datos (clave, para)' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Workspace del usuario + límite anti-spam
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
        return json({ error: `Límite diario de ${limite} correos alcanzado. Intenta mañana.` }, 429)
      }
    }

    // Plantilla
    const { data: tpl } = await admin.from('email_templates').select('*').eq('clave', clave).maybeSingle()
    if (!tpl) return json({ error: 'Plantilla no encontrada' }, 404)

    // Config del remitente
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor')
    const c: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const fromEmail = c.smtp_from || 'no-reply@cotizago.com'
    const fromNombre = c.smtp_from_nombre || 'Cotiza Go'

    const vars = { plataforma: c.nombre_plataforma || 'Cotiza Go', ...variables }
    const asunto = render(tpl.asunto, vars)
    const html = tpl.cuerpo_html ? render(tpl.cuerpo_html, vars) : `<pre style="font-family:sans-serif">${render(tpl.cuerpo, vars)}</pre>`
    const texto = render(tpl.cuerpo, vars)

    // Envío con Resend
    const apiKey = await getSecret(admin, 'resend_api_key', 'RESEND_API_KEY')
    if (!apiKey) return json({ error: 'El administrador aún no configuró el servicio de correo.' }, 400)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromNombre} <${fromEmail}>`,
        to: [para],
        subject: asunto,
        html,
        text: texto,
        ...(reply_to ? { reply_to } : {}),
      }),
    })
    const out = await res.json().catch(() => ({}))
    const ok = res.ok

    await admin.from('email_envios').insert({
      workspace_id: wsId, destinatario: para, asunto,
      estado: ok ? 'enviado' : 'fallido',
    })

    if (!ok) return json({ error: out?.message ?? 'El proveedor rechazó el envío' }, 502)
    return json({ ok: true, id: out?.id })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
