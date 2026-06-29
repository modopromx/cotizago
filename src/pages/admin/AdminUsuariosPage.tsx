import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Search, Users, Plus, Edit2, Zap } from 'lucide-react'

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingFolios, setEditingFolios] = useState<string | null>(null)
  const [folioDelta, setFolioDelta] = useState(0)

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsuarios(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAddFolios = async (userId: string, currentBalance: number) => {
    if (folioDelta === 0) return
    await supabase.from('profiles').update({ folios_balance: currentBalance + folioDelta }).eq('id', userId)
    toast.success(`${folioDelta > 0 ? '+' : ''}${folioDelta} folios acreditados`)
    setEditingFolios(null)
    setFolioDelta(0)
    load()
  }

  const handleToggleActivo = async (userId: string, activo: boolean) => {
    await supabase.from('profiles').update({ activo: !activo }).eq('id', userId)
    toast.success(!activo ? 'Usuario activado' : 'Usuario suspendido')
    load()
  }

  const filtered = usuarios.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    u.empresa?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-slate-500 text-sm">{usuarios.length} usuarios registrados</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por email, nombre, empresa..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Folios</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Registro</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.nombre ?? '—'}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.empresa ?? '—'}</td>
                    <td className="px-4 py-3"><span className="badge bg-slate-100 text-slate-600">{u.plan}</span></td>
                    <td className="px-4 py-3">
                      {editingFolios === u.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" className="input w-20 py-1 text-xs" value={folioDelta} onChange={e => setFolioDelta(parseInt(e.target.value) || 0)} />
                          <button onClick={() => handleAddFolios(u.id, u.folios_balance)} className="text-xs px-2 py-1 bg-primary-600 text-white rounded-lg">OK</button>
                          <button onClick={() => { setEditingFolios(null); setFolioDelta(0) }} className="text-xs px-2 py-1 bg-slate-200 rounded-lg">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{u.folios_balance}</span>
                          <button onClick={() => { setEditingFolios(u.id); setFolioDelta(0) }} className="text-primary-600 hover:text-primary-700">
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.activo !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.activo !== false ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleToggleActivo(u.id, u.activo !== false)} className={`text-xs px-3 py-1 rounded-lg ${u.activo !== false ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {u.activo !== false ? 'Suspender' : 'Activar'}
                      </button>
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
