// Webhook de Stripe. Atiende DOS flujos:
//   1) Compra de folios (pago único)  -> acredita folios
//   2) Módulos (suscripción mensual)  -> activa / renueva / suspende / cancela
//
// La activación de un módulo ocurre SOLO aquí. El frontend nunca escribe en
// modulo_suscripciones (RLS se lo impide), así que no hay forma de activarse un
// módulo sin haber pagado.
//
// verify_jwt = false: Stripe no manda JWT, se valida con la firma del webhook.
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

const iso = (unix) => unix ? new Date(unix * 1000).toISOString() : null

// OJO con la version de la API de Stripe. Desde 2025 (la cuenta usa
// 2026-01-28.clover) dos campos cambiaron de sitio y ambos llegan como null si
// se leen a la antigua:
//   invoice.subscription            -> invoice.parent.subscription_details.subscription
//   subscription.current_period_end -> subscription.items.data[0].current_period_end
// Se leen las dos formas para que funcione con cuentas viejas y nuevas.
const subIdDeFactura = (inv) =>
  String(inv?.subscription ?? inv?.parent?.subscription_details?.subscription ?? '')

const metadataDeFactura = (inv) =>
  inv?.parent?.subscription_details?.metadata ?? inv?.subscription_details?.metadata ?? null

const finDePeriodo = (sub) =>
  sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null

// Stripe NO garantiza el orden de los eventos: invoice.payment_succeeded puede
// llegar antes que checkout.session.completed. Si la suscripcion todavia no
// existe en nuestra tabla, se reconstruye desde los metadatos que viajan en la
// propia suscripcion. Sin esto, el primer cobro se pierde sin dejar rastro.
async function asegurarSuscripcion(admin, stripe, subId, modo, metaDirecta = null) {
  if (!subId) return null
  const { data: existente } = await admin.from('modulo_suscripciones')
    .select('*').eq('stripe_subscription_id', subId).maybeSingle()
  if (existente) return existente

  // Si la factura ya trae los metadatos, se evita la llamada a la API.
  let sub = null
  let md = metaDirecta
  if (!md?.workspace_id || !md?.clave) {
    try { sub = await stripe.subscriptions.retrieve(subId) } catch (_) { return null }
    md = sub?.metadata ?? {}
  }
  if (!md.workspace_id || !md.clave) return null

  await admin.from('modulo_suscripciones').upsert({
    workspace_id: md.workspace_id,
    clave: md.clave,
    user_id: md.user_id ?? null,
    estado: 'activa',
    modo,
    stripe_subscription_id: subId,
    stripe_customer_id: sub ? String(sub.customer ?? '') : null,
    cancelar_al_terminar: sub ? !!sub.cancel_at_period_end : false,
    periodo_fin: iso(finDePeriodo(sub)),
    fecha_contratacion: new Date().toISOString(),
  }, { onConflict: 'workspace_id,clave' })

  const { data: creada } = await admin.from('modulo_suscripciones')
    .select('*').eq('stripe_subscription_id', subId).maybeSingle()
  return creada
}

