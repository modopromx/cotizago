// Campana de alertas del superadmin. SOLO alertas administrativas:
//  - Nuevos registros (cuentas nuevas en la plataforma)
//  - Pagos recibidos (paquetes de folios acreditados)
//  - Módulos/servicios contratados
//  - Solicitudes de factura
// NO muestra cotizaciones de los clientes (eso es actividad interna de cada
// usuario, no algo que el superadmin deba vigilar).
// El desplegable va en posición fija porque el header vive dentro de un
// contenedor con overflow-hidden.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDatetime } from '../lib/utils'
import { Bell, UserPlus, CreditCard, Blocks, FileText } from 'lucide-react'

type Alerta = {
  id: string
  tipo: 'registro' | 'pago' | 'modulo' | 'factura'
  titulo: string
  detalle: string
  fecha: string
  link: string
}

const MODULO_LABEL: Record<string, string> = {
  whatsapp_propio: 'WhatsApp propio', email_profesional: 'Email profesional',
  pagos_linea: 'Pagos en línea', api_webhooks: 'API y webhooks',
}

export default function NotificacionesAdmin() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Alerta[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const cargar = async () => {
    const [regs, pagos, mods, facturas] = await Promise.all([
      supabase.from('profiles').select('id,nombre,email,empresa,created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('pagos').select('id,paquete_nombre,monto,moneda,created_at').or('acreditado.eq.true,estado.eq.aprobado').order('created_at', { ascending: false }).limit(10),
      supabase.from('modulo_suscripciones').select('id,clave,monto,created_at,estado').eq('estado', 'activa').order('created_at', { ascending: false }).limit(10),
      supabase.from('facturas_solicitudes').select('id,razon_social,rfc,monto,moneda,created_at').order('created_at', { ascending: false }).limit(10),
    ])

    const alertas: Alerta[] = [
      ...(regs.data ?? []).map((r: any): Alerta => ({
        id: 'reg-' + r.id, tipo: 'registro',
        titulo: r.empresa || r.nombre || r.email || 'Nuevo registro',
        detalle: 'Nueva cuenta registrada' + (r.email ? ` · ${r.email}` : ''),
        fecha: r.created_at, link: '/admin/usuarios',
      })),
      ...(pagos.data ?? []).map((p: any): Alerta => ({
        id: 'pago-' + p.id, tipo: 'pago',
        titulo: 'Pago recibido',
        detalle: `${p.paquete_nombre ?? 'Paquete'} · ${formatCurrency(p.monto, p.moneda)}`,
        fecha: p.created_at, link: '/admin/pagos',
      })),
      ...(mods.data ?? []).map((m: any): Alerta => ({
        id: 'mod-' + m.id, tipo: 'modulo',
        titulo: 'Módulo contratado',
        detalle: (MODULO_LABEL[m.clave] ?? m.clave) + (m.monto ? ` · ${formatCurrency(m.monto)}` : ''),
        fecha: m.created_at, link: '/admin/modulos',
      })),
      ...(facturas.data ?? []).map((f: any): Alerta => ({
        id: 'fac-' + f.id, tipo: 'factura',
        titulo: 'Solicitud de factura',
        detalle: `${f.razon_social || f.rfc || 'Sin datos'} · ${formatCurrency(f.monto, f.moneda)}`,
        fecha: f.created_at, link: '/admin/pagos',
      })),
    ]

    alertas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    setItems(alertas.slice(0, 15))
  }

  useEffect(() => {
    cargar()
    // Realtime: la campana se actualiza sola cuando ocurre cualquiera de los
    // eventos administrativos que vigila.
    const canal = supabase
      .channel('alertas_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modulo_suscripciones' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas_solicitudes' }, cargar)
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

  const abrir = (a: Alerta) => { setOpen(false); navigate(a.link) }

  const ICONO = {
    registro: { Icon: UserPlus, clase: 'bg-primary-50 text-primary-700' },
    pago: { Icon: CreditCard, clase: 'bg-success-50 text-success-700' },
    modulo: { Icon: Blocks, clase: 'bg-azul-50 text-azul-600' },
    factura: { Icon: FileText, clase: 'bg-amber-50 text-amber-700' },
  } as const

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
            <p className="text-sm font-semibold text-navy-900">Alertas administrativas</p>
            <span className="text-[11px] text-slate-500">registros, pagos y facturas</span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin alertas por ahora</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.map(a => {
                const { Icon, clase } = ICONO[a.tipo]
                return (
                  <li key={a.id}>
                    <button onClick={() => abrir(a)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${clase}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-navy-900 truncate">{a.titulo}</span>
                        <span className="block text-xs text-slate-500 truncate">{a.detalle}</span>
                        <span className="block text-[11px] text-slate-500">{formatDatetime(a.fecha)}</span>
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
