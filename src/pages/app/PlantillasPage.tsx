import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, Clock, CheckCircle2, Save } from 'lucide-react'

const VARIABLES = ['{{cliente}}', '{{folio}}', '{{total}}', '{{empresa}}', '{{enlace_publico}}', '{{vendedor}}']

function iconoDe(p: any) {
  if (p.momento === 'envio_inicial') return p.canal === 'email' ? Mail : MessageCircle
  if (p.momento === 'recordatorio') return Clock
  return CheckCircle2
}

export default function PlantillasPage() {
  const { profile } = useAuth()
  const wsId = profile?.workspace_id
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ asunto: string; cuerpo: string }>({ asunto: '', cuerpo: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!wsId) return
    const { data } = await supabase.from('plantillas_mensajes').select('*').eq('workspace_id', wsId).order('canal').order('momento')
    setPlantillas(data ?? [])
    if (data?.length && !selId) { setSelId(data[0].id); setDraft({ asunto: data[0].asunto ?? '', cuerpo: data[0].cuerpo }) }
    setLoading(false)
  }
  useEffect(() => { load() }, [wsId])

  const sel = plantillas.find(p => p.id === selId)

  const seleccionar = (p: any) => { setSelId(p.id); setDraft({ asunto: p.asunto ?? '', cuerpo: p.cuerpo }) }

  const insertarVar = (v: string) => setDraft(d => ({ ...d, cuerpo: d.cuerpo + (d.cuerpo.endsWith(' ') || !d.cuerpo ? '' : ' ') + v }))

  const guardar = async () => {
    if (!sel) return
    setSaving(true)
    const { error } = await supabase.from('plantillas_mensajes')
      .update({ asunto: draft.asunto || null, cuerpo: draft.cuerpo }).eq('id', sel.id)
    if (error) toast.error('Error al guardar')
    else { toast.success(`Plantilla "${sel.nombre}" guardada`); load() }
    setSaving(false)
  }

  const preview = draft.cuerpo
    .replace(/\{\{cliente\}\}/g, 'Mariana López')
    .replace(/\{\{folio\}\}/g, 'CTZ-0027')
    .replace(/\{\{total\}\}/g, '$12,800')
    .replace(/\{\{empresa\}\}/g, profile?.empresa ?? 'Tu Empresa')
    .replace(/\{\{enlace_publico\}\}/g, 'cotiza.go/c/abc123')
    .replace(/\{\{vendedor\}\}/g, profile?.nombre ?? 'Vendedor')

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Plantillas de mensajes</h1>
        <p className="text-slate-500 text-sm">Personaliza los mensajes automáticos para cada canal y momento.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Lista */}
        <div className="space-y-2">
          {plantillas.map(p => {
            const Icon = iconoDe(p)
            const activo = p.id === selId
            return (
              <button key={p.id} onClick={() => seleccionar(p)}
                className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${activo ? 'border-primary-300 bg-primary-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${activo ? 'bg-primary-500 text-white' : 'bg-fondo text-navy-700'}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{p.nombre}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{p.canal} · {p.momento.replace('_', ' ')}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{sel?.canal === 'email' ? 'Email' : 'WhatsApp'}</p>
            {sel?.canal === 'email' && (
              <div><label className="label">Asunto</label><input className="input" value={draft.asunto} onChange={e => setDraft(d => ({ ...d, asunto: e.target.value }))} /></div>
            )}
            <div>
              <label className="label">Mensaje</label>
              <textarea className="input resize-none font-mono text-xs leading-relaxed" rows={9} value={draft.cuerpo} onChange={e => setDraft(d => ({ ...d, cuerpo: e.target.value }))} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Insertar variable</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button key={v} type="button" onClick={() => insertarVar(v)}
                    className="text-[11px] font-mono px-2 py-1 rounded-md bg-fondo text-navy-700 hover:bg-primary-100 transition-colors">{v}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => toast('Envío de prueba disponible al conectar tu canal', { icon: '📨' })} className="btn-secondary flex-1 justify-center text-xs">Enviar prueba</button>
              <button onClick={guardar} disabled={saving} className="btn-navy flex-1 justify-center text-xs">
                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
              </button>
            </div>
          </div>

          {/* Vista previa */}
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Vista previa</p>
            {sel?.canal === 'email' ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-fondo px-4 py-2 border-b border-slate-200">
                  <p className="text-[11px] text-slate-400">Asunto</p>
                  <p className="text-sm font-medium text-navy-900">{draft.asunto.replace(/\{\{folio\}\}/g, 'CTZ-0027').replace(/\{\{empresa\}\}/g, profile?.empresa ?? 'Tu Empresa') || '—'}</p>
                </div>
                <p className="p-4 text-sm text-slate-700 whitespace-pre-wrap">{preview}</p>
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ background: '#e5ddd5' }}>
                <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm max-w-[85%]">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
                  <p className="text-[10px] text-slate-400 text-right mt-1">12:42 ✓✓</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
