import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { Users, FileText, CreditCard, TrendingUp, Activity } from 'lucide-react'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ usuarios: 0, cotizaciones: 0, pagosTotal: 0, ticketsAbiertos: 0 })
  const [recentUsers, setRecentUsers] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const [
        { count: u },
        { count: c },
        { count: t },
        { data: ru },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('cotizaciones').select('*', { count: 'exact', head: true }),
        supabase.from('soporte_tickets').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
        supabase.from('profiles').select('id,email,nombre,empresa,folios_balance,plan,created_at').order('created_at', { ascending: false }).limit(5),
      ])
      setStats({ usuarios: u ?? 0, cotizaciones: c ?? 0, pagosTotal: 0, ticketsAbiertos: t ?? 0 })
      setRecentUsers(ru ?? [])
    }
    load()
  }, [])

  const cards = [
    { label: 'Usuarios registrados', value: stats.usuarios, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Cotizaciones totales', value: stats.cotizaciones, icon: FileText, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Ingresos totales', value: formatCurrency(stats.pagosTotal), icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Tickets abiertos', value: stats.ticketsAbiertos, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel Administrador</h1>
        <p className="text-slate-500 text-sm">Visión general de la plataforma CotizaGo</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="card p-4">
            <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <p className="text-xl font-bold text-slate-800">{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Últimos usuarios registrados</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 font-medium text-slate-500">Usuario</th>
                <th className="text-left pb-2 font-medium text-slate-500">Empresa</th>
                <th className="text-left pb-2 font-medium text-slate-500">Plan</th>
                <th className="text-left pb-2 font-medium text-slate-500">Folios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-2.5">
                    <p className="font-medium text-slate-800">{u.nombre ?? '—'}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="py-2.5 text-slate-600">{u.empresa ?? '—'}</td>
                  <td className="py-2.5"><span className="badge bg-slate-100 text-slate-600">{u.plan}</span></td>
                  <td className="py-2.5 font-medium text-slate-700">{u.folios_balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
