// Webhook de Stripe. Atiende DOS flujos:
//   1) Compra de folios (pago único)  -> acredita folios (+ recompensa de referido)
//   2) Módulos (suscripción mensual)  -> activa / renueva / suspende / cancela
//
// verify_jwt = false: Stripe no manda JWT, se valida con la firma del webhook.
//
// (28-oct-2026, auditoría go-live)
// - SOLO se acredita cuando el dinero ya se cobró (session.payment_status = 'paid').
//   Con OXXO/pagos diferidos, checkout.session.completed llega al GENERAR la ficha
//   (payment_status 'unpaid'): antes se regalaban los folios/módulos. Ahora quedan
//   pendientes y se acreditan en checkout.session.async_payment_succeeded; si la
//   ficha vence, async_payment_failed marca el pago como 'fallido'.
// - Solo se procesan eventos del modo activo (config_plataforma.stripe_modo): en
//   producción un evento de prueba (tarjeta 4242) ya no acredita nada.
// - Si acreditar falla, se responde 500 para que Stripe REINTENTE (acreditar_folios
//   es idempotente: bloquea el pago y revisa 'acreditado').
// (29-oct-2026) Factura automática: con cada pago cobrado (folios o módulo) se
// llama a factura-automatica en segundo plano; si falla, el cron horario la retoma.
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

async function getSecret(admin, clave) {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return (data && data.valor) || ''
}

const render = (txt, vars) => (txt ?? '').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')

