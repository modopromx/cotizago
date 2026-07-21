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
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
