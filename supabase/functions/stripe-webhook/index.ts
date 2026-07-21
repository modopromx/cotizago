// Edge Function: webhook de Stripe. Al completarse el pago, acredita los folios.
// Lee las llaves desde la bóveda plataforma_secretos (service_role); si no están,
// cae a los secrets de entorno STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
// verify_jwt = false (Stripe no manda JWT; se valida con la firma del webhook).
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

async function getSecret(admin: any, clave: string, envName: string) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || Deno.env.get(envName) || ''
}

const render = (txt: string, vars: Record<string, string>) =>
  (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')

// Avisa al usuario que sus folios fueron acreditados (plantilla recarga_exitosa).
// Nunca debe romper el webhook: cualquier fallo se ignora.
async function avisarRecarga(admin: any, pago: any) {
  try {
    const apiKey = await getSecret(admin, 'resend_api_key', 'RESEND_API_KEY')
    if (!apiKey) return
    const { data: prof } = await admin.from('profiles').select('email,nombre,folios_balance').eq('id', pago.user_id).single()
    if (!prof?.email) return
    const { data: tpl } = await admin.from('email_templates').select('*').eq('clave', 'recarga_exitosa').maybeSingle()
    if (!tpl) return
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor')
    const c: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const vars = {
      plataforma: c.nombre_plataforma || 'Cotiza Go',
      nombre: prof.nombre || 'Hola',
      referencia: String(pago.id).slice(0, 8).toUpperCase(),
      paquete: pago.paquete_nombre || 'Recarga de folios',
      folios_acreditados: String(pago.folios_cantidad ?? 0),
      monto: new Intl.NumberFormat('es-MX', { style: 'currency', currency: pago.moneda || 'MXN' }).format(Number(pago.monto) || 0),
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }),
      saldo_actual: String(prof.folios_balance ?? 0),
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${c.smtp_from_nombre || 'Cotiza Go'} <${c.smtp_from || 'no-reply@cotizago.com'}>`,
        to: [prof.email], subject: render(tpl.asunto, vars),
        html: tpl.cuerpo_html ? render(tpl.cuerpo_html, vars) : `<pre>${render(tpl.cuerpo, vars)}</pre>`,
        text: render(tpl.cuerpo, vars),
      }),
    })
    await admin.from('email_envios').insert({
      workspace_id: pago.workspace_id, destinatario: prof.email,
      asunto: render(tpl.asunto, vars), estado: res.ok ? 'enviado' : 'fallido',
    })
  } catch (_) { /* el correo no debe romper el webhook */ }
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Sin firma', { status: 400 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const secretKey = await getSecret(admin, 'stripe_secret_key', 'STRIPE_SECRET_KEY')
  const whsec = await getSecret(admin, 'stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET')

  const body = await req.text()
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, whsec)
  } catch (e) {
    return new Response(`Firma inválida: ${e}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const pagoId = session.metadata?.pago_id
    if (pagoId) {
      await admin.from('pagos').update({ stripe_payment_id: String(session.payment_intent ?? '') }).eq('id', pagoId)
      await admin.rpc('acreditar_folios', { pago_uuid: pagoId })
      const { data: pago } = await admin.from('pagos').select('*').eq('id', pagoId).single()
      if (pago) await avisarRecarga(admin, pago)
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
