import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { UserPlus, Zap, AlertTriangle, CheckCircle2, FileText, Eye, Pencil, Send, Save, Mail, MessageCircle } from 'lucide-react'
import Modal from '../../components/Modal'

interface Plantilla {
  id: string; clave: string; asunto: string; cuerpo: string; variables: string[]
  cuerpo_html?: string; cuerpo_whatsapp?: string; canales?: string[]
}

const META: Record<string, { nombreKey: string; icon: any; color: string }> = {
  bienvenida: { nombreKey: 'adm.mail.tBienvenida', icon: UserPlus, color: 'text-primary-700 bg-primary-50' },
  recordatorio_recarga: { nombreKey: 'adm.mail.tRecordatorio', icon: Zap, color: 'text-amber-700 bg-amber-50' },
  folios_terminados: { nombreKey: 'adm.mail.tFoliosTerminados', icon: AlertTriangle, color: 'text-red-700 bg-red-50' },
  recarga_exitosa: { nombreKey: 'adm.mail.tRecargaExitosa', icon: CheckCircle2, color: 'text-success-700 bg-success-50' },
  cotizacion_enviada: { nombreKey: 'adm.mail.tCotizacionEnviada', icon: FileText, color: 'text-azul-600 bg-azul-50' },
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
  const { t } = useTranslation()
  const nombreDe = (clave: string) => META[clave] ? t(META[clave].nombreKey) : clave
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [editar, setEditar] = useState<Plantilla | null>(null)
  const [preview, setPreview] = useState<Plantilla | null>(null)
  const [previewCanal, setPreviewCanal] = useState<'email' | 'whatsapp'>('email')
  const [draft, setDraft] = useState({ asunto: '', cuerpo: '', cuerpo_html: '', cuerpo_whatsapp: '' })
  const [saving, setSaving] = useState(false)
  const [tabEdit, setTabEdit] = useState<'email' | 'whatsapp'>('email')

  const orden = ['bienvenida', 'recordatorio_recarga', 'folios_terminados', 'recarga_exitosa', 'cotizacion_enviada']

  const load = async () => {
    const { data } = await supabase.from('email_templates').select('*')
    const list = (data ?? []).sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave))
    setPlantillas(list)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const abrirEditar = (p: Plantilla) => {
    setEditar(p); setTabEdit('email')
    setDraft({ asunto: p.asunto, cuerpo: p.cuerpo, cuerpo_html: p.cuerpo_html ?? '', cuerpo_whatsapp: p.cuerpo_whatsapp ?? p.cuerpo })
  }

  const guardar = async () => {
    if (!editar) return
    setSaving(true)
    const { error } = await supabase.from('email_templates').update({
      asunto: draft.asunto, cuerpo: draft.cuerpo,
      cuerpo_html: draft.cuerpo_html || null, cuerpo_whatsapp: draft.cuerpo_whatsapp || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editar.id)
    if (error) toast.error(t('adm.mail.errorGuardar'))
    else { toast.success(t('adm.mail.guardada')); setEditar(null); load() }
    setSaving(false)
  }

  if (loading) return <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('adm.mail.title')}</h1>
        <p className="text-slate-500 text-sm">{t('adm.mail.subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {plantillas.map(p => {
          const m = META[p.clave] ?? { icon: FileText, color: 'text-slate-600 bg-slate-100' }
          const Icon = m.icon
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <span aria-hidden="true" className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-900">{nombreDe(p.clave)}</p>
                  <p className="text-xs text-slate-500 truncate">{p.asunto}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {(p.canales ?? ['email']).includes('email') && <span title="Email" role="img" aria-label="Email" className="w-6 h-6 rounded bg-azul-50 text-azul-600 flex items-center justify-center"><Mail className="w-3 h-3" aria-hidden="true" /></span>}
                  {(p.canales ?? []).includes('whatsapp') && <span title="WhatsApp" role="img" aria-label="WhatsApp" className="w-6 h-6 rounded bg-success-50 text-success-700 flex items-center justify-center"><MessageCircle className="w-3 h-3" aria-hidden="true" /></span>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-fondo/60 p-3 h-36 overflow-y-auto text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {p.cuerpo}
              </div>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">{t('adm.mail.variablesDisp')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.variables ?? []).map(v => <span key={v} className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">{`{{${v}}}`}</span>)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setPreview(p)} className="btn-secondary justify-center text-xs"><Eye className="w-3.5 h-3.5" aria-hidden="true" /> {t('adm.mail.vistaPrevia')}</button>
                <button type="button" onClick={() => abrirEditar(p)} className="btn-secondary justify-center text-xs"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /> {t('adm.mail.editar')}</button>
                <button type="button" onClick={() => toast(t('adm.mail.pruebaAviso'), { icon: '📨' })} className="btn-secondary justify-center text-xs"><Send className="w-3.5 h-3.5" aria-hidden="true" /> {t('adm.mail.prueba')}</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal editar */}
      {editar && (
        <Modal titulo={`${t('adm.mail.editarPref')}: ${nombreDe(editar.clave)}`} onClose={() => setEditar(null)} sinCerrar={saving}>
            <div className="space-y-3">
              <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit" role="group" aria-label="Canal">
                {(['email', 'whatsapp'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setTabEdit(c)} aria-pressed={tabEdit === c}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tabEdit === c ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>
                    {c === 'email' ? <Mail className="w-3.5 h-3.5" aria-hidden="true" /> : <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                    {c === 'email' ? 'Email' : 'WhatsApp'}
                  </button>
                ))}
              </div>
              {tabEdit === 'email' ? (
                <>
                  <div><label className="label" htmlFor="tpl-asunto">{t('adm.mail.asunto')}</label><input id="tpl-asunto" className="input" value={draft.asunto} onChange={e => setDraft(d => ({ ...d, asunto: e.target.value }))} /></div>
                  <div><label className="label" htmlFor="tpl-cuerpo">{t('adm.mail.cuerpoTexto')}</label><textarea id="tpl-cuerpo" className="input resize-none font-mono text-xs leading-relaxed" rows={6} value={draft.cuerpo} onChange={e => setDraft(d => ({ ...d, cuerpo: e.target.value }))} /></div>
                  <div><label className="label" htmlFor="tpl-html">{t('adm.mail.disenoHtml')}</label><textarea id="tpl-html" className="input resize-none font-mono text-[10px] leading-relaxed" rows={10} value={draft.cuerpo_html} onChange={e => setDraft(d => ({ ...d, cuerpo_html: e.target.value }))} placeholder="<div>...</div>" /></div>
                </>
              ) : (
                <div><label className="label" htmlFor="tpl-wa">{t('adm.mail.mensajeWa')}</label><textarea id="tpl-wa" className="input resize-none font-mono text-xs leading-relaxed" rows={12} value={draft.cuerpo_whatsapp} onChange={e => setDraft(d => ({ ...d, cuerpo_whatsapp: e.target.value }))} /></div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">{t('adm.mail.variables')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(editar.variables ?? []).map(v => (
                    <button key={v} type="button" onClick={() => setDraft(d => ({ ...d, cuerpo: d.cuerpo + `{{${v}}}` }))} className="text-[11px] font-mono px-2 py-0.5 rounded bg-fondo text-navy-700 hover:bg-primary-100">{`{{${v}}}`}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditar(null)} disabled={saving} className="btn-secondary flex-1 justify-center">{t('adm.mail.cancelar')}</button>
                <button type="button" onClick={guardar} disabled={saving} aria-busy={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />} {t('adm.mail.guardar')}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {/* Modal vista previa */}
      {preview && (
        <Modal titulo={t('adm.mail.vistaPrevia')} onClose={() => setPreview(null)}>
            <div>
              {/* Selector de canal (antes iba en el encabezado, junto a la X) */}
              <div className="flex gap-1 bg-fondo p-1 rounded-lg w-fit mb-4" role="group" aria-label="Canal">
                {(['email', 'whatsapp'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setPreviewCanal(c)} aria-pressed={previewCanal === c} disabled={c === 'whatsapp' && !(preview.canales ?? []).includes('whatsapp')}
                    className={`px-2.5 py-1 rounded text-xs font-medium disabled:opacity-30 ${previewCanal === c ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}>
                    {c === 'email' ? 'Email' : 'WhatsApp'}
                  </button>
                ))}
              </div>
              {previewCanal === 'email' ? (
                preview.cuerpo_html ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-fondo px-4 py-2 border-b border-slate-200">
                      <p className="text-[11px] text-slate-500">{t('adm.mail.vpAsunto')}</p>
                      <p className="text-sm font-medium text-navy-900">{render(preview.asunto)}</p>
                    </div>
                    {/* Vista previa del diseño real del correo */}
                    <iframe title={t('adm.mail.vistaPrevia')} className="w-full h-[460px] bg-white" srcDoc={render(preview.cuerpo_html)} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-fondo px-4 py-2 border-b border-slate-200">
                      <p className="text-[11px] text-slate-500">{t('adm.mail.vpAsunto')}</p>
                      <p className="text-sm font-medium text-navy-900">{render(preview.asunto)}</p>
                    </div>
                    <p className="p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{render(preview.cuerpo)}</p>
                  </div>
                )
              ) : (
                <div className="rounded-xl p-4" style={{ background: '#e5ddd5' }}>
                  <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm max-w-[85%]">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{render(preview.cuerpo_whatsapp ?? preview.cuerpo)}</p>
                    <p className="text-[10px] text-slate-500 text-right mt-1">12:42 ✓✓</p>
                  </div>
                </div>
              )}
            </div>
        </Modal>
      )}
    </div>
  )
}
