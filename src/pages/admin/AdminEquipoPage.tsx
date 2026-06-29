import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Trash2, X } from 'lucide-react'

export default function AdminEquipoPage() {
  const [team, setTeam] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'admin', departamento: 'Administración' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('admin_team').select('*').order('created_at')
    setTeam(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('admin_team').insert(form)
    toast.success('Miembro agregado')
    setModal(false)
    setForm({ nombre: '', email: '', rol: 'admin', departamento: 'Administración' })
    load()
    setSaving(false)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Equipo Admin</h1>
          <p className="text-slate-500 text-sm">{team.length} miembros del equipo</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Agregar</button>
      </div>
      <div className="space-y-3">
        {team.map(m => (
          <div key={m.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center">
                <span className="text-sm font-bold text-navy-700">{m.nombre[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800">{m.nombre}</p>
                <p className="text-xs text-slate-500">{m.email} · {m.departamento}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-navy-100 text-navy-700">{m.rol}</span>
              <button onClick={async () => { await supabase.from('admin_team').delete().eq('id', m.id); load() }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">Agregar al equipo</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Nombre</label><input className="input" required value={form.nombre} onChange={set('nombre')} /></div>
              <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={set('email')} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Rol</label>
                  <select className="input" value={form.rol} onChange={set('rol')}>
                    <option value="admin">Admin</option><option value="soporte">Soporte</option><option value="ventas">Ventas</option>
                  </select>
                </div>
                <div><label className="label">Departamento</label><input className="input" value={form.departamento} onChange={set('departamento')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
