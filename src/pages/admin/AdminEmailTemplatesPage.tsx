import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Save, Mail, Eye, ChevronDown, ChevronUp, Code } from 'lucide-react'

interface EmailTemplate {
  id: string
  nombre: string
  asunto: string
  cuerpo_html: string
  variables_disponibles: string[]
  updated_at: string
}

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  bienvenida: 'Se envía cuando un nuevo usuario se registra en CotizaGo.',
  cotizacion_enviada: 'Se envía al cliente cuando le compartes una cotización.',
  cotizacion_aceptada: 'Notificación al vendedor cuando el cliente acepta la cotización.',
  pago_exitoso: 'Confirmación de compra de folios vía Stripe.',
}

const TEMPLATE_ICONS: Record<string, string> = {
  bienvenida: '👋',
  cotizacion_enviada: '📄',
  cotizacion_aceptada: '✅',
  pago_exitoso: '💳',
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [edited, setEdited] = useState<Record<string, Partial<EmailTemplate>>>({})

  useEffect(() => {
    supabase.from('email_templates').select('*').order('nombre').then(({ data }) => {
      setTemplates(data ?? [])
      setLoading(false)
      if (data?.length) setExpanded(data[0].id)
    })
  }, [])

  const get = (id: string, field: keyof EmailTemplate) =>
    (edited[id]?.[field] as string) ?? (templates.find(t => t.id === id)?.[field] as string) ?? ''

  const set = (id: string, field: keyof EmailTemplate, val: string) =>
    setEdited(e => ({ ...e, [id]: { ...(e[id] ?? {}), [field]: val } }))

  const save = async (t: EmailTemplate) => {
    setSaving(t.id)
    const updates = edited[t.id] ?? {}
    const { error } = await supabase.from('email_templates').update({
      asunto: updates.asunto ?? t.asunto,
      cuerpo_html: updates.cuerpo_html ?? t.cuerpo_html,
      updated_at: new Date().toISOString(),
    }).eq('id', t.id)

    if (error) {
      toast.error('Error guardando plantilla')
    } else {
      toast.success(`Plantilla "${t.nombre}" guardada`)
      // Refrescar
      const { data } = await supabase.from('email_templates').select('*').order('nombre')
      setTemplates(data ?? [])
      setEdited(e => { const n = { ...e }; delete n[t.id]; return n })
    }
    setSaving(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Plantillas de Email</h1>
        <p className="text-slate-500 text-sm">Personaliza los correos automáticos que envía CotizaGo</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Variables disponibles en HTML</p>
        <p className="text-xs text-blue-600">
          Puedes usar variables como <code className="bg-blue-100 px-1 rounded">{'{{nombre}}'}</code>,{' '}
          <code className="bg-blue-100 px-1 rounded">{'{{empresa}}'}</code>,{' '}
          <code className="bg-blue-100 px-1 rounded">{'{{link}}'}</code>,{' '}
          <code className="bg-blue-100 px-1 rounded">{'{{total}}'}</code> que se reemplazan al enviar.
          Cada plantilla tiene sus propias variables listadas abajo.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map(t => {
          const isOpen = expanded === t.id
          const isDirty = !!edited[t.id]
          const icon = TEMPLATE_ICONS[t.nombre] ?? '📧'
          const desc = TEMPLATE_DESCRIPTIONS[t.nombre] ?? ''
          const vars = t.variables_disponibles ?? []

          return (
            <div key={t.id} className={`card overflow-hidden ${isDirty ? 'ring-2 ring-primary-300' : ''}`}>
              {/* Header */}
              <button
                onClick={() => setExpanded(isOpen ? null : t.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-xl">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm capitalize">
                      {t.nombre.replace(/_/g, ' ')}
                    </p>
                    {isDirty && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Sin guardar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Body */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                  {/* Variables */}
                  {vars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map(v => (
                        <span key={v} className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Asunto */}
                  <div>
                    <label className="label">Asunto del correo</label>
                    <input
                      className="input"
                      value={get(t.id, 'asunto')}
                      onChange={e => set(t.id, 'asunto', e.target.value)}
                      placeholder="Asunto del email..."
                    />
                  </div>

                  {/* Cuerpo HTML */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Cuerpo HTML</label>
                      <button
                        onClick={() => setPreviewHtml(get(t.id, 'cuerpo_html'))}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Vista previa
                      </button>
                    </div>
                    <textarea
                      rows={14}
                      className="input font-mono text-xs resize-y leading-relaxed"
                      value={get(t.id, 'cuerpo_html')}
                      onChange={e => set(t.id, 'cuerpo_html', e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Code className="w-3 h-3" /> HTML completo — puedes usar estilos inline para compatibilidad con email
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => save(t)}
                      disabled={saving === t.id}
                      className="btn-primary"
                    >
                      {saving === t.id
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Save className="w-4 h-4" />
                      }
                      Guardar plantilla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Preview modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary-600" />
                <span className="font-semibold text-slate-800">Vista previa del email</span>
              </div>
              <button onClick={() => setPreviewHtml(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full min-h-96 border-0 rounded-lg bg-white"
                title="Email preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
