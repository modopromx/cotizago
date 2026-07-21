import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Link2, FileText, MessageCircle, ExternalLink } from 'lucide-react'

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

const TABS = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'aceptada', label: 'Aceptadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'borrador', label: 'Borradores' },
]
const esPendiente = (e: string) => ['enviada', 'vista', 'pendiente'].includes(e)

export default function CotizacionesPage() {
  const { user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('todas')

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('cotizaciones')
      .select('id,numero,estado,total,moneda,updated_at,cliente_nombre,cliente_empresa,token')
      .order('updated_at', { ascending: false })
    setCotizaciones(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    toast.success('Cotización eliminada'); load()
  }
  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${token}`)
    toast.success('Enlace copiado')
  }

  const filtered = cotizaciones.filter(c => {
    const s = search.toLowerCase()
    const matchSearch = [c.numero, c.cliente_nombre, c.cliente_empresa].some(v => v?.toLowerCase().includes(s))
    const matchTab = tab === 'todas' ? true : tab === 'pendientes' ? esPendiente(c.estado) : c.estado === tab
    return matchSearch && matchTab
  })

  const countFor = (key: string) => cotizaciones.filter(c =>
    key === 'todas' ? true : key === 'pendientes' ? esPendiente(c.estado) : c.estado === key).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Cotizaciones</h1>
          <p className="text-slate-500 text-sm">Crea, consulta, duplica, envía y da seguimiento.</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-navy"><Plus className="w-4 h-4" /> Nueva cotización</Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por folio, cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t.label} <span className={tab === t.key ? 'text-white/60' : 'text-slate-400'}>{countFor(t.key)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium mb-1">{cotizaciones.length === 0 ? 'Aún no tienes cotizaciones' : 'Sin resultados en este filtro'}</p>
          <Link to="/app/cotizaciones/nueva" className="btn-navy mt-3"><Plus className="w-4 h-4" /> Nueva cotización</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Folio</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Actualizada</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.numero}</td>
                    <td className="px-4 py-3">
                      <p className="text-navy-900">{c.cliente_nombre ?? '—'}</p>
                      {c.cliente_empresa && <p className="text-xs text-slate-400">{c.cliente_empresa}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(c.total, c.moneda)}</td>
                    <td className="px-4 py-3"><span className={`badge ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>{ESTADO_LABEL[c.estado] ?? c.estado}</span></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`/c/${c.token}`} target="_blank" rel="noreferrer" title="Ver pública" className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>
                        <button onClick={() => handleCopy(c.token)} title="Copiar enlace" className="p-1.5 text-slate-400 hover:text-azul-600 hover:bg-azul-50 rounded-lg"><Link2 className="w-3.5 h-3.5" /></button>
                        <a href={`https://wa.me/?text=${encodeURIComponent(window.location.origin + '/c/' + c.token)}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 text-slate-400 hover:text-success-600 hover:bg-success-50 rounded-lg"><MessageCircle className="w-3.5 h-3.5" /></a>
                        <Link to={`/app/cotizaciones/${c.id}/editar`} title="Editar" className="p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></Link>
                        <button onClick={() => handleDelete(c.id)} title="Eliminar" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
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
