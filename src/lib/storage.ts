// Convierte un URL público guardado (facturas/soporte) en un URL firmado
// temporal, para que los archivos vivan en buckets privados sin quedar
// expuestos a cualquiera con el enlace. Si el valor no es un URL público
// reconocido, lo devuelve tal cual (compatibilidad hacia atrás).
import { supabase } from './supabase'

export async function urlFirmado(publicUrl: string | null | undefined, expiraSeg = 3600): Promise<string | null> {
  if (!publicUrl) return null
  const m = publicUrl.match(/\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!m) return publicUrl
  const bucket = m[1]
  const path = decodeURIComponent(m[2])
  // Los logos son públicos por diseño (aparecen en cotizaciones públicas).
  if (bucket === 'logos') return publicUrl
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiraSeg)
  return error ? null : (data?.signedUrl ?? null)
}

// Abre un archivo de bucket privado en una pestaña nueva usando un URL firmado.
export async function abrirArchivoPrivado(publicUrl: string | null | undefined) {
  const url = await urlFirmado(publicUrl)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
