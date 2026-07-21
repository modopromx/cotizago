import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDatetime } from '../../lib/utils'
import { ScrollText, RefreshCw, CreditCard, Mail, MessageCircle, Blocks, AlertTriangle, FileText } from 'lucide-react'

// La auditoría se arma con los hechos que la plataforma REALMENTE registra.
// (La tabla logs_sistema existe pero nadie escribe en ella; si algún día se
// empieza a usar, sus filas aparecen aquí junto al resto.)
type Evento = {
  id: string
  fecha: string
  tipo: 'pago' | 'modulo' | 'email' | 'whatsapp' | 'cotizacion' | 'sistema'
  titulo: string
  detalle?: string
  nivel: 'ok' | 'aviso' | 'error'
}

const META: Record<Evento['tipo'], { icono: any; etiqueta: string }> = {
  pago:       { icono: CreditCard,    etiqueta: 'Pago' },
  modulo:     { icono: Blocks,        etiqueta: 'Módulo' },
  email:      { icono: Mail,          etiqueta: 'Email' },
  whatsapp:   { icono: MessageCircle, etiqueta: 'WhatsApp' },
  cotizacion: { icono: FileText,      etiqueta: 'Cotización' },
  sistema:    { icono: ScrollText,    etiqueta: 'Sistema' },
}

const COLOR_NIVEL: Record<Evento['nivel'], string> = {
  ok: 'bg-success-50 text-success-600',
  aviso: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
}

export default function AdminLogsPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | Evento['tipo']>('todos')

  const load = async () => {
    setLoading(true)
    const [pagos, mods, emails, wa, cots, logs] = await Promise.all([
      supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('modulo_suscripciones').select('*').order('fecha_contratacion', { ascending: false }).limit(60),
      supabase.from('email_envios').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('walinker_eventos').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('cotizaciones').select('id,numero,total,estado,created_at').order('created_at', { ascending: false }).limit(60),
      supabase.from('logs_sistema').select('*').order('created_at', { ascending: false }).limit(60),
    ])

    const out: Evento[] = []

    ;(pagos.data ?? []).forEach((p: any) => out.push({
      id: `pago-${p.id}`,
      fecha: p.created_at,
      tipo: 'pago',
      titulo: p.tipo === 'modulo'
        ? `Cobro de módulo · ${p.paquete_nombre ?? ''}`
        : `Compra de folios · ${p.paquete_nombre ?? ''}`,
      detalle: `${formatCurrency(p.monto, p.moneda)}${p.folios_cantidad ? ` · ${p.folios_cantidad} folios` : ''} · ${p.estado}`,
      nivel: p.estado === 'pendiente' ? 'aviso' : 'ok',
    }))

    ;(mods.data ?? []).forEach((m: any) => out.push({
      id: `mod-${m.id}`,
      fecha: m.fecha_contratacion ?? m.created_at,
      tipo: 'modulo',
      titulo: `Módulo ${m.clave} · ${m.estado}`,
      detalle: m.cancelar_al_terminar
        ? 'Programado para cancelarse al terminar el periodo'
        : m.periodo_fin ? `Renueva ${formatDatetime(m.periodo_fin)}` : undefined,
      nivel: m.estado === 'morosa' ? 'error' : m.estado === 'cancelada' ? 'aviso' : 'ok',
    }))

    ;(emails.data ?? []).forEach((e: any) => out.push({
      id: `mail-${e.id}`,
      fecha: e.created_at,
      tipo: 'email',
      titulo: e.asunto || 'Correo enviado',
      detalle: e.destinatario,
      nivel: e.estado === 'fallido' ? 'error' : 'ok',
    }))

    ;(wa.data ?? []).forEach((w: any) => out.push({
      id: `wa-${w.id}`,
      fecha: w.created_at,
      tipo: 'whatsapp',
      titulo: `Walinker · ${w.evento}`,
      detalle: w.url ?? w.referencia ?? undefined,
      nivel: w.evento === 'link.error' ? 'error' : 'ok',
    }))

    ;(cots.data ?? []).forEach((c: any) => out.push({
      id: `cot-${c.id}`,
      fecha: c.created_at,
      tipo: 'cotizacion',
      titulo: `Cotización ${c.numero ?? ''} · ${c.estado ?? ''}`,
      detalle: formatCurrency(c.total),
      nivel: 'ok',
    }))

    ;(logs.data ?? []).forEach((l: any) => out.push({
      id: `log-${l.id}`,
      fecha: l.created_at,
      tipo: 'sistema',
      titulo: l.mensaje,
      detalle: l.fuente ?? undefined,
      nivel: l.nivel === 'error' ? 'error' : l.nivel === 'warn' ? 'aviso' : 'ok',
    }))

    out.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    setEventos(out.slice(0, 200))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visibles = useMemo(
    () => filtro === 'todos' ? eventos : eventos.filter(e => e.tipo === filtro),
    [eventos, filtro],
  )
  const errores = eventos.filter(e => e.nivel === 'error').length

  const filtros: Array<{ k: 'todos' | Evento['tipo']; label: string }> = [
    { k: 'todos', label: 'Todo' },
    { k: 'pago', label: 'Pagos' },
    { k: 'modulo', label: 'Módulos' },
    { k: 'cotizacion', label: 'Cotizaciones' },
    { k: 'email', label: 'Email' },
    { k: 'whatsapp', label: 'WhatsApp' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Auditoría</h1>
          <p className="text-slate-500 text-sm">
            Actividad de la plataforma: pagos, módulos, cotizaciones y envíos.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {errores > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4" /> {errores} con error
            </span>
          )}
          <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Actualizar</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtros.map(f => (
          <button key={f.k} onClick={() => setFiltro(f.k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === f.k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">Sin actividad registrada</p>
          <p className="text-sm text-slate-400 mt-1">
            {eventos.length === 0
              ? 'Aquí aparecerán los pagos, módulos, cotizaciones y envíos conforme ocurran.'
              : 'No hay eventos de ese tipo todavía.'}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {visibles.map(e => {
            const { icono: Icon, etiqueta } = META[e.tipo]
            return (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                <span className="w-8 h-8 rounded-lg bg-fondo flex items-center justify-center text-navy-700 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-900 truncate">{e.titulo}</p>
                  {e.detalle && <p className="text-xs text-slate-400 truncate">{e.detalle}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`badge ${COLOR_NIVEL[e.nivel]}`}>{etiqueta}</span>
                  <span className="text-xs text-slate-400 tabular-nums hidden sm:block">{formatDatetime(e.fecha)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
