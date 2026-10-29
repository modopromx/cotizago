// Crea (o recupera) el facturable de un PAGO de CotizaGo para el usuario
// autenticado (recargas de folios, planes Y módulos). Devuelve el token para
// llevarlo al portal /facturar. La factura sale con la marca de CotizaGo.
// (29-oct-2026) Solo pagos COBRADOS (estado 'aprobado'): antes se podía pedir
// factura de una ficha OXXO sin pagar o de un pago fallido.
import { createClient } from 'npm:@supabase/supabase-js@2'

const COTIZAGO_APP = '3b024f16-b561-45dc-a6e1-e52f7e881b2e' // marca 'Cotiza Go' (logo + color)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const { pago_id } = await req.json().catch(() => ({} as any))
    if (!pago_id) return json({ error: 'Falta pago_id' }, 400)

    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).maybeSingle()
    const ws = prof?.workspace_id
    if (!ws) return json({ error: 'Sin workspace' }, 400)

    const { data: pago } = await admin.from('pagos').select('*').eq('id', pago_id).maybeSingle()
    if (!pago || pago.workspace_id !== ws) return json({ error: 'Pago no encontrado' }, 404)
    if (pago.estado !== 'aprobado') return json({ error: 'Este pago todavía no está cobrado; podrás facturarlo cuando se confirme.' }, 409)

    // Si ya hay facturable para este pago, reutilizarlo
    const { data: existente } = await admin.from('facturables').select('token, estado').eq('pago_id', pago_id).maybeSingle()
    if (existente) return json({ ok: true, token: existente.token, estado: existente.estado })

    // El monto pagado incluye IVA; separamos base e IVA (16%)
    const total = Number(pago.monto) || 0
    const subtotal = +(total / 1.16).toFixed(2)
    const iva = +(total - subtotal).toFixed(2)

    // Descripción legible según el tipo de pago.
    let desc: string
    if (pago.tipo === 'modulo') {
      const { data: mod } = await admin.from('modulos').select('nombre, periodicidad').eq('clave', pago.paquete_nombre).maybeSingle()
      const nombreMod = mod?.nombre || pago.paquete_nombre || 'Módulo'
      desc = `Módulo ${nombreMod}${mod?.periodicidad ? ` · suscripción ${mod.periodicidad}` : ''}`
    } else {
      desc = `${pago.paquete_nombre ?? 'Suscripción Cotiza Go'}${pago.folios_cantidad ? ` · ${pago.folios_cantidad} folios` : ''}`
    }
    // 81112500 = Servicios de alquiler/arrendamiento de licencias de software (SaaS)
    const conceptos = [{ clave_prod_serv: '81112500', clave_unidad: 'E48', descripcion: desc, cantidad: 1, valor_unitario: subtotal, iva_tasa: 0.16 }]

    const { data: nuevo, error } = await admin.from('facturables').insert({
      origen: 'cotizago', referencia_externa: pago_id, workspace_id: ws, pago_id, app_id: COTIZAGO_APP,
      cliente_email: user.email ?? null,
      descripcion: desc, conceptos, subtotal, iva, total, moneda: pago.moneda ?? 'MXN', estado: 'pendiente',
    }).select('token').single()
    if (error) {
      // Dos clics a la vez: el índice único por pago frena el segundo; se devuelve el que quedó.
      const { data: ya } = await admin.from('facturables').select('token, estado').eq('pago_id', pago_id).maybeSingle()
      if (ya) return json({ ok: true, token: ya.token, estado: ya.estado })
      return json({ error: error.message }, 500)
    }

    return json({ ok: true, token: nuevo.token, estado: 'pendiente' })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
