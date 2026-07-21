// Cancela la suscripción de un módulo AL FINAL DEL PERIODO YA PAGADO.
// No se corta el acceso al instante: el usuario pagó el mes completo.
// La baja definitiva la marca el webhook con customer.subscription.deleted.
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Desde la API 2025 de Stripe el fin de periodo dejo de estar en la suscripcion
// y vive en cada item. Se leen ambas formas.
const finDePeriodo = (sub) => {
  const unix = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null
  return unix ? new Date(unix * 1000).toISOString() : null
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

    const { clave, reactivar } = await req.json()
    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).single()
    const ws = prof?.workspace_id
    if (!ws) return json({ error: 'Sin empresa asignada' }, 400)

    // Se busca por workspace del usuario: nadie puede cancelar la de otro.
    const { data: sus } = await admin.from('modulo_suscripciones')
      .select('*').eq('workspace_id', ws).eq('clave', clave).maybeSingle()
    if (!sus) return json({ error: 'No tienes ese módulo' }, 404)

    // Suscripción antigua sin id de Stripe (activada antes del cobro): se da de
    // baja directo, no hay nada que cancelar del lado de Stripe.
    if (!sus.stripe_subscription_id) {
      await admin.from('modulo_suscripciones')
        .update({ estado: 'cancelada', cancelar_al_terminar: false })
        .eq('workspace_id', ws).eq('clave', clave)
      return json({ ok: true, inmediata: true })
    }

    const modo = sus.modo === 'live' ? 'live' : 'test'
    const secretKey = await getSecret(admin, `stripe_${modo}_secret_key`)
    if (!secretKey) return json({ error: 'Stripe no configurado' }, 400)

    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
    const sub = await stripe.subscriptions.update(sus.stripe_subscription_id, {
      cancel_at_period_end: !reactivar,
    })

    await admin.from('modulo_suscripciones').update({
      cancelar_al_terminar: !reactivar,
      periodo_fin: finDePeriodo(sub),
    }).eq('workspace_id', ws).eq('clave', clave)

    return json({
      ok: true,
      cancelar_al_terminar: !reactivar,
      periodo_fin: finDePeriodo(sub),
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
