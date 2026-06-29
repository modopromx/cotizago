import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/utils'
import { FileText, Users, Package, Zap, TrendingUp, Clock, CheckCircle, Eye, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ cotizaciones: 0, clientes: 0, productos: 0, aceptadas: 0, totalEnviado: 0 })
  const [recientes, setRecientes] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ count: cot }, { count: cli }, { count: prod }, { data: cotData }] = await Promise.all([
        supabase.from('cotizaciones').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('activo', true),
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('activo', true),
        supabase.from('cotizaciones').select('estado,total,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])

      const aceptadas = cotData?.filter(c => c.estado === 'aceptada').length ?? 0
      const totalEnviado = cotData?.reduce((s, c) => s + (c.total || 0), 0) ?? 0

      setStats({ cotizaciones: cot ?? 0, clientes: cli ?? 0, productos: prod ?? 0, aceptadas, totalEnviado })
      setRecientes(cotData ?? [])

      // Chart: últimas 6 semanas
      const now = new Date()
      const weeks = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (5 - i) * 7)
        return { label: `Sem ${i + 1}`, total: 0 }
      })
      setChartData(weeks)
      setLoading(false)
    }
    load()
  }, [user])

  const statCards = [
    { label: 'Cotizaciones', value: stats.cotizaciones, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Clientes activos', value: stats.clientes, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Productos', value: stats.productos, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Folios disponibles', value: profile?.folios_balance ?? 0, icon: Zap, color: 'text-primary-600', bg: 'bg-primary-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Buenos días, {profile?.nombre?.split(' ')[0] ?? 'bienvenido'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Aquí tienes un resumen de tu actividad</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva cotización
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{loading ? '—' : s.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart + recientes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Cotizaciones por semana</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e7363" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1e7363" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke="#1e7363" fill="url(#grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Últimas cotizaciones</h2>
          {recientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Sin cotizaciones aún</p>
              <Link to="/app/cotizaciones/nueva" className="text-xs text-primary-600 mt-1 hover:underline">Crear primera cotización</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recientes.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{formatCurrency(c.total)}</p>
                    <p className="text-xs text-slate-400 capitalize">{c.estado}</p>
                  </div>
                  <span className={`badge text-xs ${
                    c.estado === 'aceptada' ? 'bg-green-100 text-green-700' :
                    c.estado === 'enviada' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{c.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folios warning */}
      {(profile?.folios_balance ?? 0) <= 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {profile?.folios_balance === 0 ? 'Sin folios disponibles' : `Solo te quedan ${profile?.folios_balance} folios`}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Recarga para seguir enviando cotizaciones</p>
            </div>
          </div>
          <Link to="/app/folios" className="btn-primary text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600">
            Recargar ahora
          </Link>
        </div>
      )}
    </div>
  )
}
