// Envia correos por SMTP (Hostinger). El admin configura host/puerto/from en el
// panel (config_plataforma) y la contrasena del buzon en la boveda
// (plataforma_secretos.smtp_password).
//
// (28-oct-2026) Antes el navegador mandaba `para` y `variables` libres: cualquier
// cuenta gratis podia enviar HTML propio a cualquier correo con nuestro
// remitente (relevo de phishing). Ahora el SERVIDOR decide destinatario y datos:
//  - bienvenida / recordatorio_recarga / folios_terminados: solo al correo del
//    propio usuario, con datos de su perfil.
//  - cotizacion_enviada: solo para una cotizacion del usuario (RLS) que ya se
//    envio y consumio folio; el destinatario es el cliente de esa cotizacion.
//  - Toda variable se escapa antes de entrar al HTML.
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
const SITIO = 'https://cotizago.com.mx'
const PROPIOS = ['bienvenida', 'recordatorio_recarga', 'folios_terminados']

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
// Texto corto y de una linea (sin saltos que permitan inyectar cabeceras).
const corto = (v, max = 120) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
const render = (txt, vars, html) => (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => html ? esc(vars[k]) : (vars[k] ?? ''))
const emailValido = (e) => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(String(e ?? ''))

function fecha(d) {
  if (!d) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d))
  const f = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : new Date(d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).format(f)
}
function dinero(n, moneda) {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN' }).format(Number(n) || 0) }
  catch { return `$${(Number(n) || 0).toFixed(2)}` }
}

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

    const body = await req.json().catch(() => ({}))
    const clave = String(body.clave ?? '')
    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    const { data: prof } = await admin.from('profiles').select('workspace_id,nombre,folios_balance').eq('id', user.id).single()
    const wsId = prof?.workspace_id

    // Destinatario y variables los arma el servidor.
    let para = ''
    let replyTo = ''
    let vars = {}
    if (PROPIOS.includes(clave)) {
      para = user.email ?? ''
      const saldo = Number(prof?.folios_balance ?? 0)
      if (clave === 'folios_terminados' && saldo > 0) return json({ ok: true, omitido: true })
      if (clave === 'recordatorio_recarga' && (saldo <= 0 || saldo > 3)) return json({ ok: true, omitido: true })
      vars = {
        nombre: corto(prof?.nombre || '', 80),
        email: para,
        folios: String(saldo),
        folios_restantes: String(saldo),
        link_recarga: clave === 'bienvenida' ? `${SITIO}/app` : `${SITIO}/app/folios`,
      }
    } else if (clave === 'cotizacion_enviada') {
      // id directo, o el token del enlace publico (versiones anteriores del panel).
      let q = supabase.from('cotizaciones').select('*')
      const tokenViejo = /\/c\/([\w-]+)/.exec(String(body?.variables?.enlace_publico ?? ''))?.[1]
      if (body.cotizacion_id) q = q.eq('id', String(body.cotizacion_id))
      else if (tokenViejo) q = q.eq('token', tokenViejo)
      else return json({ error: 'Falta la cotizacion' }, 400)
      const { data: cot } = await q.maybeSingle()
      if (!cot) return json({ error: 'Cotizacion no encontrada' }, 404)
      if (!cot.folio_consumido) return json({ error: 'Primero envia la cotizacion (consume 1 folio).' }, 400)
      para = cot.cliente_email ?? ''
      const { data: emp } = await admin.from('empresas').select('*').eq('workspace_id', cot.workspace_id).maybeSingle()
      replyTo = emailValido(emp?.email) ? emp.email : ''
      vars = {
        cliente: corto(cot.cliente_nombre || 'Cliente', 80),
        empresa: corto(emp?.nombre_comercial || emp?.razon_social || '', 80),
        folio: corto(cot.numero, 40),
        fecha: fecha(cot.fecha_emision),
        total: dinero(cot.total, cot.moneda),
        enlace_publico: `${SITIO}/c/${encodeURIComponent(cot.token)}`,
        vigencia: cot.fecha_vencimiento ? fecha(cot.fecha_vencimiento) : 'Sin vencimiento',
        empresa_telefono: corto(emp?.telefono, 30),
        empresa_email: replyTo,
        vendedor: corto(prof?.nombre || '', 80),
      }
    } else {
      return json({ error: 'Plantilla no permitida' }, 403)
    }
    if (!emailValido(para)) return json({ error: 'Correo de destino invalido' }, 400)

    // Limite anti-spam por workspace/dia.
    if (wsId) {
      const { data: ws } = await admin.from('workspaces').select('limite_emails_dia').eq('id', wsId).single()
      const limite = ws?.limite_emails_dia ?? 50
      const desde = new Date(); desde.setUTCHours(0, 0, 0, 0)
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

    vars = { plataforma: c.nombre_plataforma || 'Cotiza Go', ...vars }
    const asunto = corto(render(tpl.asunto, vars, false), 200)
    const texto = render(tpl.cuerpo, vars, false)
    const html = tpl.cuerpo_html ? render(tpl.cuerpo_html, vars, true) : `<pre style="font-family:sans-serif">${esc(texto)}</pre>`

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
        ...(replyTo ? { replyTo } : {}),
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
