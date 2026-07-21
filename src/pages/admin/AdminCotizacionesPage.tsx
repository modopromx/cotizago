import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, ESTADO_COLORS, ESTADO_LABELS } from '../../lib/utils'
import { Search, FileText, Eye, ExternalLink } from 'lucide-react'

export default function AdminCotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<string>('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: cots }, { data: emp }] = await Promise.all([
        supabase.from('cotizaciones')
          .select('id,numero,estado,total,moneda,fecha_emision,cliente_nombre,visto_count,workspace_id,token')
          .order('created_at', { ascending: false }).limit(300),
        supabase.from('empresas').select('workspace_id,nombre_comercial,razon_social'),
      ])
      const e: Record<string, string> = {}
      ;(emp ?? []).forEach((x: any) => {
        if (x.workspace_id) e[x.workspace_id] = x.nombre_comercial || x.razon_social || '—'
      })
      setCotizaciones(cots ?? []); setEmpresas(e); setLoading(false)
    })()
  }, [])

  const estados = useMemo(
    () => Array.from(new Set(cotizaciones.map(c => c.estado).filter(Boolean))),
    [cotizaciones],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return cotizaciones.filter(c =>
      (estado === 'todos' || c.estado === estado) &&
      (!q || [c.numero, c.cliente_nombre, empresas[c.workspace_id]].some(v => v?.toLowerCase().includes(q)))
    )
  }, [cotizaciones, search, estado, empresas])

  const montoTotal = cotizaciones.reduce((s, c) => s + (Number(c.total) || 0), 0)
  const aceptadas = cotizaciones.filter(c => c.estado === 'aceptada')
  const montoAceptado = aceptadas.reduce((s, c) => s + (Number(c.total) || 0), 0)
  const vistas = cotizaciones.reduce((s, c) => s + (Number(c.visto_count) || 0), 0)

  const kpis = [
    { label: 'Cotizaciones emitidas', value: cotizaciones.length },
    { label: 'Monto cotizado', value: formatCurrency(montoTotal) },
    {
      label: 'Aceptadas',
      value: aceptadas.length,
      sub: cotizaciones.length ? `${Math.round(aceptadas.length / cotizaciones.length * 100)}% · ${formatCurrency(montoAceptado)}` : '—',
    },
    { label: 'Vistas de clientes', value: vistas },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Cotizaciones globales</h1>
        <p className="text-slate-500 text-sm">Todo lo que emiten tus usuarios, con su tasa de aceptación.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por folio, cliente o empresa..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-52" value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {estados.map(s => <option key={s} value={s}>{ESTADO_LABELS[s] ?? s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">{cotizaciones.length === 0 ? 'Aún no hay cotizaciones' : 'Sin resultados'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {cotizaciones.length === 0 ? 'Aparecerán aquí conforme tus usuarios las emitan.' : 'Prueba con otro filtro.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Folio</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Vistas</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono font-medium text-primary-700">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-600">{empresas[c.workspace_id] ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(c.total, c.moneda)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_COLORS[c.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ESTADO_LABELS[c.estado] ?? c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />{c.visto_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(c.fecha_emision)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.token && (
                        <a href={`/c/${c.token}`} target="_blank" rel="noreferrer"
                          title="Ver como la ve el cliente"
                          className="inline-flex p-1.5 text-slate-400 hover:text-navy-700 hover:bg-slate-100 rounded-lg">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
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
