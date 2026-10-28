// Respaldo diario de Cotiza Go hacia la computadora de Omar.
// Una tarea programada de Windows (respaldo-cotizago.ps1) llama a esta función
// con la cabecera `x-respaldo` (su huella = plataforma_secretos.respaldo_token_sha256) y guarda:
//  - todas las tablas de `public` (fila por fila, en JSON),
//  - los usuarios de Auth (correo, fechas y metadatos; NUNCA contraseñas),
//  - la lista de archivos de Storage con un enlace firmado de 1 h para bajarlos.
// No incluye llaves ni contraseñas guardadas (plataforma_secretos,
// facturacion_credenciales): se vuelven a sacar de Stripe/SENHUB/etc. si hiciera falta.
import { createClient } from 'npm:@supabase/supabase-js@2'

const EXCLUIDAS = ['plataforma_secretos', 'facturacion_credenciales']
const PAGINA = 1000

function iguales(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}
async function sha256(t: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // En la base solo vive la huella SHA-256 de la llave; la llave en sí está
  // únicamente en la computadora de Omar (Respaldos CotizaGo\llave.txt).
  const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'respaldo_token_sha256').maybeSingle()
  const esperado = sec?.valor ?? ''
  const recibido = await sha256(req.headers.get('x-respaldo') ?? '')
  if (!esperado || !iguales(recibido, esperado)) return json({ error: 'No autorizado' }, 401)

  try {
    // Tablas de public (lista viva: si se agrega una tabla, entra sola).
    const { data: lista, error: eLista } = await admin.rpc('respaldo_tablas')
    if (eLista) throw eLista
    const tablas: Record<string, unknown[]> = {}
    for (const { tabla } of (lista ?? []) as { tabla: string }[]) {
      if (EXCLUIDAS.includes(tabla)) continue
      const filas: unknown[] = []
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await admin.from(tabla).select('*').range(desde, desde + PAGINA - 1)
        if (error) throw new Error(`${tabla}: ${error.message}`)
        filas.push(...(data ?? []))
        if (!data || data.length < PAGINA) break
      }
      tablas[tabla] = filas
    }

    // Usuarios de Auth (sin contraseñas).
    const usuarios: unknown[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      for (const u of data.users) {
        usuarios.push({
          id: u.id, email: u.email, phone: u.phone, created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at,
          user_metadata: u.user_metadata, app_metadata: u.app_metadata,
        })
      }
      if (data.users.length < 1000) break
    }

    // Archivos de Storage con enlace firmado (los descarga el script local).
    const archivos: { bucket: string; ruta: string; tam: number; actualizado: string; url: string }[] = []
    const { data: buckets } = await admin.storage.listBuckets()
    const recorrer = async (bucket: string, carpeta: string) => {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await admin.storage.from(bucket).list(carpeta, { limit: 1000, offset })
        if (error) throw new Error(`storage ${bucket}/${carpeta}: ${error.message}`)
        for (const it of data ?? []) {
          const ruta = carpeta ? `${carpeta}/${it.name}` : it.name
          if (!it.id) { await recorrer(bucket, ruta); continue } // carpeta
          const { data: firmado } = await admin.storage.from(bucket).createSignedUrl(ruta, 3600)
          archivos.push({
            bucket, ruta, tam: Number(it.metadata?.size ?? 0),
            actualizado: it.updated_at ?? '', url: firmado?.signedUrl ?? '',
          })
        }
        if (!data || data.length < 1000) break
      }
    }
    for (const b of buckets ?? []) await recorrer(b.id, '')

    return json({
      generado: new Date().toISOString(),
      proyecto: 'cotizago',
      excluidas: EXCLUIDAS,
      conteos: Object.fromEntries(Object.entries(tablas).map(([k, v]) => [k, v.length])),
      tablas, usuarios, archivos,
    })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
