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
// (29-oct-2026) CORREO PROPIO: si la cuenta tiene el módulo email_profesional
// activo y configuró su servidor (integraciones.tipo='email'), la cotización sale
// desde SU correo con SU plantilla (plantillas_mensajes canal email, envío inicial).
// Si no, sale como siempre: buzón de Cotiza Go y diseño del sistema.
// (29-oct-2026) Se envía con nodemailer: denomailer partía las líneas largas y se
// comía puntos (el enlace llegaba como «cotizago.commx» y no abría). El correo
// propio ya no es texto plano: va con el diseño, con el logo y el color de la empresa.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

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

/** ¿El color es claro? (para decidir texto blanco o azul marino encima). */
function esClaro(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160
}

/** Correo de cotización con la marca de la empresa y el texto de SU plantilla. */
function htmlMarca(texto, vars, emp) {
  const enlace = String(vars['enlace_publico'] || '')
  const color = /^#[0-9a-f]{6}$/i.test(String(emp?.color_principal ?? '')) ? emp.color_principal : '#06213B'
  const tinta = esClaro(color) ? '#06213B' : '#ffffff'
  const logo = /^https:\/\//.test(String(emp?.logo_url ?? '')) ? emp.logo_url : ''
  const nombre = esc(vars['empresa'] || '')
  // El enlace va en el botón: la línea del texto que lo trae se quita.
  const parrafos = String(texto).split(/\n{2,}/)
    .map((p) => p.split('\n').filter((l) => !enlace || !l.includes(enlace)).join('\n').trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const fila = (k, v, fuerte = false) => v ? `<tr><td style="color:#64748b;font-size:13px">${k}</td><td align="right" style="color:#06213B;font-size:${fuerte ? '20px;font-weight:800' : '13px'}">${esc(v)}</td></tr>` : ''
  const pie = [vars['empresa'], vars['empresa_telefono'], vars['empresa_email']].filter(Boolean).map(esc).join(' · ')
  return `<div style="margin:0;padding:24px 0;background:#f3f6f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="height:6px;background:${color}"></td></tr>
<tr><td style="padding:26px 32px 8px;text-align:center">${logo ? `<img src="${esc(logo)}" alt="${nombre}" style="max-height:64px;max-width:220px">` : `<span style="font-size:22px;font-weight:800;color:#06213B">${nombre}</span>`}</td></tr>
<tr><td style="padding:16px 32px 32px">
<h1 style="margin:0 0 18px;font-size:20px;color:#06213B">Cotización ${esc(vars['folio'] || '')}</h1>
${parrafos}
<table width="100%" cellpadding="9" cellspacing="0" style="background:#f8fafc;border-radius:10px;margin-top:8px">
${fila('Número:', vars['folio'])}${fila('Fecha:', vars['fecha'])}${fila('Vigencia:', vars['vigencia'])}${fila('Monto total:', vars['total'], true)}
</table>
${enlace ? `<div style="text-align:center;margin:26px 0 6px"><a href="${esc(enlace)}" style="display:inline-block;background:${color};color:${tinta};text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">Ver cotización completa</a></div>
<p style="text-align:center;color:#94a3b8;font-size:12px;margin:14px 0 0">También puedes copiar este enlace:<br><a href="${esc(enlace)}" style="color:#0B6DAD;word-break:break-all">${esc(enlace)}</a></p>` : ''}
</td></tr>
${pie ? `<tr><td style="padding:16px 32px 26px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #eef2f6">${pie}</td></tr>` : ''}
</table></td></tr></table></div>`
}

/** El error del servidor de correo, en palabras que el usuario entiende. */
function explicarSmtp(e) {
  const s = `${e?.code ?? ''} ${e?.responseCode ?? ''} ${e?.message ?? e}`
  if (/EAUTH|\b535\b|authentication|invalid login|credentials/i.test(s)) return 'El servidor rechazó el usuario o la contraseña. Usa los de tu buzón de correo (el usuario suele ser el correo completo).'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|name or service|dns/i.test(s)) return 'No existe ese servidor. Revisa cómo está escrito (en Hostinger es smtp.hostinger.com).'
  if (/ECONNREFUSED|refused/i.test(s)) return 'El servidor no aceptó la conexión. Revisa el servidor y el puerto (465 o 587; en Hostinger: smtp.hostinger.com y 465).'
  if (/ETIMEDOUT|timeout|ESOCKET|ECONNRESET/i.test(s)) return 'El servidor no respondió. Revisa el servidor y el puerto (465 o 587).'
  if (/certificate|ssl|tls|wrong version/i.test(s)) return 'Falló la conexión segura. Prueba con el puerto 465 o con el 587.'
  if (/\b55[0-4]\b|sender|not owned|relay/i.test(s)) return 'El servidor no deja enviar desde ese remitente. El «correo remitente» debe ser el mismo buzón con el que entras.'
  return 'No se pudo enviar el correo.'
}

