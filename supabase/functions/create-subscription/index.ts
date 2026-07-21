// Cobro de un módulo como suscripción mensual, con Stripe embebido.
// Devuelve el clientSecret para montar <EmbeddedCheckout> en el panel.
// La activación NO ocurre aquí: la hace el webhook cuando Stripe confirma el
// pago. Así nadie se activa un módulo sin haber pagado.
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

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

    const { clave } = await req.json()
    if (!clave) return json({ error: 'Falta el módulo' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    // El precio SIEMPRE sale de la base, nunca del cliente: si viniera en el
    // body, cualquiera podría contratar un módulo de $99 por $1.
    const { data: mod } = await admin.from('modulos').select('*').eq('clave', clave).eq('activo', true).maybeSingle()
    if (!mod) return json({ error: 'Módulo no disponible' }, 404)

    const { data: prof } = await admin.from('profiles').select('workspace_id,email,nombre').eq('id', user.id).single()
    const ws = prof?.workspace_id
    if (!ws) return json({ error: 'Sin empresa asignada' }, 400)

    // Si ya está vigente, no se cobra dos veces.
    const { data: yaTiene } = await admin.from('modulo_suscripciones')
      .select('estado').eq('workspace_id', ws).eq('clave', clave).maybeSingle()
    if (yaTiene && ['activa', 'morosa'].includes(yaTiene.estado)) {
      return json({ error: 'Ya tienes este módulo activo' }, 409)
    }

    const { data: cfgModo } = await admin.from('config_plataforma').select('valor').eq('clave', 'stripe_modo').maybeSingle()
    const modo = (cfgModo && cfgModo.valor) === 'live' ? 'live' : 'test'
    const secretKey = await getSecret(admin, `stripe_${modo}_secret_key`)
    if (!secretKey) return json({ error: `Stripe no configurado en modo ${modo === 'live' ? 'Producción' : 'Prueba'}.` }, 400)

    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })

    // Cliente de Stripe por workspace. Se guarda separado por modo: un customer
    // de prueba no existe en producción y Stripe respondería "No such customer".
    const campoCliente = `stripe_customer_${modo}_id`
    const { data: wsRow } = await admin.from('workspaces').select(`id,nombre,${campoCliente}`).eq('id', ws).single()
    let customerId = wsRow?.[campoCliente] ?? null

    if (customerId) {
      // Si lo borraron desde el panel de Stripe, se crea uno nuevo.
      try {
        const c = await stripe.customers.retrieve(customerId)
        if ((c as any)?.deleted) customerId = null
      } catch { customerId = null }
    }
    if (!customerId) {
      const cliente = await stripe.customers.create({
        email: prof?.email ?? undefined,
        name: wsRow?.nombre ?? prof?.nombre ?? undefined,
        metadata: { workspace_id: ws },
      })
      customerId = cliente.id
      await admin.from('workspaces').update({ [campoCliente]: customerId }).eq('id', ws)
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:5173'
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      customer: customerId,
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: `${mod.nombre} · Cotiza Go` },
          unit_amount: Math.round(Number(mod.precio) * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      // En la sesión para checkout.session.completed...
      metadata: { workspace_id: ws, clave, user_id: user.id, modo },
      // ...y en la SUSCRIPCIÓN, porque los eventos de renovación y de cobro
      // fallido no traen la metadata de la sesión, solo la de la suscripción.
      subscription_data: {
        metadata: { workspace_id: ws, clave, user_id: user.id, modo },
      },
      return_url: `${origin}/app/modulos?suscripcion=procesando&session_id={CHECKOUT_SESSION_ID}`,
    })

    return json({ clientSecret: session.client_secret, modo, precio: mod.precio, nombre: mod.nombre })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
