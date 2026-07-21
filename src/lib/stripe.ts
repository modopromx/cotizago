import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

// La publishable key, el modo y el switch de habilitado se configuran desde el
// panel superadmin (config_plataforma, expuestos vía config_publica). Como
// respaldo, se acepta VITE_STRIPE_PUBLISHABLE_KEY del entorno.
export async function cargarConfigStripe(): Promise<{ pk: string; habilitado: boolean }> {
  const { data } = await supabase.from('config_publica').select('clave,valor')
  const map: Record<string, string> = {}
  ;(data ?? []).forEach((r: any) => { map[r.clave] = r.valor ?? '' })
  const pk = map.stripe_publishable_key || (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) || ''
  const habilitado = map.stripe_habilitado === 'true'
  return { pk, habilitado }
}

let cache: { pk: string; promise: Promise<Stripe | null> } | null = null
export function instanciaStripe(pk: string) {
  if (!cache || cache.pk !== pk) cache = { pk, promise: loadStripe(pk) }
  return cache.promise
}
