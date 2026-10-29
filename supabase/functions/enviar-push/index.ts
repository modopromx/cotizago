// Notificaciones de la app de iPhone (APNs).
// (29-oct-2026) El disparador avisar_push_cotizacion llama aquí cuando una
// cotización pasa a vista / aceptada / rechazada. Se avisa a todos los miembros
// del workspace que tengan la app con sesión iniciada (dispositivos_push).
// Los tokens que Apple da por muertos (410, BadDeviceToken) se borran.
//
// Llamadas: SOLO internas. El disparador manda x-cron (token en Vault; aquí se
// compara su sha256 con plataforma_secretos.push_sha256).
// La llave .p8 de Apple va en los secretos de Edge Functions (APNS_KEY_P8,
// APNS_KEY_ID) que pega Omar en el panel de Supabase; sin ella la función
// responde sin enviar nada.
import { createClient } from 'npm:@supabase/supabase-js@2'

const TEAM_ID = 'PF465R3U7U'
const BUNDLE_ID = 'mx.com.cotizago.app'
const APNS = 'https://api.push.apple.com'
const BASE = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(BASE, SERVICE)
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const igual = (a: string, b: string) => {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const sha256 = async (t: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('')

async function secreto(clave: string): Promise<string | null> {
  const { data } = await admin.from('plataforma_secretos').select('valor').eq('clave', clave).maybeSingle()
  return data?.valor ?? null
}

async function autorizado(req: Request): Promise<boolean> {
  if (igual(req.headers.get('x-cg-interna') ?? '', SERVICE)) return true
  const cron = req.headers.get('x-cron') ?? ''
  if (!cron) return false
  const h = await secreto('push_sha256')
  return !!h && igual(await sha256(cron), h)
}

const b64url = (bytes: Uint8Array | string) => {
  const s = typeof bytes === 'string' ? btoa(bytes) : btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// El JWT de APNs vale una hora; Apple pide no renovarlo más de una vez cada 20 min.
let jwtCache: { jwt: string; hecho: number } | null = null

async function jwtApns(p8: string, keyId: string): Promise<string> {
  if (jwtCache && Date.now() - jwtCache.hecho < 40 * 60_000) return jwtCache.jwt
  const der = Uint8Array.from(atob(p8.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const llave = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const cab = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const cuerpo = b64url(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave, new TextEncoder().encode(`${cab}.${cuerpo}`)))
  const jwt = `${cab}.${cuerpo}.${b64url(firma)}`
  jwtCache = { jwt, hecho: Date.now() }
  return jwt
}

function mensaje(estado: string, cliente: string, folio: string) {
  if (estado === 'vista') return { title: 'Cotización vista', body: `${cliente} abrió tu cotización ${folio}` }
  if (estado === 'aceptada') return { title: '🎉 Cotización aceptada', body: `${cliente} aceptó tu cotización ${folio}` }
  return { title: 'Cotización rechazada', body: `${cliente} rechazó tu cotización ${folio}` }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  if (!(await autorizado(req))) return json({ error: 'No autorizado' }, 401)

  const { cotizacion_id, estado } = await req.json().catch(() => ({}))
  if (!cotizacion_id || !['vista', 'aceptada', 'rechazada'].includes(estado)) return json({ error: 'Datos incompletos' }, 400)

  const p8 = Deno.env.get('APNS_KEY_P8') ?? await secreto('apns_key_p8')
  const keyId = Deno.env.get('APNS_KEY_ID') ?? await secreto('apns_key_id')
  if (!p8 || !keyId) return json({ ok: true, enviados: 0, motivo: 'sin llave de APNs' })

  const { data: cot } = await admin.from('cotizaciones')
    .select('workspace_id, numero, cliente_nombre').eq('id', cotizacion_id).maybeSingle()
  if (!cot) return json({ error: 'Cotización no encontrada' }, 404)

  const { data: miembros } = await admin.from('workspace_members').select('user_id').eq('workspace_id', cot.workspace_id)
  const ids = (miembros ?? []).map((m) => m.user_id)
  if (!ids.length) return json({ ok: true, enviados: 0 })
  const { data: tokens } = await admin.from('dispositivos_push').select('token').in('user_id', ids).eq('plataforma', 'ios')
  if (!tokens?.length) return json({ ok: true, enviados: 0 })

  const jwt = await jwtApns(p8, keyId)
  const alerta = mensaje(estado, cot.cliente_nombre || 'Tu cliente', cot.numero || '')
  const carga = JSON.stringify({ aps: { alert: alerta, sound: 'default' }, cotizacion_id })

  let enviados = 0
  const muertos: string[] = []
  await Promise.all(tokens.map(async ({ token }) => {
    const r = await fetch(`${APNS}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: carga,
    }).catch(() => null)
    if (r?.ok) { enviados++; return }
    const motivo = r ? (await r.json().catch(() => ({})))?.reason : null
    if (r?.status === 410 || motivo === 'BadDeviceToken' || motivo === 'Unregistered') muertos.push(token)
    else console.error('APNs', r?.status, motivo)
  }))
  if (muertos.length) await admin.from('dispositivos_push').delete().in('token', muertos)

  return json({ ok: true, enviados, borrados: muertos.length })
})