// Estado de Stripe -> estado nuestro.
// 'morosa' conserva el acceso a propósito: Stripe reintenta el cobro varios días
// y cortar al primer fallo deja sin servicio a quien solo cambió de tarjeta.
function estadoDesdeStripe(s) {
  if (s === 'active' || s === 'trialing') return 'activa'
  if (s === 'past_due' || s === 'unpaid') return 'morosa'
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelada'
  return null   // incomplete / paused: aún no decide nada
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Sin firma', { status: 400 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.text()

  // Un mismo endpoint puede recibir eventos de PRUEBA y de PRODUCCION, cada uno
  // firmado con su propio whsec. Se intenta validar con ambos.
  const candidatos = [
    { modo: 'test', whsec: await getSecret(admin, 'stripe_test_webhook_secret') },
    { modo: 'live', whsec: await getSecret(admin, 'stripe_live_webhook_secret') },
  ].filter(x => !!x.whsec)
  if (!candidatos.length) return new Response('Webhook sin configurar', { status: 400 })

  let event = null
  const verificador = new Stripe('sk_placeholder', { apiVersion: '2024-06-20' })
  for (const c of candidatos) {
    try {
      event = await verificador.webhooks.constructEventAsync(body, sig, c.whsec)
      break
    } catch (_) { /* probar el siguiente */ }
  }
  if (!event) return new Response('Firma invalida', { status: 400 })

  // El propio evento dice si es real o de prueba.
  const modo = event.livemode ? 'live' : 'test'

  // Cliente con la llave real del modo del evento: se necesita para consultar
  // una suscripcion cuando los eventos llegan desordenados.
  const secretKey = await getSecret(admin, `stripe_${modo}_secret_key`)
  const stripeReal = new Stripe(secretKey || 'sk_placeholder', { apiVersion: '2024-06-20' })

  try {
    switch (event.type) {
      // ---- Alta: folios (pago único) o módulo (suscripción) ------------------
      case 'checkout.session.completed': {
        const session = event.data.object

        if (session.mode === 'subscription') {
          const md = session.metadata ?? {}
          if (md.workspace_id && md.clave) {
            await admin.from('modulo_suscripciones').upsert({
              workspace_id: md.workspace_id,
              clave: md.clave,
              user_id: md.user_id ?? null,
              estado: 'activa',
              modo,
              stripe_subscription_id: String(session.subscription ?? ''),
              stripe_customer_id: String(session.customer ?? ''),
              cancelar_al_terminar: false,
              fecha_contratacion: new Date().toISOString(),
            }, { onConflict: 'workspace_id,clave' })
          }
          break
        }

        // Pago único de folios
        const pagoId = session.metadata?.pago_id
        if (pagoId) {
          await admin.from('pagos').update({
            stripe_payment_id: String(session.payment_intent ?? ''),
            metadata: { modo },
          }).eq('id', pagoId)
          await admin.rpc('acreditar_folios', { pago_uuid: pagoId })
          const { data: pago } = await admin.from('pagos').select('*').eq('id', pagoId).single()
          if (pago) await avisarRecarga(admin, pago)
        }
        break
      }

      // ---- Renovación mensual cobrada ---------------------------------------
      // Stripe manda DOS eventos equivalentes al cobrar una suscripción:
      // invoice.paid e invoice.payment_succeeded. Se atienden los dos para que
      // funcione con cualquiera que esté activo en el panel; el registro del
      // cobro es idempotente (índice único por invoice), así que si llegaran
      // ambos no se duplica la venta.
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const inv = event.data.object
        const subId = subIdDeFactura(inv)
        if (!subId) break

        const sus = await asegurarSuscripcion(admin, stripeReal, subId, modo, metadataDeFactura(inv))
        if (!sus) break

        const linea = inv.lines?.data?.[0]
        await admin.from('modulo_suscripciones').update({
          estado: 'activa',
          ultimo_pago_at: new Date().toISOString(),
          periodo_fin: iso(linea?.period?.end) ?? sus.periodo_fin,
          fecha_renovacion: iso(linea?.period?.end) ?? sus.fecha_renovacion,
        }).eq('id', sus.id)

        // Se registra el cobro para que aparezca en Pagos del superadmin.
        // Se comprueba antes por número de factura; el índice único sobre
        // metadata->>'invoice' queda como última defensa si dos eventos entran
        // a la vez. Un duplicado no debe tumbar el webhook, solo ignorarse.
        if (sus.user_id && Number(inv.amount_paid) > 0) {
          const { data: yaHay } = await admin.from('pagos')
            .select('id').eq('tipo', 'modulo').eq('metadata->>invoice', inv.id).maybeSingle()
          if (!yaHay) {
            const { error: pagoErr } = await admin.from('pagos').insert({
              user_id: sus.user_id,
              workspace_id: sus.workspace_id,
              monto: Number(inv.amount_paid) / 100,
              moneda: String(inv.currency ?? 'mxn').toUpperCase(),
              proveedor: 'stripe',
              tipo: 'modulo',
              paquete_nombre: sus.clave,
              folios_cantidad: 0,
              // 'aprobado' es el mismo valor que usa acreditar_folios para las
              // recargas. Si aqui se usara otra palabra, los totales del
              // superadmin dejarian fuera los cobros de modulos.
              estado: 'aprobado',
              stripe_payment_id: String(inv.payment_intent ?? inv.id),
              metadata: { modo, clave: sus.clave, invoice: inv.id },
            })
            // 23505 = violación de índice único: el cobro ya estaba registrado.
            if (pagoErr && pagoErr.code !== '23505') throw pagoErr
          }
        }
        break
      }

      // ---- No se pudo cobrar: queda morosa, conserva acceso ------------------
      case 'invoice.payment_failed': {
        const inv = event.data.object
        const subId = subIdDeFactura(inv)
        if (!subId) break
        await admin.from('modulo_suscripciones')
          .update({ estado: 'morosa' })
          .eq('stripe_subscription_id', subId)
        break
      }

      // ---- Cambios de estado / cancelación programada ------------------------
      case 'customer.subscription.updated': {
        const sub = event.data.object
        // Puede llegar antes que checkout.session.completed.
        await asegurarSuscripcion(admin, stripeReal, String(sub.id), modo)
        const nuevo = estadoDesdeStripe(sub.status)
        const fin = iso(finDePeriodo(sub))
        const patch = {
          cancelar_al_terminar: !!sub.cancel_at_period_end,
          periodo_fin: fin,
          fecha_renovacion: fin,
        }
        if (nuevo) patch.estado = nuevo
        await admin.from('modulo_suscripciones')
          .update(patch).eq('stripe_subscription_id', String(sub.id))
        break
      }

      // ---- Baja definitiva: se corta el acceso ------------------------------
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await admin.from('modulo_suscripciones').update({
          estado: 'cancelada',
          cancelar_al_terminar: false,
          periodo_fin: iso(sub.ended_at ?? finDePeriodo(sub)),
        }).eq('stripe_subscription_id', String(sub.id))
        break
      }
    }
  } catch (e) {
    // Un fallo al procesar no debe hacer que Stripe reintente para siempre en
    // bucle; se responde 500 solo para que reintente un número acotado de veces.
    return new Response(`Error procesando ${event.type}: ${e}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true, modo, tipo: event.type }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
