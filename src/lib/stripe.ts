import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

// La publishable key, el modo y el switch de habilitado se configuran desde el
// panel superadmin (config_plataforma, expuestos vía config_publica).
export async function cargarConfigStripe(): Promise<{ pk: string; habilitado: boolean; modo: 'test' | 'live' }> {
  const { data } = await supabase.from('config_publica').select('clave,valor')
  const map: Record<string, string> = {}
  ;(data ?? []).forEach((r: any) => { map[r.clave] = r.valor ?? '' })
  // Cada modo tiene su propia llave pública; se usa la del modo activo.
  const modo: 'test' | 'live' = map.stripe_modo === 'live' ? 'live' : 'test'
  const prefijo = modo === 'live' ? 'pk_live_' : 'pk_test_'

  // El respaldo por variable de entorno SOLO aplica si la llave corresponde al
  // modo activo. Antes se aceptaba cualquiera: al pasar a Producción sin haber
  // cargado la llave live, se usaba la de prueba del .env contra la llave
  // secreta de producción, y el cobro fallaba de formas difíciles de explicar.
  // Es preferible quedarse sin llave y que la pantalla diga que falta configurar.
  const delEntorno = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) ?? ''
  const respaldo = delEntorno.startsWith(prefijo) ? delEntorno : ''

  const pk = map[`stripe_${modo}_publishable_key`] || respaldo
  const habilitado = map.stripe_habilitado === 'true'
  return { pk, habilitado, modo }
}

let cache: { pk: string; promise: Promise<Stripe | null> } | null = null
export function instanciaStripe(pk: string) {
  if (!cache || cache.pk !== pk) cache = { pk, promise: loadStripe(pk) }
  return cache.promise
}
