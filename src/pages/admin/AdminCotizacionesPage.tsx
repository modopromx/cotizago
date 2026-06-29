import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, ESTADO_COLORS, ESTADO_LABELS } from '../../lib/utils'
import { Search, Eye } from 'lucide-react'

export default function AdminCotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('cotizaciones').select('id,numero,estado,total,moneda,fecha_emision,cliente_nombre,visto_count,user_id').order('created_at', { ascending: false }).limit(200).then(({ data }) => { setCotizaciones(data ?? []); setLoading(false) })
  }, [])

  const filtered = cotizaciones.filter(c =>
    c.numero?.toLowerCase().includes(search.toLowerCase()) ||
    c.cliente_nombre?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cotizaciones globales</h1>
        <p className="text-slate-500 text-sm">{cotizaciones.length} cotizaciones en la plataforma</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Número</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vistas</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium text-primary-700">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-700">{c.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(c.total, c.moneda)}</td>
                    <td className="px-4 py-3"><span className={`badge ${ESTADO_COLORS[c.estado]}`}>{ESTADO_LABELS[c.estado]}</span></td>
                    <td className="px-4 py-3 text-slate-500">{c.visto_count ?? 0}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.fecha_emision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
