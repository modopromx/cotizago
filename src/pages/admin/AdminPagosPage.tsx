import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, formatDatetime } from '../../lib/utils'
import { CreditCard, Coins, Blocks, AlertTriangle, Search, Receipt, TrendingUp } from 'lucide-react'

// Las recargas de folios y los cobros de módulos comparten el estado 'aprobado'.
const PAGADO = ['aprobado', 'pagado']

export default function AdminPagosPage() {
  const [pagos, setPagos] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [modulos, setModulos] = useState<Record<string, any>>({})
  const [usuarios, setUsuarios] = useState<Record<string, any>>({})
  const [empresas, setEmpresas] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'folio_topup' | 'modulo'>('todos')
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      const [pg, ms, mo, us, em] = await Promise.all([
        supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('modulo_suscripciones').select('*'),
        supabase.from('modulos').select('clave,nombre,precio'),
        supabase.from('profiles').select('id,nombre,email'),
        supabase.from('empresas').select('workspace_id,nombre_comercial,razon_social'),
      ])
      const m: Record<string, any> = {}; (mo.data ?? []).forEach((x: any) => { m[x.clave] = x })
      const u: Record<string, any> = {}; (us.data ?? []).forEach((x: any) => { u[x.id] = x })
      const e: Record<string, string> = {}
      ;(em.data ?? []).forEach((x: any) => { if (x.workspace_id) e[x.workspace_id] = x.nombre_comercial || x.razon_social || '—' })
      setPagos(pg.data ?? []); setSubs(ms.data ?? []); setModulos(m); setUsuarios(u); setEmpresas(e)
      setLoading(false)
    })()
  }, [])

  const cobrados = pagos.filter(p => PAGADO.includes(p.estado))
  const ingresoFolios = cobrados.filter(p => p.tipo !== 'modulo').reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const ingresoModulos = cobrados.filter(p => p.tipo === 'modulo').reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const pendientes = pagos.filter(p => p.estado === 'pendiente')

  // MRR: solo lo que se va a volver a cobrar. Las programadas para cancelarse
  // no cuentan, porque el mes que entra ya no entra ese dinero.
  const vigentes = subs.filter(s => ['activa', 'morosa'].includes(s.estado))
  const mrr = vigentes
    .filter(s => !s.cancelar_al_terminar)
    .reduce((s2, s) => s2 + (Number(modulos[s.clave]?.precio) || 0), 0)
  const morosas = vigentes.filter(s => s.estado === 'morosa')
  const porCancelar = vigentes.filter(s => s.cancelar_al_terminar)

  const kpis = [
    { label: 'MRR de módulos', value: formatCurrency(mrr), sub: `${vigentes.length} suscripción${vigentes.length === 1 ? '' : 'es'} vigente${vigentes.length === 1 ? '' : 's'}`, icono: TrendingUp },
    { label: 'Ingresos por folios', value: formatCurrency(ingresoFolios), sub: `${cobrados.filter(p => p.tipo !== 'modulo').length} recargas`, icono: Coins },
    { label: 'Ingresos por módulos', value: formatCurrency(ingresoModulos), sub: `${cobrados.filter(p => p.tipo === 'modulo').length} cobros`, icono: Blocks },
    { label: 'Total cobrado', value: formatCurrency(ingresoFolios + ingresoModulos), sub: 'Histórico', icono: Receipt },
  ]

  const visibles = useMemo(() => {
    const q = search.toLowerCase()
    return pagos.filter(p => {
      if (filtro === 'modulo' && p.tipo !== 'modulo') return false
      if (filtro === 'folio_topup' && p.tipo === 'modulo') return false
      if (!q) return true
      const u = usuarios[p.user_id]
      return [p.paquete_nombre, u?.nombre, u?.email, empresas[p.workspace_id]]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [pagos, filtro, search, usuarios, empresas])

  const nombreCobro = (p: any) =>
    p.tipo === 'modulo' ? (modulos[p.paquete_nombre]?.nombre ?? p.paquete_nombre) : p.paquete_nombre

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Pagos y cobros</h1>
        <p className="text-slate-500 text-sm">Ingresos de la plataforma: recargas de folios y suscripciones de módulos.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-start justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{k.label}</p>
              <k.icono className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Lo que necesita atención va arriba, no escondido en la tabla */}
      {(morosas.length > 0 || pendientes.length > 0 || porCancelar.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-3">
          {morosas.length > 0 && (
            <div className="card p-4 bg-red-50/50 border-red-200">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {morosas.length} con pago fallido
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Conservan el acceso mientras Stripe reintenta el cobro.
              </p>
            </div>
          )}
          {porCancelar.length > 0 && (
            <div className="card p-4 bg-amber-50/50 border-amber-200">
              <p className="text-xs font-semibold text-amber-700">{porCancelar.length} se cancelan al terminar</p>
              <p className="text-[11px] text-slate-500 mt-1">No se volverán a cobrar el mes que entra.</p>
            </div>
          )}
          {pendientes.length > 0 && (
            <div className="card p-4 bg-slate-50 border-slate-200">
              <p className="text-xs font-semibold text-slate-600">{pendientes.length} pago(s) sin completar</p>
              <p className="text-[11px] text-slate-500 mt-1">Checkouts abiertos que nunca se pagaron.</p>
            </div>
          )}
        </div>
      )}

      {/* Suscripciones vigentes */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Suscripciones de módulos</h2>
          <span className="text-xs text-slate-400">{formatCurrency(mrr)}/mes recurrente</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-slate-500 text-sm">Cargando...</div>
        ) : vigentes.length === 0 ? (
          <div className="p-8 text-center">
            <Blocks className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Ningún módulo contratado todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-5 py-2.5 font-medium">Módulo</th>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 font-medium">Precio</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Renueva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vigentes.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-navy-900">{modulos[s.clave]?.nombre ?? s.clave}</td>
                    <td className="px-4 py-2.5 text-slate-600">{empresas[s.workspace_id] ?? '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-navy-900">{formatCurrency(modulos[s.clave]?.precio ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      {s.estado === 'morosa' ? <span className="badge bg-red-50 text-red-600">Pago fallido</span>
                        : s.cancelar_al_terminar ? <span className="badge bg-amber-50 text-amber-600">Se cancela</span>
                        : <span className="badge bg-success-50 text-success-600">Activa</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {s.periodo_fin ? formatDate(s.periodo_fin) : '—'}
                      {s.modo === 'test' && <span className="ml-2 badge bg-slate-100 text-slate-500">prueba</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de cobros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por concepto, usuario o empresa..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {([['todos', 'Todos'], ['folio_topup', 'Folios'], ['modulo', 'Módulos']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">{pagos.length === 0 ? 'Sin cobros todavía' : 'Sin resultados'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {pagos.length === 0 ? 'Aquí aparecerá cada recarga y cada cobro de módulo.' : 'Prueba con otro filtro.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Folios</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(p => {
                  const u = usuarios[p.user_id]
                  const esModulo = p.tipo === 'modulo'
                  const pagado = PAGADO.includes(p.estado)
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 ${!pagado ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            esModulo ? 'bg-primary-50 text-primary-700' : 'bg-fondo text-navy-700'
                          }`}>
                            {esModulo ? <Blocks className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                          </span>
                          <div>
                            <p className="font-medium text-navy-900">{nombreCobro(p) ?? '—'}</p>
                            <p className="text-[11px] text-slate-400">{esModulo ? 'Suscripción mensual' : 'Recarga de folios'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{empresas[p.workspace_id] ?? u?.nombre ?? '—'}</p>
                        {u?.email && <p className="text-[11px] text-slate-400">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(p.monto, p.moneda)}</td>
                      <td className="px-4 py-3 text-slate-500">{p.folios_cantidad ? `+${p.folios_cantidad}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          pagado ? 'bg-success-50 text-success-600'
                          : p.estado === 'pendiente' ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                        }`}>
                          {pagado ? 'Cobrado' : p.estado}
                        </span>
                        {p.metadata?.modo === 'test' && <span className="ml-1.5 badge bg-slate-100 text-slate-500">prueba</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDatetime(p.created_at)}</td>
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
