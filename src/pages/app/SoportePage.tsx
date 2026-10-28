import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDatetime } from '../../lib/utils'
import { urlFirmado } from '../../lib/storage'
import toast from 'react-hot-toast'
import Modal from '../../components/Modal'
import { HelpCircle, Plus, MessageCircle, ImagePlus, Send } from 'lucide-react'

const ESTADO_KEY: Record<string, string> = {
  abierto: 'sop.estAbierto', en_progreso: 'sop.estEnProgreso', resuelto: 'sop.estResuelto', cerrado: 'sop.estCerrado',
}

export default function SoportePage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '' })
  const [imagen, setImagen] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Conversación (hilo) del ticket seleccionado.
  const [abierto, setAbierto] = useState<any>(null)
  const [mensajes, setMensajes] = useState<any[]>([])
  const [respuesta, setRespuesta] = useState('')
  const [imgResp, setImgResp] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const respFileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('soporte_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setTickets(data ?? [])
  }
  useEffect(() => { load() }, [user])

  // Carga los mensajes y resuelve un URL firmado por cada imagen (bucket privado).
  const cargarMensajes = async (ticketId: string) => {
    const { data } = await supabase.from('soporte_mensajes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    const conUrl = await Promise.all((data ?? []).map(async (m: any) => ({
      ...m, imagen_view: m.imagen_url ? await urlFirmado(m.imagen_url) : null,
    })))
    setMensajes(conUrl)
  }

  const abrirConversacion = async (tk: any) => {
    setAbierto(tk)
    setRespuesta(''); setImgResp(null)
    if (respFileRef.current) respFileRef.current.value = ''
    await cargarMensajes(tk.id)
  }

  const elegirImagen = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error(t('sop.imagenGrande')); return }
    setter(f)
  }

  const subirImagen = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const ruta = `${profile!.workspace_id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('soporte').upload(ruta, file, { contentType: file.type })
    if (error) throw error
    return supabase.storage.from('soporte').getPublicUrl(ruta).data.publicUrl
  }

  const cerrarModal = () => {
    setModal(false)
    setForm({ titulo: '', descripcion: '' })
    setImagen(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile?.workspace_id) return
    setSaving(true)
    try {
      let imagen_url: string | null = null
      if (imagen) imagen_url = await subirImagen(imagen)

      const { data: ticket, error } = await supabase.from('soporte_tickets')
        .insert({ ...form, imagen_url, prioridad: 'normal', estado: 'abierto', user_id: user.id, workspace_id: profile.workspace_id })
        .select().single()
      if (error) throw error

      // Primer mensaje del hilo (la descripción del usuario).
      await supabase.from('soporte_mensajes').insert({
        ticket_id: ticket.id, workspace_id: profile.workspace_id, user_id: user.id, es_admin: false,
        mensaje: form.descripcion || form.titulo, imagen_url,
      })

      toast.success(t('sop.ticketCreado'))
      cerrarModal()
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  const enviarRespuesta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile?.workspace_id || !abierto) return
    if (!respuesta.trim() && !imgResp) return
    setEnviando(true)
    try {
      let imagen_url: string | null = null
      if (imgResp) imagen_url = await subirImagen(imgResp)

      await supabase.from('soporte_mensajes').insert({
        ticket_id: abierto.id, workspace_id: profile.workspace_id, user_id: user.id, es_admin: false,
        mensaje: respuesta.trim() || null, imagen_url,
      })
      // El usuario respondió: reabre el ticket para que el equipo lo vea pendiente.
      await supabase.from('soporte_tickets').update({ estado: 'abierto', updated_at: new Date().toISOString() }).eq('id', abierto.id)

      setRespuesta(''); setImgResp(null)
      if (respFileRef.current) respFileRef.current.value = ''
      toast.success(t('sop.respuestaEnviada'))
      await cargarMensajes(abierto.id)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Error')
    } finally {
      setEnviando(false)
    }
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
          <h1 className="text-2xl font-bold text-slate-800">{t('sop.title')}</h1>
          <p className="text-slate-500 text-sm">{t('sop.subtitle')}</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus className="w-4 h-4" aria-hidden="true" /> {t('sop.nuevoTicket')}</button>
      </div>

      <div className="card p-5 bg-gradient-to-r from-primary-50 to-navy-50 border-primary-200">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-primary-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">{t('sop.ayudaInmediata')}</p>
            <p className="text-xs text-slate-500">WhatsApp: <a href="https://wa.me/521234567890" className="text-primary-700 hover:underline">+52 123 456 7890</a></p>
          </div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card p-10 text-center">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium">{t('sop.sinTickets')}</p>
          <p className="text-slate-500 text-sm">{t('sop.sinTicketsSub')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(tk => (
            <button key={tk.id} onClick={() => abrirConversacion(tk)} className="card p-4 w-full text-left hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{tk.titulo}</p>
                  {tk.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tk.descripcion}</p>}
                  <p className="text-xs text-primary-700 mt-2 font-medium flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('sop.verConversacion')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{formatDatetime(tk.created_at)}</p>
                </div>
                <span className={`badge flex-shrink-0 ${estadoColor[tk.estado] ?? 'bg-slate-100 text-slate-600'}`}>{ESTADO_KEY[tk.estado] ? t(ESTADO_KEY[tk.estado]) : tk.estado.replace('_', ' ')}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de conversación */}
      {abierto && (
        <Modal ancho="max-w-lg" onClose={() => setAbierto(null)} titulo={abierto.titulo}>
            <span className={`badge -mt-2 mb-3 ${estadoColor[abierto.estado] ?? 'bg-slate-100 text-slate-600'}`}>{ESTADO_KEY[abierto.estado] ? t(ESTADO_KEY[abierto.estado]) : abierto.estado}</span>

            {/* Hilo */}
            <div className="-mx-5 max-h-[50dvh] overflow-y-auto p-5 space-y-3 bg-slate-50">
              {mensajes.map(m => (
                <div key={m.id} className={`flex ${m.es_admin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${m.es_admin ? 'bg-green-50 border border-green-200' : 'bg-primary-500 text-navy-900'}`}>
                    <p className={`text-[11px] font-medium mb-1 ${m.es_admin ? 'text-green-700' : 'text-navy-900/80'}`}>
                      {m.es_admin ? t('sop.respuestaEquipo') : t('sop.tu')}
                    </p>
                    {m.mensaje && <p className={`text-sm whitespace-pre-wrap ${m.es_admin ? 'text-green-800' : 'text-navy-900'}`}>{m.mensaje}</p>}
                    {m.imagen_url && m.imagen_view && (
                      <a href={m.imagen_view} target="_blank" rel="noreferrer" className="inline-block mt-2">
                        <img src={m.imagen_view} alt="" className="max-h-32 w-auto rounded-lg border border-black/10 object-cover" />
                      </a>
                    )}
                    <p className={`text-[11px] mt-1 ${m.es_admin ? 'text-green-700' : 'text-navy-900/75'}`}>{formatDatetime(m.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Responder */}
            <form onSubmit={enviarRespuesta} className="-mx-5 -mb-5 p-4 border-t space-y-2">
              {imgResp && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <img src={URL.createObjectURL(imgResp)} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  <span className="text-xs text-slate-500 truncate flex-1">{imgResp.name}</span>
                  <button type="button" onClick={() => { setImgResp(null); if (respFileRef.current) respFileRef.current.value = '' }} className="text-xs text-red-700 hover:underline shrink-0">{t('sop.quitar')}</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea aria-label={t('sop.escribePh')} className="input resize-none flex-1" rows={2} value={respuesta}
                  onChange={e => setRespuesta(e.target.value)} placeholder={t('sop.escribePh')} />
                <label className="btn-secondary cursor-pointer !px-3 shrink-0 focus-within:ring-2 focus-within:ring-primary-500" title={t('sop.adjuntar')}>
                  <ImagePlus className="w-4 h-4" aria-hidden="true" />
                  <input ref={respFileRef} type="file" accept="image/*" aria-label={t('sop.adjuntar')} className="sr-only" onChange={elegirImagen(setImgResp)} />
                </label>
                <button type="submit" disabled={enviando || (!respuesta.trim() && !imgResp)} aria-label={t('sop.responder')} className="btn-primary !px-3 shrink-0">
                  {enviando ? <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Modal nuevo ticket */}
      {modal && (
        <Modal ancho="max-w-md" onClose={cerrarModal} sinCerrar={saving} titulo={t('sop.nuevoTicketModal')}>
            <form onSubmit={handleSave} className="space-y-3">
              <div><label htmlFor="sop-asunto" className="label">{t('sop.asunto')}</label><input id="sop-asunto" className="input" required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder={t('sop.asuntoPh')} /></div>
              <div><label htmlFor="sop-descripcion" className="label">{t('sop.descripcion')}</label><textarea id="sop-descripcion" className="input resize-none" rows={4} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder={t('sop.descripcionPh')} /></div>
              <div>
                <p className="label">{t('sop.imagen')}</p>
                {imagen ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                    <img src={URL.createObjectURL(imagen)} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    <span className="text-xs text-slate-500 truncate flex-1">{imagen.name}</span>
                    <button type="button" onClick={() => { setImagen(null); if (fileRef.current) fileRef.current.value = '' }} className="text-xs text-red-700 hover:underline shrink-0">{t('sop.quitar')}</button>
                  </div>
                ) : (
                  <label className="btn-secondary cursor-pointer text-xs w-full justify-center focus-within:ring-2 focus-within:ring-primary-500">
                    <ImagePlus className="w-4 h-4" aria-hidden="true" /> {t('sop.adjuntar')}
                    <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={elegirImagen(setImagen)} />
                  </label>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cerrarModal} className="btn-secondary flex-1 justify-center">{t('sop.cancelar')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving && <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? t('sop.enviando') : t('sop.enviar')}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
