import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Paquetes de fallback si aún no hay datos (o mientras carga).
export const PAQUETES_FALLBACK = [
  { id: 'f1', nombre: 'Emprende', folios: 30, precio: 12.99, moneda: 'USD', precios: { MXN: 249, USD: 12.99, BRL: 69.90, EUR: 11.99 }, popular: false, orden: 1, descripcion: 'Para comenzar a cotizar', beneficios: ['PDFs personalizados', 'WhatsApp y email', 'Sin fecha de caducidad'] },
  { id: 'f2', nombre: 'Negocio', folios: 100, precio: 24.99, moneda: 'USD', precios: { MXN: 479, USD: 24.99, BRL: 129.90, EUR: 22.99 }, popular: true, orden: 2, descripcion: 'Para ventas constantes', beneficios: ['Todo lo de Emprende', 'Ahorra por cotización', 'Soporte prioritario'] },
  { id: 'f3', nombre: 'Pro', folios: 300, precio: 49.99, moneda: 'USD', precios: { MXN: 949, USD: 49.99, BRL: 259.90, EUR: 45.99 }, popular: false, orden: 3, descripcion: 'Para equipos de alto volumen', beneficios: ['Todo lo de Negocio', 'Mejor precio por folio', 'Uso multiusuario'] },
  { id: 'f4', nombre: 'Empresa', folios: 1000, precio: 99.99, moneda: 'USD', precios: { MXN: 1899, USD: 99.99, BRL: 499.90, EUR: 91.99 }, popular: false, orden: 4, descripcion: 'Para máximo volumen', beneficios: ['Todo lo de Pro', 'El mejor precio por cotización', 'Uso multiusuario', 'Soporte prioritario'] },
]

// Moneda que se muestra y se cobra según el idioma activo.
export const MONEDA_POR_IDIOMA: Record<string, string> = { es: 'MXN', en: 'USD', pt: 'BRL', fr: 'EUR' }
export const SIMBOLO_MONEDA: Record<string, string> = { MXN: '$', USD: '$', BRL: 'R$', EUR: '€' }

// Devuelve el precio y la moneda del paquete para el idioma dado (con respaldo).
export function precioDe(p: any, lang: string): { precio: number; moneda: string } {
  const moneda = MONEDA_POR_IDIOMA[lang] ?? 'USD'
  const val = p?.precios?.[moneda]
  if (val != null) return { precio: Number(val), moneda }
  return { precio: Number(p?.precio ?? 0), moneda: p?.moneda ?? 'USD' }
}

// Formatea un número: entero sin decimales, o con 2 decimales.
export function fmtPrecio(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// Trae los paquetes activos y se re-actualiza en vivo cuando el admin los cambia.
export function usePaquetes() {
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = () =>
    supabase.from('paquetes_folios').select('*').eq('activo', true).order('orden')
      .then(({ data }) => { setPaquetes(data && data.length ? data : PAQUETES_FALLBACK); setLoading(false) })

  useEffect(() => {
    fetch()
    // Suscripción realtime: cualquier alta/cambio/baja de paquetes refresca la lista.
    const canal = supabase
      .channel('paquetes_folios_cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paquetes_folios' }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  return { paquetes, loading }
}
