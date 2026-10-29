// Elimina la cuenta del usuario que la pide, DE INMEDIATO y sin aprobación
// (requisito de Google Play; decisión de Omar 29-oct-2026).
//  1. Cancela en Stripe las suscripciones de módulos (sin cobros futuros).
//  2. preparar_eliminacion_cuenta(): borra el negocio y deja desligados los
//     pagos y solicitudes de factura (se conservan por ley fiscal).
//  3. Borra los archivos (logo, adjuntos de soporte).
//  4. Borra el usuario de auth: perfil y negocio caen en cascada.
//  5. Le manda un correo de confirmación.
// Las facturas (CFDI) y sus PDF/XML se conservan; no tienen datos de la cuenta
// más allá de los fiscales.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function secreto(clave: string) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return data?.valor ?? ''
}

/** Cancela de inmediato las suscripciones de Stripe del negocio. Nunca bloquea el borrado. */
async function cancelarSuscripciones(ws: string) {
  const { data: subs } = await admin.from('modulo_suscripciones').select('stripe_subscription_id, modo')
    .eq('workspace_id', ws).not('stripe_subscription_id', 'is', null)
  for (const s of subs ?? []) {
    if (!s.stripe_subscription_id) continue
    try {
      const sk = await secreto(`stripe_${s.modo === 'live' ? 'live' : 'test'}_secret_key`)
      if (!sk) continue
      await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(s.stripe_subscription_id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(10000),
      })
    } catch (_) { /* se intenta con las demás */ }
  }
}

/** Borra todo lo que hay bajo una carpeta de un bucket (con subcarpetas). */
async function borrarCarpeta(bucket: string, carpeta: string) {
  const { data } = await admin.storage.from(bucket).list(carpeta, { limit: 1000 })
  const archivos: string[] = []
  for (const o of data ?? []) {
    const ruta = `${carpeta}/${o.name}`
    if (o.id) archivos.push(ruta)
    else await borrarCarpeta(bucket, ruta)   // subcarpeta
  }
  if (archivos.length) await admin.storage.from(bucket).remove(archivos)
}

async function correoConfirmacion(para: string, nombre: string) {
  try {
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor').like('clave', 'smtp%')
    const c: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const pass = await secreto('smtp_password')
    if (!c.smtp_host || !c.smtp_from || !pass) return
    const port = Number(c.smtp_port || 465)
    const t = nodemailer.createTransport({ host: c.smtp_host, port, secure: port === 465, auth: { user: c.smtp_from, pass }, connectionTimeout: 15000 })
    const texto = `Hola${nombre ? ' ' + nombre : ''}:\n\nTu cuenta de Cotiza Go y sus datos (empresa, clientes, productos, cotizaciones, plantillas, integraciones y archivos) fueron eliminados como lo pediste. Las suscripciones de módulos quedaron canceladas.\n\nPor ley conservamos únicamente los registros de pagos y las facturas emitidas durante el plazo fiscal (5 años).\n\nSi no fuiste tú, escríbenos a ${c.smtp_from}.\n\nEl equipo de Cotiza Go`
    await t.sendMail({ from: `${c.smtp_from_nombre || 'Cotiza Go'} <${c.smtp_from}>`, to: para, subject: 'Tu cuenta de Cotiza Go fue eliminada', text: texto })
    t.close()
  } catch (_) { /* el correo no debe impedir el borrado */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const uc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await uc.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)
    const body = await req.json().catch(() => ({} as any))
    if (body.confirmar !== 'ELIMINAR') return json({ error: 'Falta la confirmación' }, 400)

    const { data: prof } = await admin.from('profiles').select('workspace_id, nombre, email, plan').eq('id', user.id).maybeSingle()
    if (prof?.plan === 'superadmin') return json({ error: 'La cuenta de administrador no se puede eliminar desde aquí.' }, 403)
    const correo = prof?.email || user.email || ''
    const ws = prof?.workspace_id as string | null

    // 1. Stripe (solo si es el dueño: las suscripciones son del negocio).
    const { data: w } = ws ? await admin.from('workspaces').select('owner_id').eq('id', ws).maybeSingle() : { data: null }
    const esDueno = !!ws && w?.owner_id === user.id
    if (esDueno) await cancelarSuscripciones(ws!)

    // 2. Base de datos.
    const { error: eprep } = await admin.rpc('preparar_eliminacion_cuenta', { p_user: user.id })
    if (eprep) return json({ error: 'No se pudo eliminar la cuenta: ' + eprep.message }, 500)

    // 3. Archivos.
    if (esDueno) {
      await borrarCarpeta('logos', ws!).catch(() => {})
      await borrarCarpeta('soporte', ws!).catch(() => {})
    }

    // 4. Usuario (perfil y negocio en cascada).
    const { error: edel } = await admin.auth.admin.deleteUser(user.id)
    if (edel) return json({ error: 'No se pudo eliminar el usuario: ' + edel.message }, 500)

    // 5. Confirmación.
    if (correo) await correoConfirmacion(correo, prof?.nombre ?? '')
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
