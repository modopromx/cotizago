// Prueba la conexión de un módulo ANTES (o después) de guardarlo, desde Módulos.
// (29-oct-2026) Pedido de Omar: un botón para ver que cada módulo funciona.
//  - pagos: la llave secreta de Stripe contra /v1/balance, que la llave pública
//    sea del mismo modo (live/test) y que el enlace de pago abra.
//  - whatsapp: «web» valida el número y devuelve el enlace wa.me para abrirlo;
//    «cloud» consulta el número en Meta (Graph API) sin mandar mensajes.
// El correo se prueba en enviar-email (clave 'prueba_correo'), que manda un
// correo real al propio usuario con el diseño de la cotización.
// Si la llave viene vacía se usa la ya guardada de la cuenta del usuario.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type Paso = { ok: boolean; texto: string }

async function guardado(ws: string, tipo: string): Promise<string> {
  const { data } = await admin.from('integraciones').select('secreto').eq('workspace_id', ws).eq('tipo', tipo).maybeSingle()
  return data?.secreto ?? ''
}

async function probarEnlace(url: string): Promise<Paso> {
  let u: URL
  try { u = new URL(url) } catch { return { ok: false, texto: 'El enlace de pago no es una dirección válida.' } }
  if (u.protocol !== 'https:') return { ok: false, texto: 'El enlace de pago debe empezar con https://' }
  try {
    const r = await fetch(u.toString(), { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 CotizaGo' } })
    await r.body?.cancel()
    return r.status < 400
      ? { ok: true, texto: `El enlace de pago abre bien (${u.hostname}).` }
      : { ok: false, texto: `El enlace de pago responde con error ${r.status}. Revisa que siga activo.` }
  } catch { return { ok: false, texto: 'El enlace de pago no respondió. Revisa que esté bien copiado.' } }
}

async function probarPagos(ws: string, cfg: any, secretoForm: string): Promise<Paso[]> {
  const pasos: Paso[] = []
  const pk = String(cfg.publishable_key ?? '').trim()
  const sk = String(secretoForm || await guardado(ws, 'pagos')).trim()
  const link = String(cfg.link_pago ?? '').trim()
  if (!sk && !link) return [{ ok: false, texto: 'Escribe tus llaves de Stripe o un enlace de pago.' }]
  if (sk) {
    if (!/^(sk|rk)_(live|test)_/.test(sk)) pasos.push({ ok: false, texto: 'La llave secreta debe empezar con sk_live_ (o sk_test_ para pruebas).' })
    else {
      try {
        const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(10000) })
        const d = await r.json().catch(() => ({}))
        if (r.ok) {
          const prueba = sk.includes('_test_')
          pasos.push({ ok: true, texto: prueba ? 'Stripe acepta tu llave, pero es de PRUEBA: tus clientes no podrán pagar de verdad. Usa la llave sk_live_.' : 'Stripe acepta tu llave secreta (modo real).' })
          if (prueba) pasos[pasos.length - 1].ok = false
        } else if (r.status === 401) pasos.push({ ok: false, texto: 'Stripe rechazó la llave secreta. Cópiala de nuevo desde tu panel de Stripe.' })
        else pasos.push({ ok: false, texto: `Stripe respondió: ${d?.error?.message ?? r.status}` })
      } catch { pasos.push({ ok: false, texto: 'No se pudo conectar con Stripe. Intenta de nuevo.' }) }
    }
    if (pk) {
      const modoPk = /^pk_live_/.test(pk) ? 'live' : /^pk_test_/.test(pk) ? 'test' : ''
      const modoSk = sk.includes('_live_') ? 'live' : 'test'
      if (!modoPk) pasos.push({ ok: false, texto: 'La llave pública debe empezar con pk_live_.' })
      else if (modoPk !== modoSk) pasos.push({ ok: false, texto: 'La llave pública y la secreta son de modos distintos (una real y otra de prueba).' })
      else pasos.push({ ok: true, texto: 'La llave pública corresponde a la secreta.' })
    } else pasos.push({ ok: false, texto: 'Falta la llave pública (pk_live_...).' })
  }
  if (link) pasos.push(await probarEnlace(link))
  return pasos
}

async function probarWhatsapp(ws: string, cfg: any, secretoForm: string): Promise<{ pasos: Paso[]; enlace?: string }> {
  const digitos = String(cfg.numero ?? '').replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 15) return { pasos: [{ ok: false, texto: 'Escribe tu número de WhatsApp con lada de país.' }] }
  const enlace = `https://wa.me/${digitos}`
  if ((cfg.metodo ?? 'web') !== 'cloud') {
    return { pasos: [{ ok: true, texto: `Tus clientes te escribirán a +${digitos}. Abre el enlace para comprobar que es tu WhatsApp.` }], enlace }
  }
  const phoneId = String(cfg.phone_id ?? '').trim()
  const token = String(secretoForm || await guardado(ws, 'whatsapp')).trim()
  if (!/^\d{6,}$/.test(phoneId)) return { pasos: [{ ok: false, texto: 'Escribe el Phone Number ID (solo números) de tu app de Meta.' }] }
  if (!token) return { pasos: [{ ok: false, texto: 'Escribe el token de acceso de Meta.' }] }
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = String(d?.error?.message ?? '')
      if (r.status === 401 || /token/i.test(msg)) return { pasos: [{ ok: false, texto: 'Meta rechazó el token de acceso (vencido o incorrecto). Genera uno permanente.' }] }
      return { pasos: [{ ok: false, texto: `Meta no encontró ese número: ${msg || r.status}. Revisa el Phone Number ID.` }] }
    }
    const pasos: Paso[] = [{ ok: true, texto: `Conectado a Meta: ${d.verified_name ?? 'tu negocio'} (${d.display_phone_number ?? ''}).` }]
    const delMeta = String(d.display_phone_number ?? '').replace(/\D/g, '')
    if (delMeta && !delMeta.endsWith(digitos.slice(-10))) pasos.push({ ok: false, texto: `El número de Meta (${d.display_phone_number}) no coincide con el que escribiste.` })
    return { pasos, enlace }
  } catch { return { pasos: [{ ok: false, texto: 'No se pudo conectar con Meta. Intenta de nuevo.' }] } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405)
  try {
    const uc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await uc.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)
    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).maybeSingle()
    const ws = prof?.workspace_id
    if (!ws) return json({ error: 'Sin cuenta' }, 400)

    const body = await req.json().catch(() => ({} as any))
    const cfg = body.config ?? {}
    const secreto = String(body.secreto ?? '')
    if (body.tipo === 'pagos') {
      const pasos = await probarPagos(ws, cfg, secreto)
      return json({ ok: pasos.every((p) => p.ok), pasos })
    }
    if (body.tipo === 'whatsapp') {
      const { pasos, enlace } = await probarWhatsapp(ws, cfg, secreto)
      return json({ ok: pasos.every((p) => p.ok), pasos, enlace })
    }
    return json({ error: 'Módulo no válido' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
