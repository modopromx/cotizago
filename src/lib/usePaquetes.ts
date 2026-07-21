import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Paquetes de fallback si aún no hay datos (o mientras carga).
export const PAQUETES_FALLBACK = [
  { id: 'f1', nombre: 'Emprende', folios: 25, precio: 199, moneda: 'MXN', popular: false, orden: 1, descripcion: 'Para comenzar a cotizar', beneficios: ['PDFs personalizados', 'WhatsApp y email', 'Sin fecha de caducidad'] },
  { id: 'f2', nombre: 'Negocio', folios: 100, precio: 499, moneda: 'MXN', popular: true, orden: 2, descripcion: 'Para ventas constantes', beneficios: ['Todo lo de Emprende', 'Ahorra por cotización', 'Soporte prioritario'] },
  { id: 'f3', nombre: 'Pro', folios: 300, precio: 999, moneda: 'MXN', popular: false, orden: 3, descripcion: 'Para equipos de alto volumen', beneficios: ['Todo lo de Negocio', 'Mejor precio por folio', 'Uso multiusuario'] },
]

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
