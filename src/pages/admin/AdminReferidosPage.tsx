// Panel admin: seguimiento del programa de referidos "Invita y gana".
// Muestra el total repartido, un ranking de quién invita más y el detalle
// de cada referido (pendiente = aún no paga; acreditado = ya pagó y se
// repartieron los folios a ambos).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { Gift, Users, CheckCircle2, Coins, Search, Trophy } from 'lucide-react'

type Ref = {
  id: string; referrer_id: string; referido_id: string
  estado: string; folios_referrer: number; folios_referido: number
  created_at: string; acreditado_at: string | null
}
type Perfil = { id: string; nombre: string | null; email: string | null; codigo_ref: string | null }

export default function AdminReferidosPage() {
  const [refs, setRefs] = useState<Ref[]>([])
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'ranking' | 'detalle'>('ranking')

  useEffect(() => {
    (async () => {
      const [rf, pf] = await Promise.all([
        supabase.from('referidos').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id,nombre,email,codigo_ref'),
      ])
      const p: Record<string, Perfil> = {}
      ;(pf.data ?? []).forEach((x: any) => { p[x.id] = x })
      setRefs(rf.data ?? []); setPerfiles(p); setLoading(false)
    })()
  }, [])

  const nombre = (id: string) => perfiles[id]?.nombre || perfiles[id]?.email || '—'
  const email = (id: string) => perfiles[id]?.email || ''

  // Totales globales.
  const totInvitados = refs.length
  const acreditados = refs.filter(r => r.estado === 'acreditado')
  const totPagaron = acreditados.length
  const totFolios = acreditados.reduce((s, r) => s + (r.folios_referrer || 0) + (r.folios_referido || 0), 0)
  const conversion = totInvitados ? Math.round((totPagaron / totInvitados) * 100) : 0

  // Ranking por referidor.
  const ranking = useMemo(() => {
    const map: Record<string, { id: string; invitados: number; pagaron: number; folios: number }> = {}
    for (const r of refs) {
      const m = map[r.referrer_id] ?? (map[r.referrer_id] = { id: r.referrer_id, invitados: 0, pagaron: 0, folios: 0 })
      m.invitados++
      if (r.estado === 'acreditado') { m.pagaron++; m.folios += (r.folios_referrer || 0) }
    }
    let arr = Object.values(map)
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(m => nombre(m.id).toLowerCase().includes(q) || email(m.id).toLowerCase().includes(q) || (perfiles[m.id]?.codigo_ref || '').toLowerCase().includes(q))
    }
    return arr.sort((a, b) => b.pagaron - a.pagaron || b.invitados - a.invitados)
  }, [refs, perfiles, search])

  const detalle = useMemo(() => {
    if (!search.trim()) return refs
    const q = search.toLowerCase()
    return refs.filter(r =>
      nombre(r.referrer_id).toLowerCase().includes(q) || email(r.referrer_id).toLowerCase().includes(q) ||
      nombre(r.referido_id).toLowerCase().includes(q) || email(r.referido_id).toLowerCase().includes(q))
  }, [refs, perfiles, search])

  const Stat = ({ icon: Icon, label, value, color }: any) => (
    <div className="card p-4 flex items-center gap-3">
      <span aria-hidden="true" className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></span>
      <div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-navy-900">{value}</p></div>
    </div>
  )

  if (loading) return <div role="status" className="p-6 text-slate-500 text-sm">Cargando…</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="w-11 h-11 rounded-xl bg-primary-500 text-navy-900 flex items-center justify-center"><Gift className="w-5 h-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Afiliados</h1>
          <p className="text-slate-500 text-sm">Programa "Invita y gana": 20 folios al referidor + 10 al invitado cuando el invitado hace su primera compra.</p>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Users} label="Invitados totales" value={totInvitados} color="bg-primary-50 text-primary-700" />
        <Stat icon={CheckCircle2} label="Ya pagaron" value={totPagaron} color="bg-success-50 text-success-700" />
        <Stat icon={Trophy} label="Conversión" value={`${conversion}%`} color="bg-indigo-50 text-indigo-600" />
        <Stat icon={Coins} label="Folios repartidos" value={totFolios} color="bg-amber-50 text-amber-700" />
      </div>

      {/* Buscador + tabs */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm" role="group" aria-label="Vista">
          <button type="button" onClick={() => setTab('ranking')} aria-pressed={tab === 'ranking'} className={`px-4 py-1.5 rounded-lg font-medium ${tab === 'ranking' ? 'bg-white shadow text-navy-900' : 'text-slate-600'}`}>Ranking</button>
          <button type="button" onClick={() => setTab('detalle')} aria-pressed={tab === 'detalle'} className={`px-4 py-1.5 rounded-lg font-medium ${tab === 'detalle' ? 'bg-white shadow text-navy-900' : 'text-slate-600'}`}>Detalle</button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input type="search" aria-label="Buscar nombre, email o código" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, email o código…" className="input pl-9 w-full sm:w-72" />
        </div>
      </div>

      {tab === 'ranking' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Referidor</th>
                <th className="p-3 font-medium">Código</th>
                <th className="p-3 font-medium text-center">Invitados</th>
                <th className="p-3 font-medium text-center">Pagaron</th>
                <th className="p-3 font-medium text-right">Folios ganados</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="p-3 text-slate-500">{i + 1}</td>
                  <td className="p-3">
                    <p className="font-medium text-navy-900">{nombre(m.id)}</p>
                    <p className="text-xs text-slate-500">{email(m.id)}</p>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-500">{perfiles[m.id]?.codigo_ref || '—'}</td>
                  <td className="p-3 text-center">{m.invitados}</td>
                  <td className="p-3 text-center font-semibold text-success-700">{m.pagaron}</td>
                  <td className="p-3 text-right font-semibold text-amber-700">{m.folios}</td>
                </tr>
              ))}
              {ranking.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aún no hay afiliados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'detalle' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="p-3 font-medium">Invitó</th>
                <th className="p-3 font-medium">Invitado</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Registro</th>
                <th className="p-3 font-medium">Acreditado</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="p-3">
                    <p className="font-medium text-navy-900">{nombre(r.referrer_id)}</p>
                    <p className="text-xs text-slate-500">{email(r.referrer_id)}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-navy-900">{nombre(r.referido_id)}</p>
                    <p className="text-xs text-slate-500">{email(r.referido_id)}</p>
                  </td>
                  <td className="p-3">
                    {r.estado === 'acreditado'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-success-50 text-success-700"><CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Pagó (+{r.folios_referrer})</span>
                      : <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">Pendiente</span>}
                  </td>
                  <td className="p-3 text-slate-500">{formatDate(r.created_at)}</td>
                  <td className="p-3 text-slate-500">{r.acreditado_at ? formatDate(r.acreditado_at) : '—'}</td>
                </tr>
              ))}
              {detalle.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Sin referidos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
