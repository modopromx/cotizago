// Crea la sesión de Stripe Checkout (embebida) para comprar un paquete de folios.
// (28-oct-2026) Métodos de pago EXPLÍCITOS: solo tarjeta. OXXO se habilita con
// config_plataforma.stripe_oxxo = 'si' (y solo en MXN), DESPUÉS de suscribir el
// webhook de Stripe a checkout.session.async_payment_succeeded / _failed; sin esos
// eventos quien pagara en OXXO nunca recibiría sus folios.
// (29-oct-2026) Sin meses sin intereses: se apagan explícitamente en la sesión,
// aunque alguien los active en el panel de Stripe.
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MONEDAS = ['MXN', 'USD', 'BRL', 'EUR'] // divisas soportadas

async function getSecret(admin, clave, envName) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || (envName ? Deno.env.get(envName) : '') || ''
}
async function getConfig(admin, clave) {
  const { data } = await admin.from('config_plataforma').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || ''
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

    const body = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // El paquete se resuelve SIEMPRE en el servidor (no se confía en el cliente).
    let paq: any = null
    if (body.paquete_id) {
      const { data } = await admin.from('paquetes_folios').select('*').eq('id', body.paquete_id).eq('activo', true).maybeSingle()
      paq = data
    } else if (body.paquete_nombre) {
      const { data } = await admin.from('paquetes_folios').select('*').eq('nombre', body.paquete_nombre).eq('activo', true).maybeSingle()
      paq = data
    }
    if (!paq) return json({ error: 'Paquete no disponible' }, 400)

    // Moneda: la que pide el cliente (según su idioma) si es soportada y el paquete
    // tiene precio en ella; si no, la moneda base del paquete.
    const pedida = String(body.moneda || '').toUpperCase()
    const precios = paq.precios || {}
    const moneda = (MONEDAS.includes(pedida) && precios[pedida] != null) ? pedida : (paq.moneda || 'USD').toUpperCase()
    const precio = precios[moneda] != null ? Number(precios[moneda]) : Number(paq.precio)
    if (!(precio > 0)) return json({ error: 'Precio no disponible para la moneda' }, 400)
    const currency = moneda.toLowerCase()
    const folios = Number(paq.folios)
    const paquete_nombre = paq.nombre

    const { data: prof } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single()

    const modo = (await getConfig(admin, 'stripe_modo')) === 'live' ? 'live' : 'test'
    const secretKey = await getSecret(admin, `stripe_${modo}_secret_key`, 'STRIPE_SECRET_KEY')
    if (!secretKey) return json({ error: `Stripe no configurado en modo ${modo === 'live' ? 'Producción' : 'Prueba'}.` }, 400)

    const oxxo = (await getConfig(admin, 'stripe_oxxo')) === 'si' && currency === 'mxn'
    const metodos = oxxo ? ['card', 'oxxo'] : ['card']

    const { data: pago, error: pagoErr } = await admin.from('pagos').insert({
      user_id: user.id, workspace_id: prof?.workspace_id ?? null,
      monto: precio, moneda, folios_cantidad: folios, paquete_nombre,
      proveedor: 'stripe', tipo: 'folio_topup', estado: 'pendiente',
      metadata: { modo },
    }).select('id').single()
    if (pagoErr || !pago) return json({ error: 'No se pudo registrar el pago' }, 500)

    const origin = req.headers.get('origin') ?? 'http://localhost:5173'
    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
    const params: any = {
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: metodos,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `${paquete_nombre} · ${folios} cotizaciones Cotiza Go` },
          unit_amount: Math.round(precio * 100),
        },
        quantity: 1,
      }],
      metadata: { pago_id: pago.id, user_id: user.id, modo },
      return_url: `${origin}/app/folios?pago=procesando&session_id={CHECKOUT_SESSION_ID}`,
    }
    // Meses sin intereses: solo existen en MXN; se apagan siempre.
    if (currency === 'mxn') params.payment_method_options = { card: { installments: { enabled: false } } }
    let session
    try {
      session = await stripe.checkout.sessions.create(params)
    } catch (e) {
      // Si Stripe no acepta la opción de meses, se cobra igual sin ella (nunca se rompe el cobro).
      if (!params.payment_method_options || !/installment/i.test(String(e))) throw e
      delete params.payment_method_options
      session = await stripe.checkout.sessions.create(params)
    }

    await admin.from('pagos').update({ metadata: { modo, session: session.id } }).eq('id', pago.id)
    return json({ clientSecret: session.client_secret, modo })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
