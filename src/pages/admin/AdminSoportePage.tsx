import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDatetime } from '../../lib/utils'
import toast from 'react-hot-toast'
import { X, LifeBuoy, Send, Check } from 'lucide-react'

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-blue-50 text-blue-600',
  en_progreso: 'bg-amber-50 text-amber-600',
  resuelto: 'bg-success-50 text-success-600',
  cerrado: 'bg-slate-100 text-slate-500',
}
const COLOR_PRIORIDAD: Record<string, string> = {
  urgente: 'bg-red-50 text-red-600',
  alta: 'bg-orange-50 text-orange-600',
  media: 'bg-slate-100 text-slate-600',
  baja: 'bg-slate-100 text-slate-500',
}

export default function AdminSoportePage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [respuesta, setRespuesta] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'todos' | 'resuelto'>('pendientes')

  const load = async () => {
    const [{ data: ts }, { data: us }] = await Promise.all([
      supabase.from('soporte_tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,nombre,email'),
    ])
    const u: Record<string, any> = {}
    ;(us ?? []).forEach((x: any) => { u[x.id] = x })
    setTickets(ts ?? []); setUsuarios(u); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const abiertos = tickets.filter(t => t.estado === 'abierto').length
  const enProgreso = tickets.filter(t => t.estado === 'en_progreso').length
  const urgentes = tickets.filter(t => t.prioridad === 'urgente' && !['resuelto', 'cerrado'].includes(t.estado)).length

  const visibles = useMemo(() => {
    if (filtro === 'todos') return tickets
    if (filtro === 'resuelto') return tickets.filter(t => ['resuelto', 'cerrado'].includes(t.estado))
    return tickets.filter(t => !['resuelto', 'cerrado'].includes(t.estado))
  }, [tickets, filtro])

  const responder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('soporte_tickets').update({
      respuesta, estado: 'resuelto', updated_at: new Date().toISOString(),
    }).eq('id', selected.id)
    if (error) toast.error('No se pudo guardar: ' + error.message)
    else { toast.success('Ticket resuelto'); setSelected(null); setRespuesta(''); load() }
    setSaving(false)
  }

  const cambiarEstado = async (t: any, estado: string) => {
    await supabase.from('soporte_tickets').update({ estado, updated_at: new Date().toISOString() }).eq('id', t.id)
    load()
  }

  const kpis = [
    { label: 'Abiertos', value: abiertos },
    { label: 'En progreso', value: enProgreso },
    { label: 'Urgentes sin resolver', value: urgentes },
    { label: 'Total histórico', value: tickets.length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Soporte</h1>
        <p className="text-slate-500 text-sm">Atiende las solicitudes que levantan tus usuarios.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{k.label}</p>
            <p className={`text-xl font-extrabold mt-1 ${k.label === 'Urgentes sin resolver' && k.value > 0 ? 'text-red-600' : 'text-navy-900'}`}>
              {loading ? '—' : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([['pendientes', 'Pendientes'], ['resuelto', 'Resueltos'], ['todos', 'Todos']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-navy-900 font-medium">
            {tickets.length === 0 ? 'Sin tickets todavía' : filtro === 'pendientes' ? 'Todo al día' : 'Sin resultados'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filtro === 'pendientes' && tickets.length > 0 ? 'No hay tickets pendientes por atender.' : 'Aquí aparecerán las solicitudes de tus usuarios.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Asunto</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Prioridad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(t => {
                  const u = usuarios[t.user_id]
                  const cerrado = ['resuelto', 'cerrado'].includes(t.estado)
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50 ${cerrado ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-3">
                        <p className="font-medium text-navy-900">{t.titulo}</p>
                        {t.descripcion && <p className="text-xs text-slate-400 max-w-md truncate">{t.descripcion}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{u?.nombre ?? '—'}</p>
                        {u?.email && <p className="text-xs text-slate-400">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${COLOR_PRIORIDAD[t.prioridad] ?? 'bg-slate-100 text-slate-600'}`}>{t.prioridad}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${COLOR_ESTADO[t.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                          {String(t.estado).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDatetime(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {t.estado === 'abierto' && (
                            <button onClick={() => cambiarEstado(t, 'en_progreso')} className="btn-secondary text-xs py-1 px-3">Tomar</button>
                          )}
                          {!cerrado && (
                            <button onClick={() => { setSelected(t); setRespuesta(t.respuesta ?? '') }} className="btn-navy text-xs py-1 px-3">Responder</button>
                          )}
                          {cerrado && t.respuesta && (
                            <button onClick={() => { setSelected(t); setRespuesta(t.respuesta) }} className="btn-secondary text-xs py-1 px-3">Ver</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Responder ticket</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-fondo rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-navy-900 text-sm">{selected.titulo}</p>
                  <span className={`badge shrink-0 ${COLOR_PRIORIDAD[selected.prioridad] ?? 'bg-slate-100 text-slate-600'}`}>{selected.prioridad}</span>
                </div>
                {selected.descripcion && <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{selected.descripcion}</p>}
                <p className="text-[11px] text-slate-400 mt-3">
                  {usuarios[selected.user_id]?.nombre ?? 'Usuario'}
                  {usuarios[selected.user_id]?.email ? ` · ${usuarios[selected.user_id].email}` : ''}
                  {' · '}{formatDatetime(selected.created_at)}
                </p>
              </div>

              <form onSubmit={responder} className="space-y-3">
                <div>
                  <label className="label">Respuesta</label>
                  <textarea className="input resize-none" rows={5} required value={respuesta}
                    onChange={e => setRespuesta(e.target.value)} placeholder="Escribe tu respuesta..." />
                </div>
                <p className="text-[11px] text-amber-600">
                  La respuesta queda guardada en el ticket y el usuario la ve en su panel. Todavía no se le envía por correo.
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1 justify-center">Cerrar</button>
                  <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                    {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : ['resuelto', 'cerrado'].includes(selected.estado) ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    Guardar y resolver
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
