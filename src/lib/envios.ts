import { supabase } from './supabase'

// Envía una cotización por email usando la plantilla del sistema.
// El servidor arma destinatario y datos a partir de la cotización (ya no se
// aceptan desde el navegador); el reply-to es el correo de la empresa emisora.
export async function enviarCotizacionPorEmail(cotId: string) {
  const { data: cot } = await supabase.from('cotizaciones').select('cliente_email').eq('id', cotId).single()
  if (!cot) throw new Error('Cotización no encontrada')
  if (!cot.cliente_email) throw new Error('Este cliente no tiene correo registrado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión expirada')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ clave: 'cotizacion_enviada', cotizacion_id: cotId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo enviar el correo')
  return data
}

// Genera el link de WhatsApp para una cotización. Si el admin conectó Walinker,
// devuelve un link corto de marca (walinker.pro/xxx); si no, el wa.me directo.
export async function generarLinkWhatsApp(opts: {
  telefono?: string; mensaje: string; referencia?: string; cotizacionId?: string
}): Promise<{ url: string; fuente: string; aviso?: string }> {
  const digitos = (opts.telefono ?? '').replace(/\D/g, '')
  const waDirecto = `https://wa.me/${digitos.length >= 10 ? digitos : ''}?text=${encodeURIComponent(opts.mensaje)}`
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || digitos.length < 10) return { url: waDirecto, fuente: 'wa.me' }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/walinker-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        telefono: digitos, mensaje: opts.mensaje,
        referencia: opts.referencia, cotizacion_id: opts.cotizacionId,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) return { url: waDirecto, fuente: 'wa.me' }
    // Walinker devuelve el link de marca; se abre el whatsapp_url para chatear ya.
    return { url: data.whatsapp_url || data.url, fuente: data.fuente ?? 'walinker', aviso: data.aviso }
  } catch {
    return { url: waDirecto, fuente: 'wa.me' }
  }
}

// Avisa al usuario cuando su saldo de folios queda bajo o se agota.
// Es "dispara y olvida": nunca debe interrumpir el flujo de la cotización.
export async function avisarSaldoFolios(saldo: number, email?: string, nombre?: string) {
  if (!email) return
  const clave = saldo <= 0 ? 'folios_terminados' : saldo <= 3 ? 'recordatorio_recarga' : null
  if (!clave) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ clave }),
    })
  } catch { /* silencioso */ }
}
