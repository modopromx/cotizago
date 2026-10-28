import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Search, Users, Building2 } from 'lucide-react'

export default function AdminClientesPage() {
  const { t } = useTranslation()
  const [clientes, setClientes] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<Record<string, string>>({})
  const [agg, setAgg] = useState<Record<string, { n: number; valor: number }>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: cli }, { data: emp }, { data: cot }] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('empresas').select('workspace_id,nombre_comercial,razon_social'),
        supabase.from('cotizaciones').select('cliente_id,total'),
      ])
      const e: Record<string, string> = {}
      ;(emp ?? []).forEach((x: any) => {
        if (x.workspace_id) e[x.workspace_id] = x.nombre_comercial || x.razon_social || '—'
      })
      const a: Record<string, { n: number; valor: number }> = {}
      ;(cot ?? []).forEach((c: any) => {
        if (!c.cliente_id) return
        a[c.cliente_id] = a[c.cliente_id] ?? { n: 0, valor: 0 }
        a[c.cliente_id].n++
        a[c.cliente_id].valor += Number(c.total) || 0
      })
      setClientes(cli ?? []); setEmpresas(e); setAgg(a); setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clientes.filter(c =>
      !q || [c.nombre, c.empresa, c.email, empresas[c.workspace_id]]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [clientes, search, empresas])

  // Un cliente "con actividad" es el que ya recibió al menos una cotización.
  const conActividad = clientes.filter(c => (agg[c.id]?.n ?? 0) > 0).length
  const valorTotal = Object.values(agg).reduce((s, a) => s + a.valor, 0)
  const empresasDistintas = new Set(clientes.map(c => c.workspace_id).filter(Boolean)).size

  const kpis = [
    { label: t('adm.cli.kClientes'), value: clientes.length },
    { label: t('adm.cli.kConCoti'), value: conActividad, sub: clientes.length ? t('adm.cli.kConCotiSub', { n: Math.round(conActividad / clientes.length * 100) }) : '—' },
    { label: t('adm.cli.kEmpresas'), value: empresasDistintas },
    { label: t('adm.cli.kValor'), value: formatCurrency(valorTotal), sub: t('adm.cli.historico') },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('adm.cli.title')}</h1>
        <p className="text-slate-500 text-sm">{t('adm.cli.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
        <input className="input pl-9" type="search" aria-label={t('adm.cli.buscar')} placeholder={t('adm.cli.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">{clientes.length === 0 ? t('adm.cli.sinClientes') : t('adm.cli.sinResultados')}</p>
          <p className="text-sm text-slate-500 mt-1">
            {clientes.length === 0 ? t('adm.cli.aparecerAqui') : t('adm.cli.otroTermino')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">{t('adm.cli.colCliente')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.cli.colRegistradoPor')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.cli.colContacto')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.cli.colCotizaciones')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.cli.colValor')}</th>
                  <th className="px-4 py-3 font-medium">{t('adm.cli.colAlta')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const a = agg[c.id] ?? { n: 0, valor: 0 }
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 ${c.activo === false ? 'opacity-55' : ''}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {(c.empresa || c.nombre || '?').slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium text-navy-900">{c.empresa || c.nombre}</p>
                            {c.empresa && <p className="text-xs text-slate-500">{c.nombre}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                          {empresas[c.workspace_id] ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{c.email ?? '—'}</p>
                        {c.whatsapp && <p className="text-xs text-slate-500">+{String(c.whatsapp).replace(/\D/g, '')}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.n}</td>
                      <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(a.valor)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
