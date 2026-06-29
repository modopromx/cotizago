import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDatetime } from '../../lib/utils'
import { ScrollText, RefreshCw } from 'lucide-react'

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('logs_sistema').select('*').order('created_at', { ascending: false }).limit(100)
    setLogs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const nivelColor: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    warn: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Logs del sistema</h1>
          <p className="text-slate-500 text-sm">Últimos 100 registros</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Actualizar</button>
      </div>
      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : logs.length === 0 ? (
        <div className="card p-10 text-center">
          <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin logs registrados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nivel</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fuente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Mensaje</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><span className={`badge ${nivelColor[l.nivel] ?? 'bg-slate-100 text-slate-600'}`}>{l.nivel}</span></td>
                  <td className="px-4 py-2 text-slate-500">{l.fuente ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{l.mensaje}</td>
                  <td className="px-4 py-2 text-slate-400">{formatDatetime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
