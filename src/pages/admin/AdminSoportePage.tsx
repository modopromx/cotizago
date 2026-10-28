import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { formatDatetime } from '../../lib/utils'
import { urlFirmado } from '../../lib/storage'
import toast from 'react-hot-toast'
import { LifeBuoy, Send, Check } from 'lucide-react'
import Modal from '../../components/Modal'

const ESTADO_KEY: Record<string, string> = {
  abierto: 'adm.sop.estAbierto', en_progreso: 'adm.sop.estEnProgreso', resuelto: 'adm.sop.estResuelto', cerrado: 'adm.sop.estCerrado',
}
const PRIORIDAD_KEY: Record<string, string> = {
  urgente: 'adm.sop.prUrgente', alta: 'adm.sop.prAlta', media: 'adm.sop.prMedia', baja: 'adm.sop.prBaja', normal: 'adm.sop.prNormal',
}

const COLOR_ESTADO: Record<string, string> = {
  abierto: 'bg-blue-50 text-blue-600',
  en_progreso: 'bg-amber-50 text-amber-700',
  resuelto: 'bg-success-50 text-success-700',
  cerrado: 'bg-slate-100 text-slate-500',
}
const COLOR_PRIORIDAD: Record<string, string> = {
  urgente: 'bg-red-50 text-red-700',
  alta: 'bg-orange-50 text-orange-600',
  media: 'bg-slate-100 text-slate-600',
  baja: 'bg-slate-100 text-slate-500',
}

