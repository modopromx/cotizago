import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import {
  CheckCircle2, Clock, XCircle, DollarSign, Plus, FileText,
  Download, MessageCircle, Link2, Mail,
} from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const ESTADO_BADGE: Record<string, string> = {
  aceptada: 'bg-success-50 text-success-600',
  rechazada: 'bg-red-50 text-red-600',
  enviada: 'bg-azul-50 text-azul-600',
  vista: 'bg-primary-50 text-primary-600',
  pendiente: 'bg-amber-50 text-amber-600',
  borrador: 'bg-slate-100 text-slate-500',
  vencida: 'bg-slate-100 text-slate-500',
  cancelada: 'bg-slate-100 text-slate-500',
}
const ESTADO_LABEL: Record<string, string> = {
  aceptada: 'Aceptada', rechazada: 'Rechazada', enviada: 'Enviada', vista: 'Vista',
  pendiente: 'Pendiente', borrador: 'Borrador', vencida: 'Vencida', cancelada: 'Cancelada',
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cotis, setCotis] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    supabase.from('cotizaciones')
      .select('id,numero,total,estado,created_at,cliente_nombre')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCotis(data ?? []); setLoading(false) })
  }, [user])

  // Métricas
  const esPendiente = (e: string) => ['enviada', 'vista', 'pendiente'].includes(e)
  const aceptadas = cotis.filter(c => c.estado === 'aceptada')
  const pendientes = cotis.filter(c => esPendiente(c.estado))
  const rechazadas = cotis.filter(c => c.estado === 'rechazada')
  const respondidas = aceptadas.length + rechazadas.length
  const valorAceptado = aceptadas.reduce((s, c) => s + (Number(c.total) || 0), 0)
  const totalConEstado = aceptadas.length + pendientes.length + rechazadas.length
  const tasaAceptacion = respondidas ? Math.round((aceptadas.length / respondidas) * 100) : 0
  const pctRechazo = totalConEstado ? ((rechazadas.length / totalConEstado) * 100).toFixed(1) : '0'

  // Gráfica: aceptadas por mes (últimos 6 meses)
  const ahora = new Date()
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MESES[d.getMonth()], value: 0 }
  })
  aceptadas.forEach(c => {
    const d = new Date(c.created_at)
    const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.value += 1
  })
  const hayDatosGrafica = buckets.some(b => b.value > 0)

  const kpis = [
    { label: 'Aceptadas', value: aceptadas.length, icon: CheckCircle2, color: 'text-success-600', bg: 'bg-success-50', sub: `${tasaAceptacion}% de aceptación` },
    { label: 'Pendientes', value: pendientes.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'Requieren seguimiento' },
    { label: 'Rechazadas', value: rechazadas.length, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', sub: `${pctRechazo}% del total` },
    { label: 'Valor aceptado', value: formatCurrency(valorAceptado), icon: DollarSign, color: 'text-primary-600', bg: 'bg-primary-50', sub: 'Cotizaciones ganadas' },
  ]

  const canales = [
    { icon: Download, title: 'Descargar PDF', desc: 'Documento listo para enviar' },
    { icon: MessageCircle, title: 'Enviar por WhatsApp', desc: 'Usa tu número conectado' },
    { icon: Link2, title: 'Copiar enlace público', desc: 'Con aceptar o rechazar' },
    { icon: Mail, title: 'Enviar por email', desc: 'Usa tu plantilla activa' },
  ]

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Rendimiento de cotizaciones</h1>
          <p className="text-slate-500 text-sm mt-0.5">Analiza respuestas y da seguimiento a cada oportunidad.</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-navy"><Plus className="w-4 h-4" /> Nueva cotización</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-5">
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <p className="text-2xl font-extrabold text-navy-900">{loading ? '—' : k.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-slate-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfica + anillo */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-navy-900">Aceptación de cotizaciones</h2>
            <span className="text-xs text-slate-400">Últimos 6 meses</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Comportamiento de cotizaciones aceptadas</p>
          {hayDatosGrafica ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={buckets} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {buckets.map((_, i) => <Cell key={i} fill={i === buckets.length - 1 ? '#08AEB6' : '#c3f1f2'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-navy-900">Estado de respuestas</h2>
          <p className="text-xs text-slate-400 mb-4">{totalConEstado} cotizaciones registradas</p>
          <div className="flex justify-center my-4">
            <Ring pct={tasaAceptacion} />
          </div>
          <div className="space-y-2">
            {[
              ['Aceptadas', aceptadas.length, 'bg-success-500'],
              ['Pendientes', pendientes.length, 'bg-amber-400'],
              ['Rechazadas', rechazadas.length, 'bg-red-400'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${c}`} /> {l}</span>
                <span className="font-semibold text-navy-900">{v as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recientes + canales */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-navy-900">Cotizaciones recientes</h2>
              <p className="text-xs text-slate-400">Consulta, comparte y administra tus documentos</p>
            </div>
            <Link to="/app/cotizaciones" className="text-xs font-medium text-primary-600 hover:underline">Ver todas →</Link>
          </div>
          {cotis.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aún no tienes cotizaciones</p>
              <Link to="/app/cotizaciones/nueva" className="text-xs text-primary-600 mt-1 inline-block hover:underline">Crear la primera →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-2.5 font-medium">Folio</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cotis.slice(0, 5).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-700">{c.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>{ESTADO_LABEL[c.estado] ?? c.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-navy-900">Enviar cotización</h2>
          <p className="text-xs text-slate-400 mb-4">Selecciona el canal para compartir</p>
          <div className="space-y-2">
            {canales.map(c => (
              <div key={c.title} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:border-primary-200 hover:bg-primary-50/40 transition-colors cursor-pointer">
                <span className="w-9 h-9 rounded-lg bg-fondo flex items-center justify-center text-navy-700"><c.icon className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">{c.title}</p>
                  <p className="text-[11px] text-slate-400">{c.desc}</p>
                </div>
                <span className="text-slate-300">›</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Anillo de porcentaje (SVG puro)
function Ring({ pct }: { pct: number }) {
  const r = 42, c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#08AEB6" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-navy-900">{pct}%</span>
        <span className="text-[10px] text-slate-400">aceptación</span>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center">
      <div className="flex items-end gap-1.5 opacity-40">
        {[30, 50, 35, 60, 45, 70].map((h, i) => (
          <span key={i} className="w-6 rounded-t bg-slate-200" style={{ height: h }} />
        ))}
      </div>
      <p className="text-sm text-slate-400 mt-4">Aquí verás tus cotizaciones aceptadas por mes</p>
    </div>
  )
}
