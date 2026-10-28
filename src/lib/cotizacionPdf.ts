// Puente entre la base de datos y el generador de PDF.
// Descarga una cotización (dueño) como PDF, o una nota de remisión.
import { supabase } from './supabase'
import { buildCotizacionPDF, buildNotaRemisionPDF, type EmisorPDF, type NotaRemisionData } from './pdf'
import { descargarPDF } from './descarga'

function empresaToEmisor(emp: any): EmisorPDF {
  return {
    nombre: emp?.nombre_comercial ?? emp?.razon_social,
    empresa: emp?.nombre_comercial ?? emp?.razon_social,
    telefono: emp?.telefono, email_empresa: emp?.email, rfc: emp?.rfc,
    direccion: emp?.direccion, logo_url: emp?.logo_url,
    color_marca: emp?.color_principal, banco: emp?.banco, titular: emp?.titular,
    clabe: emp?.clabe, link_pago: emp?.link_pago,
  }
}

// Descarga el PDF de una cotización que el usuario posee (cualquier estado).
export async function descargarCotizacion(cotId: string) {
  const { data: cot } = await supabase.from('cotizaciones').select('*').eq('id', cotId).single()
  if (!cot) throw new Error('Cotización no encontrada')
  const [{ data: items }, { data: emp }] = await Promise.all([
    supabase.from('cotizacion_items').select('*').eq('cotizacion_id', cotId).order('orden'),
    supabase.from('empresas').select('*').eq('workspace_id', cot.workspace_id).maybeSingle(),
  ])
  const doc = await buildCotizacionPDF({
    emisor: empresaToEmisor(emp),
    cotizacion: cot,
    items: items ?? [],
    publicUrl: `${window.location.origin}/c/${cot.token}`,
  })
  return descargarPDF(doc, `${cot.numero || 'cotizacion'}.pdf`)
}

// Genera y descarga la nota de remisión (documento no fiscal).
export async function descargarNotaRemision(d: NotaRemisionData) {
  const doc = await buildNotaRemisionPDF(d)
  return descargarPDF(doc, `nota-remision-${d.folio}.pdf`)
}
