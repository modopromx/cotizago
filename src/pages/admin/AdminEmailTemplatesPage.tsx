import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { UserPlus, Zap, AlertTriangle, CheckCircle2, FileText, Eye, Pencil, Send, X, Save } from 'lucide-react'

interface Plantilla { id: string; clave: string; asunto: string; cuerpo: string; variables: string[] }

const META: Record<string, { nombre: string; icon: any; color: string }> = {
  bienvenida: { nombre: 'Bienvenida de usuario nuevo', icon: UserPlus, color: 'text-primary-600 bg-primary-50' },
  recordatorio_recarga: { nombre: 'Recordatorio de recarga', icon: Zap, color: 'text-amber-600 bg-amber-50' },
  folios_terminados: { nombre: 'Folios terminados', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  recarga_exitosa: { nombre: 'Recarga de folios exitosa', icon: CheckCircle2, color: 'text-success-600 bg-success-50' },
  cotizacion_enviada: { nombre: 'Envío de cotización (PDF)', icon: FileText, color: 'text-azul-600 bg-azul-50' },
}

// Valores de ejemplo para la vista previa
const EJEMPLO: Record<string, string> = {
  nombre: 'Alan Velázquez', email: 'alan@empresa.mx', folios: '5', plataforma: 'Cotiza Go',
  folios_restantes: '3', link_recarga: 'https://cotiza.go/app/folios',
  referencia: 'REC-10842', paquete: 'Negocio', folios_acreditados: '100', monto: '$499.00',
  fecha: '20 jul 2026', saldo_actual: '103',
  cliente: 'Mariana López', empresa: 'Áurea Visual Studio', folio: 'CTZ-0027', total: '$21,402.00',
  enlace_publico: 'https://cotiza.go/c/abc123', vigencia: '15 días',
  empresa_telefono: '+52 55 1234 5678', empresa_email: 'contacto@aurea.mx', vendedor: 'Alan Velázquez',
}
const render = (txt: string) => txt.replace(/\{\{(\w+)\}\}/g, (_, k) => EJEMPLO[k] ?? `{{${k}}}`)

export default function AdminEmailTemplatesPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [editar, setEditar] = useState<Plantilla | null>(null)
  const [preview, setPreview] = useState<Plantilla | null>(null)
  const [draft, setDraft] = useState({ asunto: '', cuerpo: '' })
  const [saving, setSaving] = useState(false)

  const orden = ['bienvenida', 'recordatorio_recarga', 'folios_terminados', 'recarga_exitosa', 'cotizacion_enviada']

  const load = async () => {
    const { data } = await supabase.from('email_templates').select('*')
    const list = (data ?? []).sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave))
    setPlantillas(list)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const abrirEditar = (p: Plantilla) => { setEditar(p); setDraft({ asunto: p.asunto, cuerpo: p.cuerpo }) }

  const guardar = async () => {
    if (!editar) return
    setSaving(true)
    const { error } = await supabase.from('email_templates')
      .update({ asunto: draft.asunto, cuerpo: draft.cuerpo, updated_at: new Date().toISOString() }).eq('id', editar.id)
    if (error) toast.error('Error al guardar')
    else { toast.success('Plantilla guardada'); setEditar(null); load() }
    setSaving(false)
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Plantillas de email</h1>
        <p className="text-slate-500 text-sm">Gestiona los correos automáticos del sistema.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {plantillas.map(p => {
          const m = META[p.clave] ?? { nombre: p.clave, icon: FileText, color: 'text-slate-600 bg-slate-100' }
          const Icon = m.icon
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{m.nombre}</p>
                  <p className="text-xs text-slate-400 truncate">{p.asunto}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-fondo/60 p-3 h-36 overflow-y-auto text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {p.cuerpo}
              </div>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Variables disponibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.variables ?? []).map(v => <span key={v} className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">{`{{${v}}}`}</span>)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button onClick={() => setPreview(p)} className="btn-secondary justify-center text-xs"><Eye className="w-3.5 h-3.5" /> Vista previa</button>
                <button onClick={() => abrirEditar(p)} className="btn-secondary justify-center text-xs"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                <button onClick={() => toast('Envío de prueba disponible al conectar el email', { icon: '📨' })} className="btn-secondary justify-center text-xs"><Send className="w-3.5 h-3.5" /> Prueba</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal editar */}
      {editar && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Editar: {META[editar.clave]?.nombre ?? editar.clave}</h2>
              <button onClick={() => setEditar(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="label">Asunto</label><input className="input" value={draft.asunto} onChange={e => setDraft(d => ({ ...d, asunto: e.target.value }))} /></div>
              <div><label className="label">Cuerpo</label><textarea className="input resize-none font-mono text-xs leading-relaxed" rows={12} value={draft.cuerpo} onChange={e => setDraft(d => ({ ...d, cuerpo: e.target.value }))} /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {(editar.variables ?? []).map(v => (
                    <button key={v} type="button" onClick={() => setDraft(d => ({ ...d, cuerpo: d.cuerpo + `{{${v}}}` }))} className="text-[11px] font-mono px-2 py-0.5 rounded bg-fondo text-navy-700 hover:bg-primary-100">{`{{${v}}}`}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditar(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
                <button onClick={guardar} disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal vista previa */}
      {preview && (
        <div className="fixed inset-0 bg-navy-950/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Vista previa</h2>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-fondo px-4 py-2 border-b border-slate-200">
                  <p className="text-[11px] text-slate-400">Asunto</p>
                  <p className="text-sm font-medium text-navy-900">{render(preview.asunto)}</p>
                </div>
                <p className="p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{render(preview.cuerpo)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
