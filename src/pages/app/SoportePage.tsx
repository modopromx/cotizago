import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDatetime } from '../../lib/utils'
import toast from 'react-hot-toast'
import { HelpCircle, Plus, X, MessageCircle } from 'lucide-react'

export default function SoportePage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'normal' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('soporte_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setTickets(data ?? [])
  }

  useEffect(() => { load() }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    await supabase.from('soporte_tickets').insert({ ...form, user_id: user.id })
    toast.success('Ticket creado. Te responderemos pronto.')
    setModal(false)
    setForm({ titulo: '', descripcion: '', prioridad: 'normal' })
    load()
    setSaving(false)
  }

  const estadoColor: Record<string, string> = {
    abierto: 'bg-blue-100 text-blue-700',
    en_progreso: 'bg-yellow-100 text-yellow-700',
    resuelto: 'bg-green-100 text-green-700',
    cerrado: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Soporte</h1>
          <p className="text-slate-500 text-sm">¿Tienes algún problema? Estamos para ayudarte</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> Nuevo ticket</button>
      </div>

      <div className="card p-5 bg-gradient-to-r from-primary-50 to-navy-50 border-primary-200">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-primary-600" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">¿Necesitas ayuda inmediata?</p>
            <p className="text-xs text-slate-500">WhatsApp: <a href="https://wa.me/521234567890" className="text-primary-600 hover:underline">+52 123 456 7890</a></p>
          </div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card p-10 text-center">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Sin tickets aún</p>
          <p className="text-slate-400 text-sm">Si tienes algún problema, créa un ticket y te ayudamos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">{t.titulo}</p>
                  {t.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.descripcion}</p>}
                  {t.respuesta && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-700 mb-1">Respuesta del equipo:</p>
                      <p className="text-xs text-green-700">{t.respuesta}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">{formatDatetime(t.created_at)}</p>
                </div>
                <span className={`badge flex-shrink-0 ${estadoColor[t.estado] ?? 'bg-slate-100 text-slate-600'}`}>{t.estado.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">Nuevo ticket de soporte</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div><label className="label">Asunto *</label><input className="input" required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Describe brevemente tu problema" /></div>
              <div><label className="label">Descripción</label><textarea className="input resize-none" rows={4} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Cuéntanos más detalles..." /></div>
              <div><label className="label">Prioridad</label>
                <select className="input" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  <option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Enviar ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
