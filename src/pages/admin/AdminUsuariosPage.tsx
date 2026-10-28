import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Search, Users, Coins, Ban, CheckCircle2 } from 'lucide-react'
import Modal from '../../components/Modal'

export default function AdminUsuariosPage() {
  const { t } = useTranslation()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [ajuste, setAjuste] = useState<any>(null)   // usuario en modal de folios
  // Texto: con número, «|| 0» impedía borrar el campo o empezar con «-».
  const [deltaTxt, setDeltaTxt] = useState('0')
  const delta = parseInt(deltaTxt, 10) || 0
  const setDelta = (n: number) => setDeltaTxt(String(n))
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
    if (!ajuste.workspace_id) { toast.error(t('adm.usuarios.sinWorkspace')); return }
    setSaving(true)
    const { error } = await supabase.rpc('ajustar_folios', { ws: ajuste.workspace_id, delta, motivo: motivo || t('adm.usuarios.ajusteManual') })
    if (error) toast.error(t('adm.usuarios.noAjustar') + error.message)
    else { toast.success(t('adm.usuarios.foliosAplicados', { delta: `${delta > 0 ? '+' : ''}${delta}` })); setAjuste(null); setDelta(0); setMotivo(''); load() }
    setSaving(false)
  }

  const toggleBloqueo = async (u: any) => {
    const bloquear = u.activo !== false
    if (!confirm(bloquear ? t('adm.usuarios.confBloquear', { email: u.email }) : t('adm.usuarios.confReactivar', { email: u.email }))) return
    const { error } = await supabase.rpc('admin_bloquear_usuario', { uid: u.id, bloquear })
    if (error) toast.error(t('adm.usuarios.noCambiar'))
    else { toast.success(bloquear ? t('adm.usuarios.bloqueadoOk') : t('adm.usuarios.reactivadoOk')); load() }
  }

  const filtered = usuarios.filter(u =>
    [u.email, u.nombre, u.empresa].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('adm.usuarios.title')}</h1>
        <p className="text-slate-500 text-sm">{t('adm.usuarios.subtitle', { n: usuarios.length })}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
        <input className="input pl-9" type="search" aria-label={t('adm.usuarios.buscar')} placeholder={t('adm.usuarios.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" /><p className="text-navy-900 font-medium">{t('adm.usuarios.sinResultados')}</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                <th className="px-6 py-3 font-medium">{t('adm.usuarios.colUsuario')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.usuarios.colEmpresa')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.usuarios.colPlan')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.usuarios.colFolios')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.usuarios.colEstado')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('adm.usuarios.colAcciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-navy-900">{u.nombre?.trim() || u.empresa?.trim() || u.email?.split('@')[0] || '—'}</p>
                      {u.is_admin && <span className="badge bg-navy-100 text-navy-700 text-[10px]">{t('adm.usuarios.admin')}</span>}
                    </div>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.empresa ?? '—'}</td>
                  <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600 capitalize">{u.plan ?? 'gratis'}</span></td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{u.folios_balance ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.activo === false ? 'bg-red-50 text-red-700' : 'bg-success-50 text-success-700'}`}>{u.activo === false ? t('adm.usuarios.bloqueado') : t('adm.usuarios.activo')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => { setAjuste(u); setDelta(0); setMotivo('') }} title={t('adm.usuarios.ttAjustar')} aria-label={`${t('adm.usuarios.ttAjustar')}: ${u.email}`} className="p-1.5 text-slate-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg"><Coins className="w-4 h-4" aria-hidden="true" /></button>
                      {!u.is_admin && (
                        <button type="button" onClick={() => toggleBloqueo(u)} title={u.activo === false ? t('adm.usuarios.ttReactivar') : t('adm.usuarios.ttBloquear')} aria-label={`${u.activo === false ? t('adm.usuarios.ttReactivar') : t('adm.usuarios.ttBloquear')}: ${u.email}`} className={`p-1.5 rounded-lg ${u.activo === false ? 'text-slate-500 hover:text-success-600 hover:bg-success-50' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}>
                          {u.activo === false ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Ban className="w-4 h-4" aria-hidden="true" />}
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
        <Modal titulo={t('adm.usuarios.ajustarFolios')} onClose={() => setAjuste(null)} sinCerrar={saving} ancho="max-w-sm">
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{ajuste.email} · {t('adm.usuarios.saldoActual')} <strong className="text-navy-900">{ajuste.folios_balance ?? 0}</strong></p>
              <div>
                <label className="label" htmlFor="ajuste-cantidad">{t('adm.usuarios.cantidad')}</label>
                <div className="flex gap-2">
                  {[10, 25, 100, -10].map(n => (
                    <button key={n} type="button" onClick={() => setDelta(n)} aria-pressed={delta === n} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${delta === n ? 'bg-navy-900 text-white' : 'bg-fondo text-slate-600'}`}>{n > 0 ? `+${n}` : n}</button>
                  ))}
                </div>
                <input id="ajuste-cantidad" type="number" inputMode="numeric" step="1" className="input mt-2" value={deltaTxt} onChange={e => setDeltaTxt(e.target.value)} />
              </div>
              <div><label className="label" htmlFor="ajuste-motivo">{t('adm.usuarios.motivo')}</label><input id="ajuste-motivo" className="input" placeholder={t('adm.usuarios.motivoPh')} value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
              <p className="text-xs text-slate-500" aria-live="polite">{t('adm.usuarios.nuevoSaldo')} <strong>{Math.max((ajuste.folios_balance ?? 0) + delta, 0)}</strong></p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAjuste(null)} disabled={saving} className="btn-secondary flex-1 justify-center">{t('adm.usuarios.cancelar')}</button>
                <button type="button" onClick={aplicarAjuste} disabled={saving || delta === 0} aria-busy={saving} className="btn-navy flex-1 justify-center">
                  {saving && <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />} {t('adm.usuarios.aplicar')}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
