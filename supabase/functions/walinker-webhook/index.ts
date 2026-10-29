// Webhook receptor de Walinker. Walinker envia: { event, data, at }
// Eventos: link.created | link.reused | link.error
// Se protege con un token compartido en la query (?token=...) o header X-Webhook-Token,
// porque Walinker no firma los envios.
// (29-oct-2026) El token es OBLIGATORIO: antes, sin token configurado se aceptaba
// todo y cualquiera podia escribir el wa_link de cualquier cotizacion. Ademas el
// link solo se guarda en la cotizacion de ESE workspace (el folio se repite entre
// cuentas: es unico por usuario, no global).
import { createClient } from 'npm:@supabase/supabase-js@2'

// Comparacion en tiempo constante.
function iguales(a, b) {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Token compartido: se compara con el guardado en la boveda.
  const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'walinker_webhook_token').maybeSingle()
  const esperado = (sec && sec.valor) || Deno.env.get('WALINKER_WEBHOOK_TOKEN') || ''
  if (!esperado) return json({ error: 'Webhook sin token configurado' }, 503)
  const url = new URL(req.url)
  const recibido = req.headers.get('x-webhook-token') || url.searchParams.get('token') || ''
  if (!iguales(recibido, esperado)) return json({ error: 'Token invalido' }, 401)

  let body = {}
  try { body = await req.json() } catch { return json({ error: 'JSON invalido' }, 400) }

  const evento = body?.event ?? 'desconocido'
  const d = body?.data ?? {}
  const referencia = d?.external_reference ?? null
  const wsRaw = d?.external_workspace_id ?? d?.external_user_id ?? null
  const esUuid = typeof wsRaw === 'string' && /^[0-9a-f-]{36}$/i.test(wsRaw)

  await admin.from('walinker_eventos').insert({
    evento,
    slug: d?.slug ?? null,
    url: d?.url ?? null,
    referencia,
    workspace_id: esUuid ? wsRaw : null,
    payload: body,
  })

  // Si el link quedo listo, se guarda en la cotizacion correspondiente al folio.
  if ((evento === 'link.created' || evento === 'link.reused') && referencia && d?.url && esUuid) {
    await admin.from('cotizaciones').update({ wa_link: d.url }).eq('numero', referencia).eq('workspace_id', wsRaw)
  }

  return json({ received: true, evento })
})
