// Avisos en tiempo real para el vendedor: cuando su cliente ABRE, ACEPTA o
// RECHAZA una cotización desde el enlace público, aparece un toast en el panel.
// Se apoya en Supabase Realtime sobre la tabla cotizaciones (filtrada por
// workspace). Deduplica por (id + estado) para no repetir el aviso en la sesión.
import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AvisosCliente() {
  const { profile } = useAuth()
  const ws = profile?.workspace_id
  const vistos = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!ws) return
    const canal = supabase
      .channel('avisos-cotizaciones-' + ws)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cotizaciones', filter: `workspace_id=eq.${ws}` },
        (payload) => {
          const c: any = payload.new
          if (!c || !['vista', 'aceptada', 'rechazada'].includes(c.estado)) return
          const clave = `${c.id}:${c.estado}`
          if (vistos.current.has(clave)) return
          vistos.current.add(clave)

          const cliente = c.cliente_nombre || 'Tu cliente'
          const folio = c.numero || ''
          if (c.estado === 'vista') {
            toast(`👀 ${cliente} abrió la cotización ${folio}`, { icon: '👀', duration: 6000 })
          } else if (c.estado === 'aceptada') {
            toast.success(`🎉 ${cliente} aceptó la cotización ${folio}`, { duration: 8000 })
          } else {
            toast(`${cliente} rechazó la cotización ${folio}`, { icon: '❌', duration: 7000 })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [ws])

  return null
}
