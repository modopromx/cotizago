// Campana de alertas del superadmin: muestra solo cotizaciones resueltas
// (aceptadas/aprobadas o rechazadas/canceladas) y enlaza directo a cada una.
// El desplegable va en posición fija porque el header vive dentro de un
// contenedor con overflow-hidden.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDatetime } from '../lib/utils'
import { Bell, CheckCircle2, XCircle } from 'lucide-react'

// aceptada = aprobada · rechazada = cancelada (los estados reales del sistema)
const ESTADOS = ['aceptada', 'rechazada']

export default function NotificacionesAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    const { data } = await supabase
      .from('cotizaciones')
      .select('id,numero,cliente_nombre,total,moneda,estado,token,updated_at')
      .in('estado', ESTADOS)
      .order('updated_at', { ascending: false })
      .limit(15)
    setItems(data ?? [])
  }

  useEffect(() => {
    cargar()
    // Realtime: la campana se actualiza sola cuando una cotización cambia de estado.
    const canal = supabase
      .channel('alertas_cotizaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [open])

  const abrir = (c: any) => {
    setOpen(false)
    if (c.token) window.open(`/c/${c.token}`, '_blank')
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Alertas" aria-haspopup="menu" aria-expanded={open}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-navy-700 hover:bg-slate-100 transition-colors">
        <Bell className="w-5 h-5" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-[66px] right-4 lg:right-8 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-navy-900">Cotizaciones resueltas</p>
            <span className="text-[11px] text-slate-400">aprobadas y canceladas</span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin cotizaciones resueltas aún</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.map(c => {
                const aprobada = c.estado === 'aceptada'
                return (
                  <li key={c.id}>
                    <button onClick={() => abrir(c)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${aprobada ? 'bg-success-50 text-success-600' : 'bg-red-50 text-red-600'}`}>
                        {aprobada ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-navy-900 truncate">{c.numero ?? 'Cotización'}</span>
                          <span className={`text-[11px] font-medium shrink-0 ${aprobada ? 'text-success-600' : 'text-red-600'}`}>
                            {aprobada ? 'Aprobada' : 'Cancelada'}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500 truncate">{c.cliente_nombre || 'Sin cliente'} · {formatCurrency(c.total, c.moneda)}</span>
                        <span className="block text-[11px] text-slate-400">{formatDatetime(c.updated_at)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