export default function AdminSoportePage() {
  const { t: tr } = useTranslation()
  const [tickets, setTickets] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [respuesta, setRespuesta] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'todos' | 'resuelto'>('pendientes')

  const load = async () => {
    const [{ data: ts }, { data: us }] = await Promise.all([
      supabase.from('soporte_tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,nombre,email,empresa'),
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

  const abrir = async (t: any) => {
    setSelected(t); setRespuesta('')
    const { data } = await supabase.from('soporte_mensajes').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true })
    // Resuelve un URL firmado por cada imagen (bucket privado).
    const conUrl = await Promise.all((data ?? []).map(async (m: any) => ({
      ...m, imagen_view: m.imagen_url ? await urlFirmado(m.imagen_url) : null,
    })))
    setMensajes(conUrl)
  }

  // resolver=false: publica la respuesta y deja el ticket EN PROGRESO (sigue el
  // soporte). resolver=true: además lo marca como resuelto.
  const responder = async (resolver: boolean) => {
    if (!selected || !respuesta.trim()) return
    setSaving(true)
    // Publica el mensaje del equipo en el hilo.
    const { error: msgErr } = await supabase.from('soporte_mensajes').insert({
      ticket_id: selected.id, workspace_id: selected.workspace_id, es_admin: true, mensaje: respuesta.trim(),
    })
    if (msgErr) { toast.error(tr('adm.sop.noGuardar') + msgErr.message); setSaving(false); return }
    // Actualiza el ticket (guarda la última respuesta y el estado).
    const { error } = await supabase.from('soporte_tickets').update({
      respuesta: respuesta.trim(), estado: resolver ? 'resuelto' : 'en_progreso', updated_at: new Date().toISOString(),
    }).eq('id', selected.id)
    if (error) toast.error(tr('adm.sop.noGuardar') + error.message)
    else { toast.success(resolver ? tr('adm.sop.ticketResuelto') : tr('adm.sop.respuestaEnviada')); setSelected(null); setRespuesta(''); setMensajes([]); load() }
    setSaving(false)
  }

  const cambiarEstado = async (t: any, estado: string) => {
    await supabase.from('soporte_tickets').update({ estado, updated_at: new Date().toISOString() }).eq('id', t.id)
    load()
  }

  const kpis = [
    { key: 'abiertos', label: tr('adm.sop.kAbiertos'), value: abiertos },
    { key: 'enProgreso', label: tr('adm.sop.kEnProgreso'), value: enProgreso },
    { key: 'urgentes', label: tr('adm.sop.kUrgentes'), value: urgentes },
    { key: 'total', label: tr('adm.sop.kTotal'), value: tickets.length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{tr('adm.sop.title')}</h1>
        <p className="text-slate-500 text-sm">{tr('adm.sop.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.key} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k.label}</p>
            <p className={`text-xl font-extrabold mt-1 ${k.key === 'urgentes' && k.value > 0 ? 'text-red-700' : 'text-navy-900'}`}>
              {loading ? '—' : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([['pendientes', tr('adm.sop.fPendientes')], ['resuelto', tr('adm.sop.fResueltos')], ['todos', tr('adm.sop.fTodos')]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{tr('adm.cargando')}</div>
      ) : visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">
            {tickets.length === 0 ? tr('adm.sop.sinTickets') : filtro === 'pendientes' ? tr('adm.sop.todoAlDia') : tr('adm.sop.sinResultados')}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {filtro === 'pendientes' && tickets.length > 0 ? tr('adm.sop.noPendientes') : tr('adm.sop.aparecerSolicitudes')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">{tr('adm.sop.colAsunto')}</th>
                  <th className="px-4 py-3 font-medium">{tr('adm.sop.colUsuario')}</th>
                  <th className="px-4 py-3 font-medium">{tr('adm.sop.colPrioridad')}</th>
                  <th className="px-4 py-3 font-medium">{tr('adm.sop.colEstado')}</th>
                  <th className="px-4 py-3 font-medium">{tr('adm.sop.colFecha')}</th>
                  <th className="px-4 py-3 font-medium text-right">{tr('adm.sop.colAccion')}</th>
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
                        {t.descripcion && <p className="text-xs text-slate-500 max-w-md truncate">{t.descripcion}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{u?.nombre?.trim() || u?.empresa?.trim() || u?.email?.split('@')[0] || '—'}</p>
                        {u?.email && <p className="text-xs text-slate-500">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${COLOR_PRIORIDAD[t.prioridad] ?? 'bg-slate-100 text-slate-600'}`}>{PRIORIDAD_KEY[t.prioridad] ? tr(PRIORIDAD_KEY[t.prioridad]) : t.prioridad}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${COLOR_ESTADO[t.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                          {ESTADO_KEY[t.estado] ? tr(ESTADO_KEY[t.estado]) : String(t.estado).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDatetime(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {t.estado === 'abierto' && (
                            <button type="button" onClick={() => cambiarEstado(t, 'en_progreso')} className="btn-secondary text-xs py-1 px-3">{tr('adm.sop.tomar')}</button>
                          )}
                          {!cerrado && (
                            <button type="button" onClick={() => abrir(t)} className="btn-navy text-xs py-1 px-3">{tr('adm.sop.responder')}</button>
                          )}
                          {cerrado && (
                            <button type="button" onClick={() => abrir(t)} className="btn-secondary text-xs py-1 px-3">{tr('adm.sop.ver')}</button>
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
        <Modal titulo={tr('adm.sop.responderTicket')} onClose={() => setSelected(null)} sinCerrar={saving}>
            <div className="space-y-4">
              <div className="bg-fondo rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-navy-900 text-sm">{selected.titulo}</p>
                  <span className={`badge shrink-0 ${COLOR_PRIORIDAD[selected.prioridad] ?? 'bg-slate-100 text-slate-600'}`}>{PRIORIDAD_KEY[selected.prioridad] ? tr(PRIORIDAD_KEY[selected.prioridad]) : selected.prioridad}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {usuarios[selected.user_id]?.nombre ?? usuarios[selected.user_id]?.email ?? tr('shell.usuario')}
                  {' · '}{formatDatetime(selected.created_at)}
                </p>
              </div>

              {/* Hilo de conversación */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">{tr('adm.sop.conversacion')}</p>
                <div className="space-y-2 max-h-64 overflow-y-auto bg-slate-50 rounded-xl p-3">
                  {mensajes.map(m => (
                    <div key={m.id} className={`flex ${m.es_admin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.es_admin ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200'}`}>
                        <p className={`text-[10px] font-medium mb-0.5 ${m.es_admin ? 'text-white/70' : 'text-slate-500'}`}>
                          {m.es_admin ? tr('adm.sop.deEquipo') : tr('adm.sop.deUsuario')}
                        </p>
                        {m.mensaje && <p className={`text-sm whitespace-pre-wrap ${m.es_admin ? 'text-white' : 'text-navy-900'}`}>{m.mensaje}</p>}
                        {m.imagen_url && m.imagen_view && (
                          <a href={m.imagen_view} target="_blank" rel="noreferrer" title={tr('adm.sop.verAdjunto')} className="inline-block mt-2">
                            <img src={m.imagen_view} alt="" className="max-h-36 w-auto rounded-lg border border-black/10 object-cover hover:opacity-90 transition-opacity" />
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 ${m.es_admin ? 'text-white/50' : 'text-slate-500'}`}>{formatDatetime(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="sop-respuesta">{tr('adm.sop.respuesta')}</label>
                  <textarea id="sop-respuesta" className="input resize-none" rows={5} required value={respuesta}
                    onChange={e => setRespuesta(e.target.value)} placeholder={tr('adm.sop.respuestaPh')} />
                </div>
                <p className="text-[11px] text-amber-700">
                  {tr('adm.sop.avisoRespuesta')}
                </p>
                {/* Dos acciones: responder y seguir (queda en progreso) o resolver. */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => responder(false)} disabled={saving || !respuesta.trim()} className="btn-secondary flex-1 justify-center">
                    <Send className="w-4 h-4" aria-hidden="true" /> {tr('adm.sop.soloResponder')}
                  </button>
                  <button type="button" onClick={() => responder(true)} disabled={saving || !respuesta.trim()} aria-busy={saving} className="btn-navy flex-1 justify-center">
                    {saving ? <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                    {tr('adm.sop.guardarResolver')}
                  </button>
                </div>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