/** Host de correo aceptable (no direcciones internas). */
const hostValido = (h) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h)

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
    let wsCot = ''
    let empCot = null

    // ---- Correo de PRUEBA del módulo Email profesional ----
    // Usa los datos del formulario (aunque no se hayan guardado); si la contraseña
    // viene vacía, la ya guardada. Solo se envía al correo del propio usuario.
    if (clave === 'prueba_correo') {
      if (!wsId) return json({ error: 'Sin cuenta' }, 400)
      const { data: activo } = await admin.rpc('modulo_activo', { p_workspace: wsId, p_clave: 'email_profesional' })
      if (!activo) return json({ error: 'Activa el módulo Email profesional para probarlo.' }, 403)
      const { count } = await admin.from('email_envios').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).like('asunto', 'Prueba:%').gte('created_at', new Date(Date.now() - 3600_000).toISOString())
      if ((count ?? 0) >= 10) return json({ error: 'Ya hiciste varias pruebas seguidas. Espera unos minutos.' }, 429)
      const cfgP = body.config ?? {}
      const host = String(cfgP.host ?? '').trim().toLowerCase()
      const puerto = Number(cfgP.puerto || 587)
      const remitente = String(cfgP.from_email ?? '').trim()
      if (!hostValido(host)) return json({ ok: false, error: 'Escribe el servidor de correo (por ejemplo smtp.hostinger.com).' })
      if (![25, 465, 587, 2525].includes(puerto)) return json({ ok: false, error: 'El puerto debe ser 465 o 587.' })
      if (!emailValido(remitente)) return json({ ok: false, error: 'Escribe el correo remitente.' })
      let clavePass = String(body.secreto ?? '')
      if (!clavePass) {
        const { data: integ } = await admin.from('integraciones').select('secreto').eq('workspace_id', wsId).eq('tipo', 'email').maybeSingle()
        clavePass = integ?.secreto ?? ''
      }
      if (!clavePass) return json({ ok: false, error: 'Escribe la contraseña del correo.' })
      const para = user.email ?? ''
      const { data: emp } = await admin.from('empresas').select('*').eq('workspace_id', wsId).maybeSingle()
      const { data: ultima } = await admin.from('cotizaciones').select('token').eq('workspace_id', wsId).eq('folio_consumido', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const { data: tp } = await admin.from('plantillas_mensajes').select('asunto, cuerpo').eq('workspace_id', wsId).eq('canal', 'email').eq('momento', 'envio_inicial').maybeSingle()
      const { data: tplSis } = await admin.from('email_templates').select('cuerpo').eq('clave', 'cotizacion_enviada').maybeSingle()
      const v = {
        plataforma: 'Cotiza Go', cliente: 'Cliente de prueba',
        empresa: corto(emp?.nombre_comercial || emp?.razon_social || '', 80), folio: 'COT-PRUEBA',
        fecha: fecha(new Date().toISOString()), total: dinero(1160, 'MXN'), vigencia: 'Sin vencimiento',
        enlace_publico: ultima?.token ? `${SITIO}/c/${encodeURIComponent(ultima.token)}` : SITIO,
        empresa_telefono: corto(emp?.telefono, 30), empresa_email: emailValido(emp?.email) ? emp.email : '',
        vendedor: corto(prof?.nombre || '', 80),
      }
      const texto = render(tp?.cuerpo?.trim() ? tp.cuerpo : (tplSis?.cuerpo ?? 'Hola {{cliente}},\n\nTe compartimos la cotización {{folio}} por {{total}}.\n\n{{enlace_publico}}'), v, false)
      const asunto = 'Prueba: ' + corto(render(tp?.asunto || 'Cotización {{folio}} de {{empresa}}', v, false), 180)
      let ok = false, detalle = '', error = ''
      try {
        const t = nodemailer.createTransport({
          host, port: puerto, secure: puerto === 465,
          auth: { user: String(cfgP.usuario || remitente), pass: clavePass },
          connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
        })
        const nombre = corto(cfgP.from_nombre || v.empresa || '', 80)
        await t.sendMail({ from: nombre ? `${nombre} <${remitente}>` : remitente, to: para, subject: asunto, text: texto, html: htmlMarca(texto, v, emp) })
        t.close()
        ok = true
      } catch (e) { error = explicarSmtp(e); detalle = String(e?.message ?? e).slice(0, 200) }
      await admin.from('email_envios').insert({ workspace_id: wsId, destinatario: para, asunto, estado: ok ? 'enviado' : 'fallido' })
      return ok ? json({ ok: true, para }) : json({ ok: false, error, detalle })
    }

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
      wsCot = cot.workspace_id
      const { data: emp } = await admin.from('empresas').select('*').eq('workspace_id', cot.workspace_id).maybeSingle()
      empCot = emp
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

    // ¿La cuenta conectó su propio correo? (módulo pagado + servidor configurado)
    let propio: null | { host: string; port: number; usuario: string; pass: string; from: string; nombre: string } = null
    let tplPropia: any = null
    if (clave === 'cotizacion_enviada' && wsCot) {
      const [{ data: activo }, { data: integ }] = await Promise.all([
        admin.rpc('modulo_activo', { p_workspace: wsCot, p_clave: 'email_profesional' }),
        admin.from('integraciones').select('config, secreto, activa').eq('workspace_id', wsCot).eq('tipo', 'email').maybeSingle(),
      ])
      const cfgP = integ?.config ?? {}
      if (activo && integ?.activa && cfgP.host && integ.secreto && emailValido(cfgP.from_email)) {
        propio = {
          host: String(cfgP.host), port: Number(cfgP.puerto || 587),
          usuario: String(cfgP.usuario || cfgP.from_email), pass: String(integ.secreto),
          from: String(cfgP.from_email), nombre: corto(cfgP.from_nombre || vars['empresa'] || '', 80),
        }
        const { data: tp } = await admin.from('plantillas_mensajes').select('asunto, cuerpo')
          .eq('workspace_id', wsCot).eq('canal', 'email').eq('momento', 'envio_inicial').maybeSingle()
        if (tp?.cuerpo?.trim()) tplPropia = tp
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
    if (!propio && (!host || !fromEmail || !pass)) {
      return json({ error: 'El administrador aun no configuro el servicio de correo (SMTP).' }, 400)
    }

    vars = { plataforma: c.nombre_plataforma || 'Cotiza Go', ...vars }
    let asunto: string, texto: string, html: string
    if (propio) {
      // Correo propio: SU plantilla (o la del sistema si no tiene) dentro del diseño
      // con SU marca; nunca con el encabezado de Cotiza Go.
      asunto = corto(render(tplPropia?.asunto || 'Cotización {{folio}} de {{empresa}}', vars, false), 200)
      texto = render(tplPropia?.cuerpo || tpl.cuerpo, vars, false)
      html = htmlMarca(texto, vars, empCot)
    } else {
      asunto = corto(render(tpl.asunto, vars, false), 200)
      texto = render(tpl.cuerpo, vars, false)
      html = tpl.cuerpo_html ? render(tpl.cuerpo_html, vars, true) : `<pre style="font-family:sans-serif">${esc(texto)}</pre>`
    }

    let ok = false, detalle = '', motivo = ''
    try {
      const srv = propio
        ? { hostname: propio.host, port: propio.port, user: propio.usuario, pass: propio.pass, from: propio.nombre ? `${propio.nombre} <${propio.from}>` : propio.from, reply: propio.from }
        : { hostname: host, port, user: fromEmail, pass, from: `${fromNombre} <${fromEmail}>`, reply: replyTo }
      const transporte = nodemailer.createTransport({
        host: srv.hostname,
        port: srv.port,
        secure: srv.port === 465, // 465 = TLS implicito; 587 = STARTTLS
        auth: { user: srv.user, pass: srv.pass },
        connectionTimeout: 15000,
      })
      await transporte.sendMail({
        from: srv.from,
        to: para,
        subject: asunto,
        text: texto,
        html,
        ...(srv.reply ? { replyTo: srv.reply } : {}),
      })
      transporte.close()
      ok = true
    } catch (e) {
      detalle = String(e).slice(0, 300)
      if (propio) motivo = explicarSmtp(e)
    }

    await admin.from('email_envios').insert({
      workspace_id: wsId, destinatario: para, asunto,
      estado: ok ? 'enviado' : 'fallido',
    })

    if (!ok) return json({ error: propio ? `No se pudo enviar con tu correo. ${motivo} Revisa Módulos › Email profesional y usa «Enviar correo de prueba».` : 'No se pudo enviar el correo por SMTP', detalle }, 502)
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
