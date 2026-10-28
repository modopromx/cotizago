import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import {
  CheckCircle2, Clock, XCircle, DollarSign, Plus, FileText,
  MessageCircle, Mail, CreditCard, ArrowRight,
} from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts'
import OnboardingChecklist from '../../components/OnboardingChecklist'

const ESTADO_BADGE: Record<string, string> = {
  aceptada: 'bg-success-50 text-success-700',
  rechazada: 'bg-red-50 text-red-700',
  enviada: 'bg-azul-50 text-azul-600',
  vista: 'bg-primary-50 text-primary-700',
  pendiente: 'bg-amber-50 text-amber-700',
  borrador: 'bg-slate-100 text-slate-500',
  vencida: 'bg-slate-100 text-slate-500',
  cancelada: 'bg-slate-100 text-slate-500',
}

const DIA_MS = 86400000

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const MESES = t('meses', { returnObjects: true }) as string[]
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cotis, setCotis] = useState<any[]>([])
  const [modActivos, setModActivos] = useState<Set<string>>(new Set())

  // Filtro de periodo
  const [periodo, setPeriodo] = useState<'7' | '15' | '30' | 'todo'>('30')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const usaFechas = !!(desde && hasta)

  useEffect(() => {
    if (!user || !profile?.workspace_id) return
    const ws = profile.workspace_id
    supabase.from('cotizaciones')
      .select('id,numero,total,estado,created_at,cliente_nombre')
      .eq('workspace_id', ws)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCotis(data ?? []); setLoading(false) })
    supabase.from('modulo_suscripciones').select('clave,estado').eq('workspace_id', ws)
      .then(({ data }) => setModActivos(new Set((data ?? []).filter((s: any) => ['activa', 'morosa'].includes(s.estado)).map((s: any) => s.clave))))
  }, [user, profile?.workspace_id])

  // Rango de fechas según el filtro
  const { inicio, fin, dias } = useMemo(() => {
    if (usaFechas) {
      const i = new Date(desde + 'T00:00:00'); const f = new Date(hasta + 'T23:59:59')
      return { inicio: i, fin: f, dias: Math.round((f.getTime() - i.getTime()) / DIA_MS) + 1 }
    }
    if (periodo === 'todo') return { inicio: null as Date | null, fin: new Date(), dias: Infinity }
    const n = Number(periodo)
    const f = new Date()
    const i = new Date(); i.setDate(i.getDate() - (n - 1)); i.setHours(0, 0, 0, 0)
    return { inicio: i, fin: f, dias: n }
  }, [periodo, desde, hasta, usaFechas])

  const cotisRango = useMemo(() => cotis.filter(c => {
    if (!inicio) return true
    const d = new Date(c.created_at)
    return d >= inicio && d <= fin
  }), [cotis, inicio, fin])

  // Métricas (sobre el rango seleccionado)
  const esPendiente = (e: string) => ['enviada', 'vista', 'pendiente'].includes(e)
  const aceptadas = cotisRango.filter(c => c.estado === 'aceptada')
  const pendientes = cotisRango.filter(c => esPendiente(c.estado))
  const rechazadas = cotisRango.filter(c => c.estado === 'rechazada')
  const respondidas = aceptadas.length + rechazadas.length
  const valorAceptado = aceptadas.reduce((s, c) => s + (Number(c.total) || 0), 0)
  const totalConEstado = aceptadas.length + pendientes.length + rechazadas.length
  const tasaAceptacion = respondidas ? Math.round((aceptadas.length / respondidas) * 100) : 0
  const pctRechazo = totalConEstado ? ((rechazadas.length / totalConEstado) * 100).toFixed(1) : '0'

  // Gráfica de aceptadas: por día si el rango es corto, por mes si es largo.
  const buckets = useMemo(() => {
    const acep = aceptadas
    const porDia = dias !== Infinity && dias <= 31 && !!inicio
    if (porDia && inicio) {
      const arr: { key: string; label: string; value: number }[] = []
      const cur = new Date(inicio); cur.setHours(0, 0, 0, 0)
      for (let d = 0; d < dias; d++) {
        arr.push({ key: `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`, label: `${cur.getDate()}/${cur.getMonth() + 1}`, value: 0 })
        cur.setDate(cur.getDate() + 1)
      }
      acep.forEach(c => {
        const d = new Date(c.created_at)
        const b = arr.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
        if (b) b.value++
      })
      return arr
    }
    // Mensual: desde el mes de inicio (o el más antiguo si es "todo") hasta hoy, máx 12.
    const desdeFecha = inicio ?? (cotis.length ? new Date(Math.min(...cotis.map(c => new Date(c.created_at).getTime()))) : new Date())
    const arr: { key: string; label: string; value: number }[] = []
    const cur = new Date(desdeFecha.getFullYear(), desdeFecha.getMonth(), 1)
    const tope = new Date(fin.getFullYear(), fin.getMonth(), 1)
    let guard = 0
    while (cur <= tope && guard < 12) {
      arr.push({ key: `${cur.getFullYear()}-${cur.getMonth()}`, label: MESES[cur.getMonth()], value: 0 })
      cur.setMonth(cur.getMonth() + 1); guard++
    }
    acep.forEach(c => {
      const d = new Date(c.created_at)
      const b = arr.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`)
      if (b) b.value++
    })
    return arr
  }, [aceptadas, dias, inicio, fin, cotis, MESES])

  const hayDatosGrafica = buckets.some(b => b.value > 0)
  // Muestra ~8 etiquetas como máximo para que no se encimen.
  const chartInterval = Math.max(0, Math.ceil(buckets.length / 8) - 1)
  const periodoLabel = usaFechas
    ? t('dash.rango', { a: formatDate(desde), b: formatDate(hasta) })
    : periodo === 'todo' ? t('dash.todoHistorico') : t('dash.enUltimos', { n: periodo })

  const kpis = [
    { label: t('dash.kpiAceptadas'), value: aceptadas.length, icon: CheckCircle2, color: 'text-success-700', bg: 'bg-success-50', sub: t('dash.subAceptacion', { n: tasaAceptacion }) },
    { label: t('dash.kpiPendientes'), value: pendientes.length, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50', sub: t('dash.subSeguimiento') },
    { label: t('dash.kpiRechazadas'), value: rechazadas.length, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50', sub: t('dash.subDelTotal', { n: pctRechazo }) },
    { label: t('dash.kpiValor'), value: formatCurrency(valorAceptado), icon: DollarSign, color: 'text-primary-700', bg: 'bg-primary-50', sub: t('dash.subGanadas') },
  ]

  const integraciones = [
    { clave: 'whatsapp_propio', icon: MessageCircle, nombre: t('dash.modWa'), desc: t('dash.modWaDesc'), color: 'bg-success-50 text-success-700' },
    { clave: 'email_profesional', icon: Mail, nombre: t('dash.modEmail'), desc: t('dash.modEmailDesc'), color: 'bg-azul-50 text-azul-600' },
    { clave: 'pagos_linea', icon: CreditCard, nombre: t('dash.modPagos'), desc: t('dash.modPagosDesc'), color: 'bg-primary-50 text-primary-700' },
  ]

  const btnPeriodo = (v: '7' | '15' | '30' | 'todo', label: string) => (
    <button type="button" onClick={() => { setPeriodo(v); setDesde(''); setHasta('') }} aria-pressed={!usaFechas && periodo === v}
      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!usaFechas && periodo === v ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      {/* Onboarding: tarjeta de primeros pasos (se auto-oculta al completar) */}
      <OnboardingChecklist />

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('dash.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('dash.subtitle')}</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('shell.nuevaCotizacion')}</Link>
      </div>

      {/* Filtro de periodo */}
      <div className="flex flex-wrap items-center gap-2">
        {btnPeriodo('7', t('dash.p7'))}
        {btnPeriodo('15', t('dash.p15'))}
        {btnPeriodo('30', t('dash.p30'))}
        {btnPeriodo('todo', t('dash.pTodo'))}
        <span className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t('dash.desde')}</span>
          <input type="date" aria-label={t('dash.desde')} value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className="input py-1.5 px-2 text-xs w-auto" />
          <span className="text-xs text-slate-500">{t('dash.hasta')}</span>
          <input type="date" aria-label={t('dash.hasta')} value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className="input py-1.5 px-2 text-xs w-auto" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-5">
            <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>
              <k.icon className={`w-4 h-4 ${k.color}`} aria-hidden="true" />
            </div>
            <p className="text-2xl font-extrabold text-navy-900">{loading ? '—' : k.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{k.label}</p>
            <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfica + anillo */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-navy-900">{t('dash.aceptacionTitle')}</h2>
            <span className="text-xs text-slate-500">{periodoLabel}</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">{t('dash.aceptacionDesc')}</p>
          {hayDatosGrafica ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={buckets} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={chartInterval} tick={{ fontSize: 11, fill: '#64748b' }} />
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
          <h2 className="font-semibold text-navy-900">{t('dash.estadoRespuestas')}</h2>
          <p className="text-xs text-slate-500 mb-4">{t('dash.registradas', { n: totalConEstado })}</p>
          <div className="flex justify-center my-4">
            <Ring pct={tasaAceptacion} label={t('dash.ringLabel')} />
          </div>
          <div className="space-y-2">
            {[
              [t('dash.kpiAceptadas'), aceptadas.length, 'bg-success-500'],
              [t('dash.kpiPendientes'), pendientes.length, 'bg-amber-400'],
              [t('dash.kpiRechazadas'), rechazadas.length, 'bg-red-400'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${c}`} aria-hidden="true" /> {l}</span>
                <span className="font-semibold text-navy-900">{v as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recientes + integraciones */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-navy-900">{t('dash.recientes')}</h2>
              <p className="text-xs text-slate-500">{t('dash.recientesDesc')}</p>
            </div>
            <Link to="/app/cotizaciones" className="text-xs font-medium text-primary-700 hover:underline">{t('dash.verTodas')}</Link>
          </div>
          {cotisRango.length === 0 ? (
            <div className="py-14 text-center">
              <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-500">{t('dash.sinCotis')}</p>
              <Link to="/app/cotizaciones/nueva" className="text-xs text-primary-700 mt-1 inline-block hover:underline">{t('dash.crearPrimera')}</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-2.5 font-medium">{t('dash.folio')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dash.cliente')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dash.total')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('dash.estadoCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cotisRango.slice(0, 5).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-700">{c.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>{t(`estado.${c.estado}`, { defaultValue: c.estado })}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Integraciones: muestra activas y lleva a contratar las que faltan */}
        <div className="card p-6">
          <h2 className="font-semibold text-navy-900">{t('dash.misModulos')}</h2>
          <p className="text-xs text-slate-500 mb-4">{t('dash.misModulosSub')}</p>
          <div className="space-y-2">
            {integraciones.map(m => {
              const activo = modActivos.has(m.clave)
              return (
                <div key={m.clave} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}><m.icon className="w-4 h-4" aria-hidden="true" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900">{m.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{m.desc}</p>
                  </div>
                  {activo ? (
                    <span className="badge bg-success-50 text-success-700 shrink-0">{t('dash.activo')}</span>
                  ) : (
                    <button type="button" onClick={() => navigate('/app/modulos')} aria-label={`${t('dash.activar')} ${m.nombre}`} className="min-h-[36px] text-xs font-medium text-primary-700 hover:underline inline-flex items-center gap-0.5 shrink-0">
                      {t('dash.activar')} <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Anillo de porcentaje (SVG puro)
function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 42, c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#08AEB6" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-navy-900">{pct}%</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
    </div>
  )
}

function EmptyChart() {
  const { t } = useTranslation()
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-center">
      <div className="flex items-end gap-1.5 opacity-40">
        {[30, 50, 35, 60, 45, 70].map((h, i) => (
          <span key={i} className="w-6 rounded-t bg-slate-200" style={{ height: h }} />
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-4">{t('dash.emptyChart')}</p>
    </div>
  )
}
