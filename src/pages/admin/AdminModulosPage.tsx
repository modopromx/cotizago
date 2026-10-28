import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { MessageCircle, Mail, CreditCard, Code2, Blocks, Edit2, Save, Plus, Users } from 'lucide-react'
import Modal from '../../components/Modal'

const ICONOS: Record<string, any> = {
  whatsapp_propio: MessageCircle, email_profesional: Mail, pagos_linea: CreditCard,
  api_webhooks: Code2, crm: Blocks, equipo_ventas: Users,
}

export default function AdminModulosPage() {
  const { t } = useTranslation()
  const [modulos, setModulos] = useState<any[]>([])
  const [subs, setSubs] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editar, setEditar] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: mods }, { data: ss }] = await Promise.all([
      supabase.from('modulos').select('*').order('orden'),
      supabase.from('modulo_suscripciones').select('clave,estado').eq('estado', 'activa'),
    ])
    const conteo: Record<string, number> = {}
    ;(ss ?? []).forEach((s: any) => { conteo[s.clave] = (conteo[s.clave] ?? 0) + 1 })
    setModulos(mods ?? []); setSubs(conteo); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const mrr = modulos.reduce((s, m) => s + (Number(m.precio) || 0) * (subs[m.clave] ?? 0), 0)

  const abrir = (m?: any) => {
    setEditar(m ?? { nuevo: true })
    setForm(m ? { ...m } : { clave: '', nombre: '', descripcion: '', precio: 99, periodicidad: 'mensual', activo: true, orden: modulos.length + 1 })
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { nuevo, id, created_at, ...payload } = form
    // Precio y orden se editan como texto (para poder borrar el campo); aquí se vuelven número.
    payload.precio = Number(payload.precio) || 0
    payload.orden = Number(payload.orden) || 1
    const { error } = editar?.nuevo
      ? await supabase.from('modulos').insert(payload)
      : await supabase.from('modulos').update(payload).eq('id', editar.id)
    if (error) toast.error(t('adm.mod.errorGen') + error.message)
    else { toast.success(t('adm.mod.guardado')); setEditar(null); load() }
    setSaving(false)
  }

  const toggleActivo = async (m: any) => {
    await supabase.from('modulos').update({ activo: !m.activo }).eq('id', m.id)
    toast.success(m.activo ? t('adm.mod.ocultadoOk') : t('adm.mod.publicadoOk')); load()
  }

  if (loading) return <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('adm.mod.title')}</h1>
          <p className="text-slate-500 text-sm">{t('adm.mod.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">{t('adm.mod.mrr')}</p>
            <p className="font-bold text-navy-900">{formatCurrency(mrr)}</p>
          </div>
          <button type="button" onClick={() => abrir()} className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('adm.mod.nuevo')}</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
              <th className="px-6 py-3 font-medium">{t('adm.mod.colModulo')}</th>
              <th className="px-4 py-3 font-medium">{t('adm.mod.colPrecio')}</th>
              <th className="px-4 py-3 font-medium">{t('adm.mod.colContratados')}</th>
              <th className="px-4 py-3 font-medium">{t('adm.mod.colIngreso')}</th>
              <th className="px-4 py-3 font-medium">{t('adm.mod.colEstado')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('adm.mod.colAcciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modulos.map(m => {
              const Icon = ICONOS[m.clave] ?? Blocks
              const n = subs[m.clave] ?? 0
              return (
                <tr key={m.id} className={`hover:bg-slate-50 ${!m.activo ? 'opacity-55' : ''}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-fondo flex items-center justify-center text-navy-700 shrink-0" aria-hidden="true"><Icon className="w-4 h-4" /></span>
                      <div>
                        <p className="font-medium text-navy-900">{m.nombre}</p>
                        <p className="text-xs text-slate-500 max-w-md truncate">{m.descripcion}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(m.precio)}<span className="text-xs font-normal text-slate-500">/{m.periodicidad === 'mensual' ? t('adm.mod.mes') : m.periodicidad}</span></td>
                  <td className="px-4 py-3 text-slate-600">{n}</td>
                  <td className="px-4 py-3 font-semibold text-primary-700">{formatCurrency((Number(m.precio) || 0) * n)}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActivo(m)} aria-pressed={!!m.activo} className={`badge ${m.activo ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
                      {m.activo ? t('adm.mod.publicado') : t('adm.mod.oculto')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => abrir(m)} aria-label={`${t('adm.mod.editarModulo')}: ${m.nombre}`} title={t('adm.mod.editarModulo')} className="p-1.5 text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editar && (
        <Modal titulo={editar.nuevo ? t('adm.mod.nuevoModulo') : t('adm.mod.editarModulo')} onClose={() => setEditar(null)} sinCerrar={saving} ancho="max-w-md">
            <form onSubmit={guardar} className="space-y-3">
              <div><label className="label" htmlFor="mod-nombre">{t('adm.mod.nombre')}</label><input id="mod-nombre" className="input" required value={form.nombre ?? ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
              {editar.nuevo && (
                <div><label className="label" htmlFor="mod-clave">{t('adm.mod.claveInterna')}</label><input id="mod-clave" className="input" required placeholder="mi_modulo" value={form.clave ?? ''} onChange={e => setForm({ ...form, clave: e.target.value })} /></div>
              )}
              <div><label className="label" htmlFor="mod-descripcion">{t('adm.mod.descripcion')}</label><textarea id="mod-descripcion" className="input resize-none" rows={2} value={form.descripcion ?? ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="label" htmlFor="mod-precio">{t('adm.mod.precio')}</label><input id="mod-precio" type="number" inputMode="decimal" className="input" min="0" step="1" value={form.precio ?? ''} onChange={e => setForm({ ...form, precio: e.target.value })} /></div>
                <div><label className="label" htmlFor="mod-periodicidad">{t('adm.mod.periodicidad')}</label>
                  <select id="mod-periodicidad" className="input" value={form.periodicidad ?? 'mensual'} onChange={e => setForm({ ...form, periodicidad: e.target.value })}>
                    <option value="mensual">{t('adm.mod.mensual')}</option><option value="anual">{t('adm.mod.anual')}</option>
                  </select>
                </div>
                <div><label className="label" htmlFor="mod-orden">{t('adm.mod.orden')}</label><input id="mod-orden" type="number" inputMode="numeric" className="input" min="1" value={form.orden ?? ''} onChange={e => setForm({ ...form, orden: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                <input type="checkbox" checked={form.activo ?? true} onChange={e => setForm({ ...form, activo: e.target.checked })} className="rounded border-slate-300" />
                {t('adm.mod.publicadoCheck')}
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditar(null)} disabled={saving} className="btn-secondary flex-1 justify-center">{t('adm.mod.cancelar')}</button>
                <button type="submit" disabled={saving} aria-busy={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />} {t('adm.mod.guardar')}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
