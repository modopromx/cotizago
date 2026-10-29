// API pública para crear cotizaciones desde apps externas / integraciones.
// Autenticación por API key (Authorization: Bearer cg_live_...). La llave se
// mapea a un workspace; la cotización se crea, se marca "enviada" (consume 1
// folio, igual que en el panel) y se devuelve su enlace público.
// (29-oct-2026) El folio se cobra con la RPC atómica consumir_folio_api (antes:
// leer saldo y escribir saldo-1, y dos peticiones a la vez salían con un solo
// folio). Y la llave debe ser del dueño del workspace: solo gasta SUS folios.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SITIO = 'https://cotizago.com.mx'

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const num = (v: unknown, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1) Autenticación por API key
    const raw = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!raw) return json({ error: 'Falta la API key (header Authorization: Bearer cg_live_...)' }, 401)
    const hash = await sha256hex(raw)
    const { data: key } = await admin.from('api_keys').select('id, workspace_id, user_id, activo').eq('token_hash', hash).maybeSingle()
    if (!key || !key.activo) return json({ error: 'API key inválida o desactivada' }, 401)
    const ws = key.workspace_id as string
    const uid = key.user_id as string
    // La llave solo vale si su usuario pertenece a ese workspace (llaves viejas
    // pudieron crearse con el user_id de otra cuenta).
    const { data: dueno } = await admin.from('profiles').select('workspace_id').eq('id', uid).maybeSingle()
    if (!dueno || dueno.workspace_id !== ws) return json({ error: 'API key inválida o desactivada' }, 401)
    admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {})

    // 2) Datos de entrada
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Cuerpo JSON inválido' }, 400)
    const cli = body.cliente ?? {}
    if (!cli.nombre || !String(cli.nombre).trim()) return json({ error: 'Falta cliente.nombre' }, 400)
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return json({ error: 'Se requiere al menos un concepto en items[]' }, 400)
    for (const it of items) {
      if (!it || !it.nombre || !String(it.nombre).trim()) return json({ error: 'Cada item requiere "nombre"' }, 400)
    }
    const moneda = ['MXN', 'USD', 'COP'].includes(body.moneda) ? body.moneda : 'MXN'

    // 3) Verifica que haya folio disponible ANTES de crear nada
    const { data: prof } = await admin.from('profiles').select('folios_balance').eq('id', uid).maybeSingle()
    if ((prof?.folios_balance ?? 0) < 1) return json({ error: 'Sin folios disponibles. Recarga para enviar cotizaciones.' }, 402)

    // 4) Cliente: reutiliza por email dentro del workspace, o crea uno nuevo
    let cliente: any = null
    if (cli.email && String(cli.email).trim()) {
      const { data } = await admin.from('clientes').select('*').eq('workspace_id', ws).ilike('email', String(cli.email).trim()).limit(1).maybeSingle()
      cliente = data
    }
    if (!cliente) {
      const { data, error } = await admin.from('clientes').insert({
        user_id: uid, workspace_id: ws, activo: true,
        nombre: String(cli.nombre).trim(),
        email: cli.email ?? null, whatsapp: cli.whatsapp ?? null,
        empresa: cli.empresa ?? null, rfc: cli.rfc ?? null,
        razon_social: cli.razon_social ?? null,
      }).select('*').single()
      if (error) return json({ error: 'No se pudo crear el cliente: ' + error.message }, 500)
      cliente = data
    }

    // 5) Totales con descuento POR ÍTEM (items[].descuento_porcentaje). El IVA
    //    se calcula sobre el precio ya descontado de cada concepto.
    const idesc = (i: any) => Math.min(Math.max(num(i.descuento_porcentaje, 0), 0), 100)
    const subtotalBruto = items.reduce((s: number, i: any) => s + num(i.cantidad, 1) * num(i.precio_unitario), 0)
    const descMonto = items.reduce((s: number, i: any) => s + num(i.cantidad, 1) * num(i.precio_unitario) * (idesc(i) / 100), 0)
    const impuestos = items.reduce((s: number, i: any) => s + num(i.cantidad, 1) * num(i.precio_unitario) * (1 - idesc(i) / 100) * (num(i.iva_porcentaje, 0) / 100), 0)
    const total = subtotalBruto - descMonto + impuestos

    // 6) Número de folio y alta de la cotización (borrador). Si dos peticiones
    //    coinciden y el folio choca (23505), se reintenta con un número nuevo.
    let cot: any = null
    let numero: any = null
    for (let intento = 0; intento < 4 && !cot; intento++) {
      const g = await admin.rpc('generate_cotizacion_number', { user_uuid: uid })
      numero = g.data
      const r = await admin.from('cotizaciones').insert({
        user_id: uid, workspace_id: ws, cliente_id: cliente.id,
        numero, moneda, notas: body.notas ?? null, terminos: body.terminos ?? null,
        fecha_vencimiento: body.fecha_vencimiento || null,
        subtotal: subtotalBruto, descuento_porcentaje: 0, descuento_monto: descMonto,
        impuestos, total, estado: 'borrador', folio_consumido: false,
        cliente_nombre: cliente.nombre ?? '', cliente_empresa: cliente.empresa ?? '',
        cliente_email: cliente.email ?? '', cliente_whatsapp: cliente.whatsapp ?? '',
        cliente_rfc: cliente.rfc ?? '', cliente_razon_social: cliente.razon_social ?? '',
        cliente_pais: cliente.pais ?? '', cliente_cp: cliente.codigo_postal ?? '',
      }).select('*').single()
      if (!r.error) { cot = r.data; break }
      if ((r.error as any).code !== '23505') return json({ error: 'No se pudo crear la cotización: ' + r.error.message }, 500)
    }
    if (!cot) return json({ error: 'No se pudo asignar un folio único, intenta de nuevo.' }, 500)

    await admin.from('cotizacion_items').insert(items.map((it: any, idx: number) => ({
      cotizacion_id: cot.id,
      nombre: String(it.nombre), descripcion: it.descripcion ?? null, unidad: it.unidad ?? null,
      cantidad: num(it.cantidad, 1), precio_unitario: num(it.precio_unitario),
      iva_porcentaje: num(it.iva_porcentaje, 0), descuento_porcentaje: idesc(it),
      subtotal: num(it.cantidad, 1) * num(it.precio_unitario) * (1 - idesc(it) / 100) * (1 + num(it.iva_porcentaje, 0) / 100),
      orden: idx,
    })))

    // 7) Consume 1 folio y marca "enviada" en una sola operación de la base. Si en
    //    ese instante ya no hay folio (otra petición lo gastó), se borra el borrador.
    const { data: saldo, error: eFolio } = await admin.rpc('consumir_folio_api', {
      cotizacion_uuid: cot.id, usuario: uid, referencia: 'API · ' + numero,
    })
    if (eFolio) {
      await admin.from('cotizaciones').delete().eq('id', cot.id)
      const sinFolios = /folios/i.test(eFolio.message)
      return json({ error: sinFolios ? 'Sin folios disponibles. Recarga para enviar cotizaciones.' : 'No se pudo enviar la cotización: ' + eFolio.message }, sinFolios ? 402 : 500)
    }

    return json({
      ok: true,
      id: cot.id,
      numero,
      estado: 'enviada',
      moneda,
      total,
      cliente: { id: cliente.id, nombre: cliente.nombre },
      public_url: `${SITIO}/c/${cot.token}`,
      folios_restantes: saldo,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
