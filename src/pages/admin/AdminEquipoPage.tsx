import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Search, ShieldCheck, ShieldOff, Shield, Info } from 'lucide-react'

export default function AdminEquipoPage() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase.from('profiles')
      .select('id,nombre,email,is_admin,activo,created_at')
      .order('is_admin', { ascending: false })
      .order('created_at')
    setUsuarios(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const admins = usuarios.filter(u => u.is_admin)

  const cambiar = async (u: any, esAdmin: boolean) => {
    const accion = esAdmin ? 'dar acceso de administrador a' : 'quitarle el acceso de administrador a'
    if (!confirm(`¿Seguro que quieres ${accion} ${u.nombre || u.email}?`)) return
    setOcupado(u.id)
    const { error } = await supabase.rpc('admin_definir_rol', { p_user: u.id, p_es_admin: esAdmin })
    if (error) toast.error(error.message)
    else { toast.success(esAdmin ? 'Ahora es administrador' : 'Acceso retirado'); load() }
    setOcupado(null)
  }

  const visibles = useMemo(() => {
    const q = search.toLowerCase()
    return usuarios.filter(u => !q || [u.nombre, u.email].some(v => v?.toLowerCase().includes(q)))
  }, [usuarios, search])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Equipo administrador</h1>
        <p className="text-slate-500 text-sm">Quién puede entrar al panel de superadmin.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Administradores</p>
          <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : admins.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Usuarios totales</p>
          <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : usuarios.length}</p>
        </div>
      </div>

      <div className="card p-4 flex items-start gap-3 bg-blue-50/40 border-blue-100">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600">
          El acceso de administrador es sobre la cuenta con la que la persona ya inicia sesión.
          Para sumar a alguien nuevo, pídele que se registre y aquí le das el acceso.
          No puedes quitarte el acceso a ti mismo, y siempre debe quedar al menos un administrador.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">Sin resultados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Persona</th>
                  <th className="px-4 py-3 font-medium">Acceso</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(u => {
                  const yo = u.id === user?.id
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                            u.is_admin ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {(u.nombre || u.email || '?').slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium text-navy-900">
                              {u.nombre || '—'}{yo && <span className="text-xs font-normal text-slate-400"> · tú</span>}
                            </p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${u.is_admin ? 'bg-navy-100 text-navy-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.is_admin ? 'Administrador' : 'Usuario'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {yo ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : u.is_admin ? (
                          <button onClick={() => cambiar(u, false)} disabled={ocupado === u.id}
                            className="btn-secondary text-xs py-1 px-3 text-red-600">
                            <ShieldOff className="w-3.5 h-3.5" /> Quitar acceso
                          </button>
                        ) : (
                          <button onClick={() => cambiar(u, true)} disabled={ocupado === u.id}
                            className="btn-navy text-xs py-1 px-3">
                            <ShieldCheck className="w-3.5 h-3.5" /> Hacer admin
                          </button>
                        )}
                      </td>
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
