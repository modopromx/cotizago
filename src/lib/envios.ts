import { supabase } from './supabase'
import { formatCurrency, formatDate } from './utils'

// Envía una cotización por email usando la plantilla del sistema.
// El remitente es la plataforma, con reply-to al correo de la empresa emisora,
// para que las respuestas del cliente lleguen directo al usuario.
export async function enviarCotizacionPorEmail(cotId: string, vendedor?: string) {
  const { data: cot } = await supabase.from('cotizaciones').select('*').eq('id', cotId).single()
  if (!cot) throw new Error('Cotización no encontrada')
  if (!cot.cliente_email) throw new Error('Este cliente no tiene correo registrado')

  const { data: emp } = await supabase.from('empresas').select('*').eq('workspace_id', cot.workspace_id).maybeSingle()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión expirada')

  const empresaNombre = emp?.nombre_comercial ?? emp?.razon_social ?? ''
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      clave: 'cotizacion_enviada',
      para: cot.cliente_email,
      reply_to: emp?.email || undefined,
      variables: {
        cliente: cot.cliente_nombre || 'Cliente',
        empresa: empresaNombre,
        folio: cot.numero,
        fecha: formatDate(cot.fecha_emision),
        total: formatCurrency(cot.total, cot.moneda),
        enlace_publico: `${window.location.origin}/c/${cot.token}`,
        vigencia: cot.fecha_vencimiento ? formatDate(cot.fecha_vencimiento) : 'Sin vencimiento',
        empresa_telefono: emp?.telefono ?? '',
        empresa_email: emp?.email ?? '',
        vendedor: vendedor ?? '',
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo enviar el correo')
  return data
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
      body: JSON.stringify({
        clave, para: email,
        variables: {
          nombre: nombre ?? '',
          folios_restantes: String(saldo),
          link_recarga: `${window.location.origin}/app/folios`,
        },
      }),
    })
  } catch { /* silencioso */ }
}
