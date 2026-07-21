// Edge Function: crea una sesión de Stripe Checkout EMBEBIDA para comprar folios.
// Devuelve el client_secret que el frontend monta con <EmbeddedCheckout>.
// Requiere secret STRIPE_SECRET_KEY. verify_jwt = true (usuario autenticado).
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

    const { folios, precio, paquete_nombre } = await req.json()
    if (!folios || !precio) return json({ error: 'Datos incompletos' }, 400)

    const { data: prof } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single()

    // Registro de pago pendiente (service role: la tabla no permite insert al usuario)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: pago, error: pagoErr } = await admin.from('pagos').insert({
      user_id: user.id, workspace_id: prof?.workspace_id ?? null,
      monto: precio, moneda: 'MXN', folios_cantidad: folios, paquete_nombre,
      proveedor: 'stripe', tipo: 'folio_topup', estado: 'pendiente',
    }).select('id').single()
    if (pagoErr || !pago) return json({ error: 'No se pudo registrar el pago' }, 500)

    const origin = req.headers.get('origin') ?? 'http://localhost:5173'
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: `${paquete_nombre ?? 'Folios'} · ${folios} folios Cotiza Go` },
          unit_amount: Math.round(Number(precio) * 100),
        },
        quantity: 1,
      }],
      metadata: { pago_id: pago.id, user_id: user.id },
      return_url: `${origin}/app/folios?pago=procesando&session_id={CHECKOUT_SESSION_ID}`,
    })

    await admin.from('pagos').update({ stripe_session_id: session.id }).eq('id', pago.id)
    return json({ clientSecret: session.client_secret })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
