// Factura AUTOMÁTICA de los pagos de CotizaGo (folios y módulos).
// (29-oct-2026) Cuando el cliente paga (tarjeta, Apple/Google Pay u OXXO ya
// cobrado), si en «Mi empresa» tiene completos sus datos fiscales de México
// (RFC, razón social, régimen y CP), se timbra su CFDI sin que tenga que
// pedirlo y se le manda por correo. Si no los tiene, se queda el botón manual
// de «Notas y facturas».
// - Si SENHUB no tiene timbres: el facturable queda 'en_espera_timbres', se avisa
//   a Omar para comprar más y el cliente ve «tu factura se genera en breve».
//   Cada hora (pg_cron) se reintentan los que esperan.
// - Después de timbrar, si quedan pocos timbres, se avisa a Omar (una vez al día).
//
// Llamadas: SOLO internas. stripe-webhook manda x-cg-interna (service key);
// el cron manda x-cron (token en Vault; aquí se compara su sha256).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const COTIZAGO_APP = '3b024f16-b561-45dc-a6e1-e52f7e881b2e'
const OMAR = '401792b3-e929-44e5-80fc-4a0a66b587ed'
// Solo pagos desde que existe la factura automática: los anteriores se facturan a mano.
const DESDE = '2026-10-29T02:30:00Z'
const TIMBRES_BAJOS = 20
const BASE = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(BASE, SERVICE)
const jh = { 'Content-Type': 'application/json', 'x-cg-interna': SERVICE }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const igual = (a: string, b: string) => {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const sha256 = async (t: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('')

async function autorizado(req: Request): Promise<boolean> {
  if (igual(req.headers.get('x-cg-interna') ?? '', SERVICE)) return true
  const cron = req.headers.get('x-cron') ?? ''
  if (!cron) return false
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'factura_cron_sha256').maybeSingle()
  return !!data?.valor && igual(await sha256(cron), data.valor)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Correo por el SMTP de la plataforma (Hostinger). Nunca rompe el flujo. */
async function correo(para: string[], asunto: string, texto: string) {
  try {
    const { data: cfg } = await admin.from('config_plataforma').select('clave,valor').like('clave', 'smtp%')
    const c: Record<string, string> = {}
    ;(cfg ?? []).forEach((r: any) => { c[r.clave] = r.valor ?? '' })
    const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'smtp_password').maybeSingle()
    if (!c.smtp_host || !c.smtp_from || !sec?.valor) return
    const port = Number(c.smtp_port || 465)
    const client = new SMTPClient({ connection: { hostname: c.smtp_host, port, tls: port === 465, auth: { username: c.smtp_from, password: sec.valor } } })
    await client.send({
      from: `${c.smtp_from_nombre || 'Cotiza Go'} <${c.smtp_from}>`, to: [...new Set(para.filter(Boolean))], subject: asunto, content: texto,
      html: `<div style="font-family:sans-serif;font-size:14px;color:#222;white-space:pre-wrap">${esc(texto)}</div>`,
    })
    await client.close()
  } catch (_) { /* el aviso no debe romper la factura */ }
}

/** Aviso a Omar (correo de la plataforma + el suyo), como mucho uno cada `horas`. */
async function avisarOmar(clave: string, horas: number, asunto: string, texto: string) {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  const { count } = await admin.from('notificaciones').select('id', { count: 'exact', head: true })
    .eq('user_id', OMAR).eq('tipo', clave).gte('created_at', desde)
  if ((count ?? 0) > 0) return
  await admin.from('notificaciones').insert({ user_id: OMAR, titulo: asunto, mensaje: texto, tipo: clave, leida: false })
  const { data: o } = await admin.from('profiles').select('email').eq('id', OMAR).maybeSingle()
  const { data: f } = await admin.from('config_plataforma').select('valor').eq('clave', 'smtp_from').maybeSingle()
  await correo([o?.email, f?.valor].filter(Boolean) as string[], asunto, texto)
}

function timbres(balance: any): number | null {
  if (typeof balance === 'number') return balance
  if (!balance || typeof balance !== 'object') return null
  for (const k of ['creditos', 'credits', 'balance', 'disponibles', 'available', 'saldo']) {
    const v = balance[k]
    if (typeof v === 'number') return v
    if (v && typeof v === 'object') { const n = timbres(v); if (n !== null) return n }
  }
  return null
}

async function revisarSaldo() {
  try {
    const { data: em } = await admin.from('facturacion_emisor').select('rfc').eq('activo', true).limit(1).maybeSingle()
    const r = await fetch(`${BASE}/functions/v1/facturacion`, { method: 'POST', headers: jh, body: JSON.stringify({ accion: 'ping', emisor_rfc: em?.rfc }) })
    const d = await r.json().catch(() => ({}))
    const n = timbres(d?.balance)
    if (n !== null && n <= TIMBRES_BAJOS) {
      await avisarOmar('timbres_bajos', 24, `Quedan ${n} timbres en SENHUB`,
        `Quedan ${n} timbres para facturar en CotizaGo.\n\nCompra más en SENHUB para que las facturas automáticas de tus clientes no se detengan.`)
    }
  } catch (_) { /* */ }
}

const sinTimbres = (status: number, d: any) =>
  status === 402 || /INSUFFICIENT_CREDITS|cr[eé]ditos? insuficientes|sin cr[eé]ditos|sin timbres/i.test(JSON.stringify(d ?? ''))

type Resultado = { estado: string, detalle?: string }

/** Crea (o recupera) el facturable del pago, igual que facturar-pago. */
async function facturableDe(pago: any, email: string | null) {
  const { data: ya } = await admin.from('facturables').select('*').eq('pago_id', pago.id).maybeSingle()
  if (ya) return ya
  const total = Number(pago.monto) || 0
  const subtotal = +(total / 1.16).toFixed(2)
  const iva = +(total - subtotal).toFixed(2)
  let desc: string
  if (pago.tipo === 'modulo') {
    const { data: mod } = await admin.from('modulos').select('nombre, periodicidad').eq('clave', pago.paquete_nombre).maybeSingle()
    desc = `Módulo ${mod?.nombre || pago.paquete_nombre || ''}${mod?.periodicidad ? ` · suscripción ${mod.periodicidad}` : ''}`.trim()
  } else {
    desc = `${pago.paquete_nombre ?? 'Suscripción Cotiza Go'}${pago.folios_cantidad ? ` · ${pago.folios_cantidad} folios` : ''}`
  }
  const conceptos = [{ clave_prod_serv: '81112500', clave_unidad: 'E48', descripcion: desc, cantidad: 1, valor_unitario: subtotal, iva_tasa: 0.16 }]
  const { data: nuevo, error } = await admin.from('facturables').insert({
    origen: 'cotizago', referencia_externa: pago.id, workspace_id: pago.workspace_id, pago_id: pago.id, app_id: COTIZAGO_APP,
    cliente_email: email, descripcion: desc, conceptos, subtotal, iva, total, moneda: pago.moneda ?? 'MXN', estado: 'pendiente',
  }).select('*').single()
  if (error) {
    // Carrera con facturar-pago o con otra llamada: el índice único deja uno solo.
    const { data: otro } = await admin.from('facturables').select('*').eq('pago_id', pago.id).maybeSingle()
    if (otro) return otro
    throw new Error(error.message)
  }
  return nuevo
}

async function procesar(pagoId: string): Promise<Resultado> {
  const { data: pago } = await admin.from('pagos').select('*').eq('id', pagoId).maybeSingle()
  if (!pago) return { estado: 'sin_pago' }
  if (pago.estado !== 'aprobado') return { estado: 'no_cobrado' }
  if (!pago.workspace_id || !(Number(pago.monto) > 0)) return { estado: 'sin_monto' }
  if (pago.created_at < DESDE) return { estado: 'anterior' }
  if (String(pago.moneda || 'MXN').toUpperCase() !== 'MXN') return { estado: 'no_mxn' }

  const { data: emp } = await admin.from('empresas').select('pais, rfc, razon_social, regimen_fiscal, codigo_postal, email')
    .eq('workspace_id', pago.workspace_id).maybeSingle()
  const rfc = String(emp?.rfc ?? '').toUpperCase().trim()
  if ((emp?.pais ?? 'MX') !== 'MX') return { estado: 'fuera_de_mexico' }
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(rfc) || !emp?.razon_social?.trim() || !emp?.regimen_fiscal || !/^\d{5}$/.test(String(emp?.codigo_postal ?? '').trim())) {
    return { estado: 'sin_datos_fiscales' }   // se queda el botón manual
  }
  const { data: prof } = pago.user_id ? await admin.from('profiles').select('email').eq('id', pago.user_id).maybeSingle() : { data: null }
  const email = emp.email || prof?.email || null

  const f = await facturableDe(pago, email)
  if (f.estado === 'facturado') return { estado: 'ya_facturado' }
  if (f.estado !== 'pendiente') return { estado: f.estado }

  // Pagos de prueba (Stripe en modo test) o SENHUB en sandbox: nunca CFDI real.
  const { data: cred } = await admin.from('facturacion_credenciales').select('entorno').eq('clave', 'senhub').maybeSingle()
  const sandbox = (cred?.entorno || 'sandbox') !== 'produccion' || pago.metadata?.modo === 'test'
  const receptor = { rfc, nombre: emp.razon_social.trim(), cp: String(emp.codigo_postal).trim(), regimen: emp.regimen_fiscal, email }

  const r = await fetch(`${BASE}/functions/v1/facturacion`, { method: 'POST', headers: jh, body: JSON.stringify({ accion: 'timbrar', facturable_id: f.id, sandbox, receptor, conceptos: f.conceptos }) })
  const d = await r.json().catch(() => ({}))

  if (!r.ok || !d.ok) {
    if (r.status === 409) return { estado: 'en_curso' }   // otra llamada ya lo está timbrando
    const intentos = (f.auto_intentos ?? 0) + 1
    if (sinTimbres(r.status, d)) {
      await admin.from('facturables').update({ auto_estado: 'en_espera_timbres', auto_error: null, auto_intentos: intentos }).eq('id', f.id)
      const { count } = await admin.from('facturables').select('id', { count: 'exact', head: true }).eq('auto_estado', 'en_espera_timbres')
      await avisarOmar('timbres_agotados', 6, 'Se acabaron los timbres de SENHUB',
        `Se acabaron los timbres para facturar en CotizaGo.\n\nHay ${count ?? 1} factura(s) de clientes esperando. Compra más timbres en SENHUB: se generan solas en cuanto haya saldo (se reintenta cada hora).`)
      return { estado: 'en_espera_timbres' }
    }
    const detalle = typeof d.error === 'string' ? d.error : JSON.stringify(d.error ?? d).slice(0, 500)
    await admin.from('facturables').update({ auto_estado: 'error', auto_error: detalle, auto_intentos: intentos }).eq('id', f.id)
    await avisarOmar('factura_auto_error', 6, 'Una factura automática no se pudo generar',
      `No se pudo generar la factura automática de un pago de CotizaGo (${pago.paquete_nombre ?? 'pago'}, $${pago.monto} MXN).\n\nMotivo: ${detalle}\n\nEl cliente puede corregir sus datos en «Mi empresa» y facturar desde «Notas y facturas».`)
    return { estado: 'error', detalle }
  }

  await admin.from('facturables').update({ auto_estado: 'generada', auto_error: null }).eq('id', f.id)
  if (d.uuid) {
    try { await fetch(`${BASE}/functions/v1/facturacion-pdf`, { method: 'POST', headers: jh, body: JSON.stringify({ uuid: d.uuid, app_id: COTIZAGO_APP }) }) } catch { /* */ }
    if (email && !d.sandbox) { try { await fetch(`${BASE}/functions/v1/facturacion-enviar`, { method: 'POST', headers: jh, body: JSON.stringify({ uuid: d.uuid, para: email, app_id: COTIZAGO_APP }) }) } catch { /* */ } }
  }
  if (!d.sandbox) await revisarSaldo()
  return { estado: 'generada', detalle: d.uuid }
}

