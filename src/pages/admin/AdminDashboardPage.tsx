import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { Users, DollarSign, Coins, FileText, CreditCard, Mail, MessageCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState<any>({ usuarios: 0, cotis: [], pagos: [], mrr: 0, integ: {} })

  useEffect(() => {
    const load = async () => {
      const [{ count: usuarios }, { data: cotis }, { data: pagos }, { data: subs }, { data: mods }, integ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('cotizaciones').select('estado,total,created_at'),
        supabase.from('pagos').select('monto,folios_cantidad,acreditado,estado,created_at'),
        supabase.from('modulo_suscripciones').select('clave,estado').eq('estado', 'activa'),
        supabase.from('modulos').select('clave,precio'),
        supabase.rpc('secretos_configurados'),
      ])
      const precios: Record<string, number> = {}
      ;(mods ?? []).forEach((m: any) => { precios[m.clave] = Number(m.precio) })
      const mrr = (subs ?? []).reduce((s: number, x: any) => s + (precios[x.clave] || 0), 0)
      const est = (integ.data as Record<string, boolean>) ?? {}
      setD({ usuarios: usuarios ?? 0, cotis: cotis ?? [], pagos: pagos ?? [], mrr, integ: est })
      setLoading(false)
    }
    load()
  }, [])

  const pagosOk = d.pagos.filter((p: any) => p.acreditado || p.estado === 'aprobado')
  const foliosVendidos = pagosOk.reduce((s: number, p: any) => s + (p.folios_cantidad || 0), 0)
  const ingresoFolios = pagosOk.reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0)
  const aceptadas = d.cotis.filter((c: any) => c.estado === 'aceptada').length
  const tasaAcept = d.cotis.length ? Math.round((aceptadas / d.cotis.length) * 100) : 0

  // Ingresos por mes (folios) últimos 6 meses
  const ahora = new Date()
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1)
    return { key: `${dt.getFullYear()}-${dt.getMonth()}`, label: MESES[dt.getMonth()], value: 0 }
  })
  pagosOk.forEach((p: any) => {
    const dt = new Date(p.created_at)
    const b = buckets.find(x => x.key === `${dt.getFullYear()}-${dt.getMonth()}`)
    if (b) b.value += Number(p.monto) || 0
  })
  const hayIngresos = buckets.some(b => b.value > 0)

  const kpis = [
    { label: 'Usuarios', value: d.usuarios, icon: Users, sub: 'Registrados' },
    { label: 'MRR de módulos', value: formatCurrency(d.mrr), icon: DollarSign, sub: 'Mensual recurrente' },
    { label: 'Folios vendidos', value: foliosVendidos, icon: Coins, sub: formatCurrency(ingresoFolios) },
    { label: 'Cotizaciones', value: d.cotis.length, icon: FileText, sub: `${tasaAcept}% aceptación` },
  ]

  const integraciones = [
    { nombre: 'Stripe', icon: CreditCard, ok: !!d.integ.stripe_secret_key && !!d.integ.stripe_webhook_secret },
    { nombre: 'Email (SMTP/Resend)', icon: Mail, ok: !!d.integ.smtp_password || !!d.integ.resend_api_key },
    { nombre: 'WhatsApp Cloud API', icon: MessageCircle, ok: false },
  ]

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Visión general de la plataforma</h1>
        <p className="text-slate-500 text-sm">Operación, ingresos y salud del sistema.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-5">
            <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center mb-3"><k.icon className="w-4 h-4 text-primary-600" /></div>
            <p className="text-2xl font-extrabold text-navy-900">{k.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-slate-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-navy-900">Ingresos de la plataforma</h2>
          <p className="text-xs text-slate-400 mb-4">Folios · últimos 6 meses</p>
          {hayIngresos ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={buckets} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {buckets.map((_, i) => <Cell key={i} fill={i === buckets.length - 1 ? '#08AEB6' : '#c3f1f2'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">Aún no hay ingresos registrados</div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-navy-900">Salud de integraciones</h2>
          <p className="text-xs text-slate-400 mb-4">Servicios críticos</p>
          <div className="space-y-3">
            {integraciones.map(i => (
              <div key={i.nombre} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-700"><i.icon className="w-4 h-4 text-slate-400" /> {i.nombre}</span>
                <span className={`badge ${i.ok ? 'bg-success-50 text-success-600' : 'bg-amber-50 text-amber-600'}`}>{i.ok ? 'Operativa' : 'Sin configurar'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
