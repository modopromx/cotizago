// Edge Function: webhook de Stripe. Al completarse el pago, acredita los folios.
// Requiere secrets STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
// verify_jwt = false (Stripe no manda JWT; se valida con la firma del webhook).
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Sin firma', { status: 400 })

  const body = await req.text()
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  } catch (e) {
    return new Response(`Firma inválida: ${e}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const pagoId = session.metadata?.pago_id
    if (pagoId) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await admin.from('pagos').update({
        stripe_payment_id: String(session.payment_intent ?? ''),
      }).eq('id', pagoId)
      // Acredita folios de forma idempotente (la función ignora repetidos).
      await admin.rpc('acreditar_folios', { pago_uuid: pagoId })
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
