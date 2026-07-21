import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Search, Users, Coins, Ban, CheckCircle2, X } from 'lucide-react'

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [ajuste, setAjuste] = useState<any>(null)   // usuario en modal de folios
  const [delta, setDelta] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('profiles')
      .select('id,email,nombre,empresa,plan,folios_balance,activo,workspace_id,is_admin,created_at')
      .order('created_at', { ascending: false })
    setUsuarios(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const aplicarAjuste = async () => {
    if (!ajuste || delta === 0) return
    if (!ajuste.workspace_id) { toast.error('El usuario no tiene workspace'); return }
    setSaving(true)
    const { error } = await supabase.rpc('ajustar_folios', { ws: ajuste.workspace_id, delta, motivo: motivo || 'Ajuste manual' })
    if (error) toast.error('No se pudo ajustar: ' + error.message)
    else { toast.success(`${delta > 0 ? '+' : ''}${delta} folios aplicados`); setAjuste(null); setDelta(0); setMotivo(''); load() }
    setSaving(false)
  }

  const toggleBloqueo = async (u: any) => {
    const bloquear = u.activo !== false
    if (!confirm(bloquear ? `¿Bloquear a ${u.email}?` : `¿Reactivar a ${u.email}?`)) return
    const { error } = await supabase.rpc('admin_bloquear_usuario', { uid: u.id, bloquear })
    if (error) toast.error('No se pudo cambiar')
    else { toast.success(bloquear ? 'Usuario bloqueado' : 'Usuario reactivado'); load() }
  }

  const filtered = usuarios.filter(u =>
    [u.email, u.nombre, u.empresa].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Usuarios</h1>
        <p className="text-slate-500 text-sm">{usuarios.length} cuentas registradas en la plataforma.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por email, nombre o empresa..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-navy-900 font-medium">Sin resultados</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                <th className="px-6 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Folios</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-navy-900">{u.nombre ?? '—'}</p>
                      {u.is_admin && <span className="badge bg-navy-100 text-navy-700 text-[10px]">Admin</span>}
                    </div>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.empresa ?? '—'}</td>
                  <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600 capitalize">{u.plan ?? 'gratis'}</span></td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{u.folios_balance ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.activo === false ? 'bg-red-50 text-red-600' : 'bg-success-50 text-success-600'}`}>{u.activo === false ? 'Bloqueado' : 'Activo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setAjuste(u); setDelta(0); setMotivo('') }} title="Ajustar folios" className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Coins className="w-4 h-4" /></button>
                      {!u.is_admin && (
                        <button onClick={() => toggleBloqueo(u)} title={u.activo === false ? 'Reactivar' : 'Bloquear'} className={`p-1.5 rounded-lg ${u.activo === false ? 'text-slate-400 hover:text-success-600 hover:bg-success-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}>
                          {u.activo === false ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal ajuste de folios */}
      {ajuste && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Ajustar folios</h2>
              <button onClick={() => setAjuste(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-500">{ajuste.email} · saldo actual <strong className="text-navy-900">{ajuste.folios_balance ?? 0}</strong></p>
              <div>
                <label className="label">Cantidad (usa negativo para restar)</label>
                <div className="flex gap-2">
                  {[10, 25, 100, -10].map(n => (
                    <button key={n} type="button" onClick={() => setDelta(n)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${delta === n ? 'bg-navy-900 text-white' : 'bg-fondo text-slate-600'}`}>{n > 0 ? `+${n}` : n}</button>
                  ))}
                </div>
                <input type="number" className="input mt-2" value={delta} onChange={e => setDelta(Number(e.target.value))} />
              </div>
              <div><label className="label">Motivo</label><input className="input" placeholder="Cortesía, corrección..." value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
              <p className="text-xs text-slate-400">Nuevo saldo: <strong>{Math.max((ajuste.folios_balance ?? 0) + delta, 0)}</strong></p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAjuste(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button onClick={aplicarAjuste} disabled={saving || delta === 0} className="btn-navy flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />} Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
