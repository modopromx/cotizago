import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Star, Package, Save } from 'lucide-react'
import Modal from '../../components/Modal'

export default function AdminPaquetesPage() {
  const { t } = useTranslation()
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [ventas, setVentas] = useState<Record<string, { n: number; monto: number }>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [beneficiosText, setBeneficiosText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: paks }, { data: pagos }] = await Promise.all([
      supabase.from('paquetes_folios').select('*').order('orden'),
      supabase.from('pagos').select('paquete_nombre,monto,estado').eq('tipo', 'folio_topup'),
    ])
    const v: Record<string, { n: number; monto: number }> = {}
    ;(pagos ?? []).forEach((p: any) => {
      if (!p.paquete_nombre || p.estado === 'pendiente') return
      v[p.paquete_nombre] = v[p.paquete_nombre] ?? { n: 0, monto: 0 }
      v[p.paquete_nombre].n++
      v[p.paquete_nombre].monto += Number(p.monto) || 0
    })
    setPaquetes(paks ?? []); setVentas(v); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openModal = (p?: any) => {
    setEditing(p ?? null)
    setForm(p
      ? { nombre: p.nombre, folios: p.folios, precio: p.precio, moneda: p.moneda, popular: p.popular, activo: p.activo, orden: p.orden, descripcion: p.descripcion ?? '' }
      : { nombre: '', folios: 100, precio: 149, moneda: 'MXN', popular: false, activo: true, orden: paquetes.length + 1, descripcion: '' })
    setBeneficiosText((p?.beneficios ?? []).join('\n'))
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      // Los inputs numéricos entregan texto; la landing calcula con estos valores.
      folios: Number(form.folios) || 0,
      precio: Number(form.precio) || 0,
      orden: Number(form.orden) || 1,
      beneficios: beneficiosText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    const { error } = editing
      ? await supabase.from('paquetes_folios').update(payload).eq('id', editing.id)
      : await supabase.from('paquetes_folios').insert(payload)
    if (error) toast.error(t('adm.paq.errorGen') + error.message)
    else { toast.success(editing ? t('adm.paq.actualizado') : t('adm.paq.creado')); setModal(false); load() }
    setSaving(false)
  }

  const toggleActivo = async (p: any) => {
    await supabase.from('paquetes_folios').update({ activo: !p.activo }).eq('id', p.id)
    toast.success(p.activo ? t('adm.paq.ocultoOk') : t('adm.paq.publicadoOk'))
    load()
  }

  const handleDelete = async (p: any) => {
    const vendidos = ventas[p.nombre]?.n ?? 0
    const aviso = vendidos > 0
      ? t('adm.paq.delConVentas', { n: vendidos })
      : t('adm.paq.delSimple', { nombre: p.nombre })
    if (!confirm(aviso)) return
    const { error } = await supabase.from('paquetes_folios').delete().eq('id', p.id)
    if (error) toast.error(t('adm.paq.noEliminar') + error.message)
    else { toast.success(t('adm.paq.eliminado')); load() }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const totalVendido = Object.values(ventas).reduce((s, v) => s + v.monto, 0)
  const totalCompras = Object.values(ventas).reduce((s, v) => s + v.n, 0)

  const kpis = [
    { label: t('adm.paq.kPublicados'), value: paquetes.filter(p => p.activo).length, sub: t('adm.paq.kPublicadosSub', { n: paquetes.length }) },
    { label: t('adm.paq.kCompras'), value: totalCompras },
    { label: t('adm.paq.kIngresos'), value: formatCurrency(totalVendido) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('adm.paq.title')}</h1>
          <p className="text-slate-500 text-sm">{t('adm.paq.subtitle')}</p>
        </div>
        <button type="button" onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('adm.paq.nuevo')}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('adm.cargando')}</div>
      ) : paquetes.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">{t('adm.paq.sinPaquetes')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('adm.paq.sinPaquetesSub')}</p>
          <button type="button" onClick={() => openModal()} className="btn-navy mt-4"><Plus className="w-4 h-4" aria-hidden="true" /> {t('adm.paq.nuevo')}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paquetes.map(p => {
            const v = ventas[p.nombre] ?? { n: 0, monto: 0 }
            return (
              <div key={p.id} className={`card p-5 flex flex-col relative ${p.popular ? 'ring-2 ring-primary-200' : ''} ${!p.activo ? 'opacity-60' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge bg-primary-500 text-navy-900 px-3 py-1 flex items-center gap-1">
                      <Star className="w-3 h-3" aria-hidden="true" /> {t('adm.paq.masElegido')}
                    </span>
                  </div>
                )}
                <div className="text-center pt-2">
                  <p className="text-3xl font-extrabold text-navy-900">{p.folios}</p>
                  <p className="text-xs text-slate-500 mb-2">{t('adm.paq.folios')}</p>
                  <p className="text-2xl font-bold text-primary-700">{formatCurrency(p.precio, p.moneda)}</p>
                  <p className="text-sm font-medium text-navy-800 mt-1">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-slate-500 mt-0.5">{p.descripcion}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('adm.paq.comprasN', { count: v.n })}</span>
                  <span className="font-semibold text-navy-900">{formatCurrency(v.monto)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => toggleActivo(p)} aria-pressed={!!p.activo}
                    className={`badge ${p.activo ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.activo ? t('adm.paq.aVenta') : t('adm.paq.oculto')}
                  </button>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openModal(p)} aria-label={`${t('adm.paq.editar')}: ${p.nombre}`} title={t('adm.paq.editar')} className="p-1.5 text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" onClick={() => handleDelete(p)} aria-label={`Eliminar: ${p.nombre}`} title="Eliminar" className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal titulo={editing ? t('adm.paq.editar') : t('adm.paq.nuevoPaquete')} onClose={() => setModal(false)} sinCerrar={saving} ancho="max-w-md">
            <form onSubmit={handleSave} className="space-y-3">
              <div><label className="label" htmlFor="paq-nombre">{t('adm.paq.nombre')}</label><input id="paq-nombre" className="input" required value={form.nombre ?? ''} onChange={set('nombre')} placeholder="Negocio" /></div>
              <div><label className="label" htmlFor="paq-descripcion">{t('adm.paq.descripcion')}</label><input id="paq-descripcion" className="input" value={form.descripcion ?? ''} onChange={set('descripcion')} placeholder="Para ventas constantes" /></div>
              <div>
                <label className="label" htmlFor="paq-beneficios">{t('adm.paq.beneficios')}</label>
                <textarea id="paq-beneficios" className="input resize-none" rows={3} value={beneficiosText} onChange={e => setBeneficiosText(e.target.value)}
                  placeholder={'PDFs personalizados\nWhatsApp y email\nSin fecha de caducidad'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="paq-folios">{t('adm.paq.folios')}</label><input id="paq-folios" type="number" inputMode="numeric" className="input" min="1" required value={form.folios ?? ''} onChange={set('folios')} /></div>
                <div><label className="label" htmlFor="paq-precio">{t('adm.paq.precio')}</label><input id="paq-precio" type="number" inputMode="decimal" className="input" min="0" step="0.01" required value={form.precio ?? ''} onChange={set('precio')} /></div>
                <div><label className="label" htmlFor="paq-moneda">{t('adm.paq.moneda')}</label>
                  <select id="paq-moneda" className="input" value={form.moneda ?? 'MXN'} onChange={set('moneda')}>
                    <option value="MXN">MXN</option><option value="USD">USD</option>
                  </select>
                </div>
                <div><label className="label" htmlFor="paq-orden">{t('adm.paq.orden')}</label><input id="paq-orden" type="number" inputMode="numeric" className="input" min="1" value={form.orden ?? ''} onChange={set('orden')} /></div>
              </div>
              {Number(form.folios) > 0 && Number(form.precio) > 0 && (
                <p className="text-[11px] text-slate-500">
                  {t('adm.paq.saleA', { precio: formatCurrency(Number(form.precio) / Number(form.folios), form.moneda) })}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                  <input type="checkbox" checked={!!form.popular} onChange={set('popular')} className="rounded border-slate-300" />
                  {t('adm.paq.masElegidoCheck')}
                </label>
                <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                  <input type="checkbox" checked={form.activo ?? true} onChange={set('activo')} className="rounded border-slate-300" />
                  {t('adm.paq.aVentaCheck')}
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} disabled={saving} className="btn-secondary flex-1 justify-center">{t('adm.paq.cancelar')}</button>
                <button type="submit" disabled={saving} aria-busy={saving} className="btn-navy flex-1 justify-center">
                  {saving ? <span aria-hidden="true" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                  {editing ? t('adm.paq.guardar') : t('adm.paq.crear')}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