/** Reintenta los que esperan timbres y los pagos cobrados que se quedaron sin intentar. */
async function reintentar() {
  const out: Record<string, Resultado> = {}
  const { data: espera } = await admin.from('facturables').select('pago_id').eq('auto_estado', 'en_espera_timbres').eq('estado', 'pendiente').not('pago_id', 'is', null).limit(25)
  const ids = new Set((espera ?? []).map((x: any) => x.pago_id))
  // Pagos cobrados sin facturable (p. ej. si el webhook se cortó antes de llamar aquí).
  const { data: pagos } = await admin.from('pagos').select('id').eq('estado', 'aprobado').gte('created_at', DESDE)
    .gt('monto', 0).order('created_at', { ascending: false }).limit(50)
  const pids = (pagos ?? []).map((p: any) => p.id)
  if (pids.length) {
    const { data: conF } = await admin.from('facturables').select('pago_id').in('pago_id', pids)
    const tienen = new Set((conF ?? []).map((x: any) => x.pago_id))
    pids.filter((id) => !tienen.has(id)).forEach((id) => ids.add(id))
  }
  for (const id of ids) {
    out[id] = await procesar(id).catch((e) => ({ estado: 'error', detalle: String(e) }))
    if (out[id].estado === 'en_espera_timbres') break   // sin timbres: no tiene caso seguir
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  if (!(await autorizado(req))) return json({ error: 'No autorizado' }, 401)
  try {
    const input = await req.json().catch(() => ({} as any))
    if (input.accion === 'reintentar') return json({ ok: true, resultados: await reintentar() })
    if (!input.pago_id) return json({ error: 'Falta pago_id' }, 400)
    return json({ ok: true, ...(await procesar(String(input.pago_id))) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
