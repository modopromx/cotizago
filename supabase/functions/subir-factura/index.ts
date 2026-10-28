// Sube el archivo de una factura/nota (PDF o XML) que el ADMIN emite para el
// usuario. Usa el service_role (bypassa RLS) y verifica que quien llama sea
// administrador. Evita cualquier problema de política de storage desde el
// navegador. El archivo llega en base64 (los CFDI son pequeños).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Verificar que el llamador es administrador.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: u } = await admin.auth.getUser(jwt)
    const uid = u?.user?.id
    if (!uid) return json({ error: 'No autenticado' }, 401)
    const { data: prof } = await admin.from('profiles').select('is_admin').eq('id', uid).maybeSingle()
    if (!prof?.is_admin) return json({ error: 'Solo administradores' }, 403)

    const { solicitud_id, tipo, contentBase64 } = await req.json()
    if (!solicitud_id || !contentBase64 || !['pdf', 'xml'].includes(tipo)) return json({ error: 'Datos incompletos' }, 400)

    const bytes = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0))
    const ext = tipo === 'xml' ? 'xml' : 'pdf'
    const ct = tipo === 'xml' ? 'application/xml' : 'application/pdf'

    const { data: sol } = await admin.from('facturas_solicitudes').select('workspace_id').eq('id', solicitud_id).maybeSingle()
    const ruta = `${sol?.workspace_id ?? 'sin-ws'}/${solicitud_id}.${ext}`

    const { error: upErr } = await admin.storage.from('facturas').upload(ruta, bytes, { upsert: true, contentType: ct })
    if (upErr) return json({ error: upErr.message }, 500)

    const url = admin.storage.from('facturas').getPublicUrl(ruta).data.publicUrl
    const patch = ext === 'xml' ? { archivo_xml_url: url } : { archivo_url: url }
    // Se marca "emitida" cuando ya hay al menos un archivo (PDF o XML).
    await admin.from('facturas_solicitudes').update({ ...patch, estado: 'emitida' }).eq('id', solicitud_id)

    return json({ url })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
