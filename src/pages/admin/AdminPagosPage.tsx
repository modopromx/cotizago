import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDatetime } from '../../lib/utils'

export default function AdminPagosPage() {
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => { setPagos(data ?? []); setLoading(false) })
  }, [])

  const total = pagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + (p.monto ?? 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
        <p className="text-slate-500 text-sm">Total aprobado: <strong>{formatCurrency(total)}</strong></p>
      </div>
      {loading ? <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div> : pagos.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">Sin pagos registrados aún</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Usuario</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Paquete</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Monto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Folios</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{p.user_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-slate-700">{p.paquete_nombre ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(p.monto, p.moneda)}</td>
                  <td className="px-4 py-3">+{p.folios_cantidad}</td>
                  <td className="px-4 py-3"><span className={`badge ${p.estado === 'aprobado' ? 'bg-green-100 text-green-700' : p.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.estado}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDatetime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
