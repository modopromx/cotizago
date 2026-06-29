import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDatetime } from '../../lib/utils'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function AdminSoportePage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [respuesta, setRespuesta] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('soporte_tickets').select('*').order('created_at', { ascending: false })
    setTickets(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleResponder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    await supabase.from('soporte_tickets').update({ respuesta, estado: 'resuelto', updated_at: new Date().toISOString() }).eq('id', selected.id)
    toast.success('Respuesta enviada')
    setSelected(null)
    setRespuesta('')
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Soporte</h1>
        <p className="text-slate-500 text-sm">{tickets.filter(t => t.estado === 'abierto').length} tickets abiertos</p>
      </div>
      {tickets.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">Sin tickets</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Asunto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Prioridad</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Acción</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.titulo}</td>
                  <td className="px-4 py-3"><span className={`badge ${t.prioridad === 'urgente' ? 'bg-red-100 text-red-700' : t.prioridad === 'alta' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{t.prioridad}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${estadoColor[t.estado]}`}>{t.estado.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDatetime(t.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.estado !== 'resuelto' && t.estado !== 'cerrado' && (
                      <button onClick={() => { setSelected(t); setRespuesta(t.respuesta ?? '') }} className="btn-secondary text-xs py-1 px-3">Responder</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">Responder ticket</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="font-medium text-slate-800 text-sm">{selected.titulo}</p>
                {selected.descripcion && <p className="text-xs text-slate-500 mt-1">{selected.descripcion}</p>}
              </div>
              <form onSubmit={handleResponder} className="space-y-3">
                <div><label className="label">Respuesta</label><textarea className="input resize-none" rows={4} required value={respuesta} onChange={e => setRespuesta(e.target.value)} placeholder="Escribe tu respuesta..." /></div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Enviar respuesta
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
