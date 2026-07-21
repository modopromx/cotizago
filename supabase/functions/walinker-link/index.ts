// Genera un link de WhatsApp de marca via Walinker (walinker.pro) para enviar
// una cotizacion. Si Walinker no esta configurado o falla, devuelve el wa.me
// directo: el envio de una cotizacion nunca se bloquea por la integracion.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Mismo slugify que usa Walinker, para que el slug que pedimos llegue intacto.
const slugify = (s) => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { telefono, mensaje, referencia, cotizacion_id } = await req.json()
    const digitos = String(telefono ?? '').replace(/\D/g, '')
    if (digitos.length < 10) return json({ error: 'Telefono sin codigo de pais' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: cfgRows } = await admin.from('config_plataforma').select('clave,valor')
    const cfg = {}
    ;(cfgRows ?? []).forEach((r) => { cfg[r.clave] = r.valor ?? '' })

    const { data: sec } = await admin.from('plataforma_secretos').select('valor').eq('clave', 'walinker_api_key').maybeSingle()
    const apiKey = (sec && sec.valor) || Deno.env.get('WALINKER_API_KEY') || ''

    const waDirecto = `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`

    // Sin API key o deshabilitado: se usa el wa.me directo (siempre funciona).
    if (!apiKey || cfg.walinker_habilitado !== 'true') {
      return json({ url: waDirecto, whatsapp_url: waDirecto, fuente: 'wa.me' })
    }

    const { data: prof } = await admin.from('profiles').select('workspace_id').eq('id', user.id).single()
    const ws = prof?.workspace_id ?? null

    // Nombre de la empresa: da identidad al link de marca (walinker.pro/mi-empresa-cot-001)
    // y se manda como external_user_name para que la cuenta se vea con su nombre
    // real en el panel de Walinker, en vez de un UUID.
    let empresa = ''
    if (ws) {
      const { data: emp } = await admin.from('empresas')
        .select('nombre_comercial,razon_social').eq('workspace_id', ws).maybeSingle()
      empresa = emp?.nombre_comercial || emp?.razon_social || ''
    }
    const marca = slugify(empresa)

    // Walinker separa codigo de pais y numero. Se prueban los prefijos comunes.
    const dials = ['593','502','503','504','505','506','507','591','595','598','52','54','55','56','57','58','51','34','1']
    const cc = dials.find(d => digitos.startsWith(d)) ?? '52'
    const phone = digitos.slice(cc.length)

    // El slug pedido solo se respeta si esta libre; por eso lleva el folio, que
    // ya es unico por cotizacion. Sin folio, Walinker asigna uno aleatorio.
    const slugDeseado = marca && referencia ? slugify(`${marca}-${referencia}`) : marca

    const base = cfg.walinker_base_url || 'https://walinker.pro'
    const res = await fetch(`${base}/api/public/v1/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        phone, country_code: cc,
        message: String(mensaje ?? '').slice(0, 500),
        type: cfg.walinker_tipo_link === 'short' ? 'short' : 'brand',
        slug: slugDeseado || undefined,
        // Estable por empresa: da de alta la cuenta la primera vez y la reutiliza
        // despues, para que cada cliente tenga sus propias estadisticas y cuotas.
        external_user_id: ws ?? user.id,
        external_user_name: empresa || undefined,
        external_workspace_id: ws,
        external_reference: referencia ?? null,
        auto_provision: true,
        metadata: { origen: 'cotizago', empresa, cotizacion_id: cotizacion_id ?? null },
      }),
    })
    const out = await res.json().catch(() => ({}))

    // Si Walinker falla (cuota, rate limit, key mala) no bloqueamos el envio.
    if (!res.ok || !out?.url) {
      return json({ url: waDirecto, whatsapp_url: waDirecto, fuente: 'wa.me', aviso: out?.error ?? 'Walinker no disponible' })
    }

    if (cotizacion_id) {
      await admin.from('cotizaciones').update({ wa_link: out.url }).eq('id', cotizacion_id)
    }

    return json({ url: out.url, whatsapp_url: out.whatsapp_url ?? waDirecto, slug: out.slug, fuente: 'walinker', reused: out.reused })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
