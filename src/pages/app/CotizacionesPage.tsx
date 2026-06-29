import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate, ESTADO_COLORS, ESTADO_LABELS } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Search, Eye, Edit2, Trash2, Copy, Send, FileText, ExternalLink } from 'lucide-react'

export default function CotizacionesPage() {
  const { user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('cotizaciones')
      .select('id,numero,estado,total,moneda,fecha_emision,cliente_nombre,cliente_empresa,visto_count,token,folio_consumido')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCotizaciones(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    toast.success('Cotización eliminada')
    load()
  }

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/c/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado al portapapeles')
  }

  const filtered = cotizaciones.filter(c => {
    const matchSearch = c.numero?.toLowerCase().includes(search.toLowerCase()) ||
      c.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      c.cliente_empresa?.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    return matchSearch && matchEstado
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
          <p className="text-slate-500 text-sm">{cotizaciones.length} cotizaciones en total</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva cotización
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por número, cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium mb-1">No hay cotizaciones</p>
          <p className="text-slate-400 text-sm mb-4">Crea tu primera cotización profesional</p>
          <Link to="/app/cotizaciones/nueva" className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva cotización
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Número</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vistas</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary-700">{c.numero}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{c.cliente_nombre ?? '—'}</p>
                      {c.cliente_empresa && <p className="text-xs text-slate-400">{c.cliente_empresa}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(c.total, c.moneda)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_COLORS[c.estado]}`}>{ESTADO_LABELS[c.estado] ?? c.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.fecha_emision)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-500">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{c.visto_count ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`/c/${c.token}`} target="_blank" rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => handleCopy(c.token)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <Link to={`/app/cotizaciones/${c.id}/editar`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
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
