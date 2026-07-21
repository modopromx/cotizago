import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

// La publishable key, el modo y el switch de habilitado se configuran desde el
// panel superadmin (config_plataforma, expuestos vía config_publica). Como
// respaldo, se acepta VITE_STRIPE_PUBLISHABLE_KEY del entorno.
export async function cargarConfigStripe(): Promise<{ pk: string; habilitado: boolean; modo: 'test' | 'live' }> {
  const { data } = await supabase.from('config_publica').select('clave,valor')
  const map: Record<string, string> = {}
  ;(data ?? []).forEach((r: any) => { map[r.clave] = r.valor ?? '' })
  // Cada modo tiene su propia llave pública; se usa la del modo activo.
  const modo: 'test' | 'live' = map.stripe_modo === 'live' ? 'live' : 'test'
  const pk = map[`stripe_${modo}_publishable_key`] || (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) || ''
  const habilitado = map.stripe_habilitado === 'true'
  return { pk, habilitado, modo }
}

let cache: { pk: string; promise: Promise<Stripe | null> } | null = null
export function instanciaStripe(pk: string) {
  if (!cache || cache.pk !== pk) cache = { pk, promise: loadStripe(pk) }
  return cache.promise
}