async function avisarRecarga(admin, pago) {
  try {
    const { data: rk } = await admin.from('plataforma_secretos').select('valor').eq('clave','resend_api_key').maybeSingle()
    const apiKey = (rk && rk.valor) || Deno.env.get('RESEND_API_KEY') || ''
    if (!apiKey) return
    const { data: prof } = await admin.from('profiles').select('email,nombre,folios_balance').eq('id', pago.user_id).single()
    if (!prof?.email) return
    const { data: tpl } = await admin.from('email_templates').select('*').eq('clave', 'recarga_exitosa').maybeSingle()
    if (!tpl) return
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor')
    const c = {}
    ;(cfg ?? []).forEach((r) => { c[r.clave] = r.valor ?? '' })
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
        from: `${c.smtp_from_nombre || 'Cotiza Go'} <${c.smtp_from || 'no-reply@cotizago.com.mx'}>`,
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

/** Factura automática en segundo plano: no demora la respuesta a Stripe ni la rompe. */
function facturarEnAutomatico(pagoId) {
  if (!pagoId) return
  const tarea = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/factura-automatica`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cg-interna': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' },
    body: JSON.stringify({ pago_id: pagoId }),
  }).catch(() => { /* el cron horario la retoma */ })
  try { EdgeRuntime.waitUntil(tarea) } catch (_) { /* sin waitUntil, la promesa sigue sola */ }
}

/** Acredita los folios de un pago YA COBRADO. Lanza si falla para que Stripe reintente. */
async function acreditarPago(admin, pagoId, paymentIntent, modo) {
  const { error: upErr } = await admin.from('pagos').update({
    stripe_payment_id: String(paymentIntent ?? ''), metadata: { modo },
  }).eq('id', pagoId)
  if (upErr) throw new Error('No se pudo actualizar el pago: ' + upErr.message)
  const { error: acErr } = await admin.rpc('acreditar_folios', { pago_uuid: pagoId })
  if (acErr) throw new Error('No se pudieron acreditar los folios: ' + acErr.message)
  // Recompensa de referido (si aplica). Nunca debe romper el webhook.
  try { await admin.rpc('acreditar_referido', { pago_uuid: pagoId }) } catch (_) { /* ignora */ }
  const { data: pago } = await admin.from('pagos').select('*').eq('id', pagoId).single()
  if (pago) await avisarRecarga(admin, pago)
  facturarEnAutomatico(pagoId)
}

const iso = (unix) => unix ? new Date(unix * 1000).toISOString() : null
const subIdDeFactura = (inv) =>
  String(inv?.subscription ?? inv?.parent?.subscription_details?.subscription ?? '')
const metadataDeFactura = (inv) =>
  inv?.parent?.subscription_details?.metadata ?? inv?.subscription_details?.metadata ?? null
const finDePeriodo = (sub) =>
  sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null

async function asegurarSuscripcion(admin, stripe, subId, modo, metaDirecta = null) {
  if (!subId) return null
  const { data: existente } = await admin.from('modulo_suscripciones')
    .select('*').eq('stripe_subscription_id', subId).maybeSingle()
  if (existente) return existente
  let sub = null
  let md = metaDirecta
  if (!md?.workspace_id || !md?.clave) {
    try { sub = await stripe.subscriptions.retrieve(subId) } catch (_) { return null }
    md = sub?.metadata ?? {}
  }
  if (!md.workspace_id || !md.clave) return null
  await admin.from('modulo_suscripciones').upsert({
    workspace_id: md.workspace_id, clave: md.clave, user_id: md.user_id ?? null,
    estado: 'activa', modo, stripe_subscription_id: subId,
    stripe_customer_id: sub ? String(sub.customer ?? '') : null,
    cancelar_al_terminar: sub ? !!sub.cancel_at_period_end : false,
    periodo_fin: iso(finDePeriodo(sub)), fecha_contratacion: new Date().toISOString(),
  }, { onConflict: 'workspace_id,clave' })
  const { data: creada } = await admin.from('modulo_suscripciones')
    .select('*').eq('stripe_subscription_id', subId).maybeSingle()
  return creada
}

function estadoDesdeStripe(s) {
  if (s === 'active' || s === 'trialing') return 'activa'
  if (s === 'past_due' || s === 'unpaid') return 'morosa'
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelada'
  return null
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Sin firma', { status: 400 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.text()
  const candidatos = [
    { modo: 'test', whsec: await getSecret(admin, 'stripe_test_webhook_secret') },
    { modo: 'live', whsec: await getSecret(admin, 'stripe_live_webhook_secret') },
  ].filter(x => !!x.whsec)
  if (!candidatos.length) return new Response('Webhook sin configurar', { status: 400 })
  let event = null
  const verificador = new Stripe('sk_placeholder', { apiVersion: '2024-06-20' })
  for (const c of candidatos) {
    try { event = await verificador.webhooks.constructEventAsync(body, sig, c.whsec); break } catch (_) { /* siguiente */ }
  }
  if (!event) return new Response('Firma invalida', { status: 400 })
  const modo = event.livemode ? 'live' : 'test'

  // Solo eventos del modo activo de la plataforma.
  const { data: cfgModo } = await admin.from('config_plataforma').select('valor').eq('clave', 'stripe_modo').maybeSingle()
  const modoActivo = (cfgModo && cfgModo.valor) === 'live' ? 'live' : 'test'
  if (modo !== modoActivo) {
    return new Response(JSON.stringify({ received: true, ignorado: `evento ${modo} con la plataforma en ${modoActivo}` }), { headers: { 'Content-Type': 'application/json' } })
  }

  const secretKey = await getSecret(admin, `stripe_${modo}_secret_key`)
  const stripeReal = new Stripe(secretKey || 'sk_placeholder', { apiVersion: '2024-06-20' })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const cobrado = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
        if (session.mode === 'subscription') {
          // Sin cobro confirmado no se activa: invoice.paid lo activará cuando se cobre.
          if (!cobrado) break
          const md = session.metadata ?? {}
          if (md.workspace_id && md.clave) {
            const { error } = await admin.from('modulo_suscripciones').upsert({
              workspace_id: md.workspace_id, clave: md.clave, user_id: md.user_id ?? null,
              estado: 'activa', modo, stripe_subscription_id: String(session.subscription ?? ''),
              stripe_customer_id: String(session.customer ?? ''), cancelar_al_terminar: false,
              fecha_contratacion: new Date().toISOString(),
            }, { onConflict: 'workspace_id,clave' })
            if (error) throw new Error('No se pudo activar el módulo: ' + error.message)
          }
          break
        }
        const pagoId = session.metadata?.pago_id
        if (!pagoId) break
        if (session.payment_status === 'paid') {
          await acreditarPago(admin, pagoId, session.payment_intent, modo)
        } else {
          // OXXO u otro pago diferido: la ficha se generó pero AÚN NO se paga.
          await admin.from('pagos').update({
            estado: 'pendiente', stripe_payment_id: String(session.payment_intent ?? ''),
            metadata: { modo, esperando_pago: true, session: session.id },
          }).eq('id', pagoId)
        }
        break
      }
      case 'checkout.session.async_payment_succeeded': {
        // Se pagó la ficha de OXXO (u otro pago diferido): ahora sí se acredita.
        const session = event.data.object
        const pagoId = session.metadata?.pago_id
        if (pagoId && session.mode === 'payment') await acreditarPago(admin, pagoId, session.payment_intent, modo)
        break
      }
      case 'checkout.session.async_payment_failed': {
        // La ficha venció sin pagarse.
        const session = event.data.object
        const pagoId = session.metadata?.pago_id
        if (pagoId) {
          await admin.from('pagos').update({ estado: 'fallido', metadata: { modo, motivo: 'pago diferido no completado', session: session.id } })
            .eq('id', pagoId).eq('acreditado', false)
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object
        const subId = subIdDeFactura(inv)
        if (!subId) break
        const sus = await asegurarSuscripcion(admin, stripeReal, subId, modo, metadataDeFactura(inv))
        if (!sus) break
        const linea = inv.lines?.data?.[0]
        await admin.from('modulo_suscripciones').update({
          estado: 'activa', ultimo_pago_at: new Date().toISOString(),
          periodo_fin: iso(linea?.period?.end) ?? sus.periodo_fin,
          fecha_renovacion: iso(linea?.period?.end) ?? sus.fecha_renovacion,
        }).eq('id', sus.id)
        if (sus.user_id && Number(inv.amount_paid) > 0) {
          const { data: yaHay } = await admin.from('pagos')
            .select('id').eq('tipo', 'modulo').eq('metadata->>invoice', inv.id).maybeSingle()
          if (!yaHay) {
            const { data: nuevoPago, error: pagoErr } = await admin.from('pagos').insert({
              user_id: sus.user_id, workspace_id: sus.workspace_id,
              monto: Number(inv.amount_paid) / 100, moneda: String(inv.currency ?? 'mxn').toUpperCase(),
              proveedor: 'stripe', tipo: 'modulo', paquete_nombre: sus.clave, folios_cantidad: 0,
              estado: 'aprobado', stripe_payment_id: String(inv.payment_intent ?? inv.id),
              metadata: { modo, clave: sus.clave, invoice: inv.id },
            }).select('id').single()
            if (pagoErr && pagoErr.code !== '23505') throw pagoErr
            if (nuevoPago?.id) facturarEnAutomatico(nuevoPago.id)
          }
        }
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object
        const subId = subIdDeFactura(inv)
        if (!subId) break
        await admin.from('modulo_suscripciones').update({ estado: 'morosa' }).eq('stripe_subscription_id', subId)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object
        await asegurarSuscripcion(admin, stripeReal, String(sub.id), modo)
        const nuevo = estadoDesdeStripe(sub.status)
        const fin = iso(finDePeriodo(sub))
        const patch = { cancelar_al_terminar: !!sub.cancel_at_period_end, periodo_fin: fin, fecha_renovacion: fin }
        if (nuevo) patch.estado = nuevo
        await admin.from('modulo_suscripciones').update(patch).eq('stripe_subscription_id', String(sub.id))
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await admin.from('modulo_suscripciones').update({
          estado: 'cancelada', cancelar_al_terminar: false,
          periodo_fin: iso(sub.ended_at ?? finDePeriodo(sub)),
        }).eq('stripe_subscription_id', String(sub.id))
        break
      }
    }
  } catch (e) {
    return new Response(`Error procesando ${event.type}: ${e}`, { status: 500 })
  }
  return new Response(JSON.stringify({ received: true, modo, tipo: event.type }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
