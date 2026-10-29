import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import CampoTelefono from '../../components/CampoTelefono'
import Modal from '../../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Users, UserPlus } from 'lucide-react'

const emptyForm = { nombre: '', empresa: '', rfc: '', razon_social: '', email: '', telefono: '', whatsapp: '', pais: 'MX', codigo_postal: '' }

export default function ClientesPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const wsId = profile?.workspace_id
  const [clientes, setClientes] = useState<any[]>([])
  const [agg, setAgg] = useState<Record<string, { count: number; valor: number }>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    // Aísla al workspace propio (el superadmin no debe ver clientes de otros
    // en su panel personal, aunque RLS le dé acceso amplio para el panel admin).
    if (!user || !wsId) return
    const [{ data: cli }, { data: cot }] = await Promise.all([
      supabase.from('clientes').select('*').eq('workspace_id', wsId).eq('activo', true).order('nombre'),
      supabase.from('cotizaciones').select('cliente_id,total').eq('workspace_id', wsId),
    ])
    const map: Record<string, { count: number; valor: number }> = {}
    ;(cot ?? []).forEach(c => {
      if (!c.cliente_id) return
      map[c.cliente_id] = map[c.cliente_id] ?? { count: 0, valor: 0 }
      map[c.cliente_id].count++
      map[c.cliente_id].valor += Number(c.total) || 0
    })
    setAgg(map)
    setClientes(cli ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user, wsId])

  const openModal = (c?: any) => {
    setEditing(c ?? null)
    setForm(c ? { ...emptyForm, ...c } : { ...emptyForm })
    setModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    // Antes se decía «guardado» sin revisar el error; si falla, la ventana sigue
    // abierta con lo que el usuario escribió.
    const { error } = editing
      ? await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : await supabase.from('clientes').insert({ ...form, user_id: user.id })
    setSaving(false)
    if (error) { toast.error(t('qe.noGuardar') + error.message); return }
    toast.success(editing ? t('cli.actualizado') : t('cli.creado'))
    setModal(false); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('cli.confEliminar'))) return
    const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id)
    if (error) { toast.error(t('qe.noGuardar') + error.message); return }
    toast.success(t('cli.eliminado')); load()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = clientes.filter(c =>
    [c.nombre, c.empresa, c.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )
  const activos = clientes.filter(c => (agg[c.id]?.count ?? 0) > 0).length
  const valorTotal = Object.values(agg).reduce((s, a) => s + a.valor, 0)

  const kpis = [
    { label: t('cli.kpiTotales'), value: clientes.length },
    { label: t('cli.kpiActivos'), value: activos, sub: clientes.length ? t('cli.delTotal', { n: Math.round(activos / clientes.length * 100) }) : '—' },
    { label: t('cli.kpiValor'), value: formatCurrency(valorTotal), sub: t('cli.historico') },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('shell.clientes')}</h1>
          <p className="text-slate-500 text-sm">{t('cli.subtitle')}</p>
        </div>
        <button data-tour="cli-nuevo" onClick={() => openModal()} className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('cli.agregar')}</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k.label}</p>
            <p className="text-xl font-extrabold text-navy-900 mt-1">{loading ? '—' : k.value}</p>
            {k.sub && <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
        <input type="search" aria-label={t('cli.buscar')} className="input pl-9" placeholder={t('cli.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500 text-sm">{t('cli.cargando')}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium">{clientes.length === 0 ? t('cli.sinClientes') : t('cli.sinResultados')}</p>
          <button onClick={() => openModal()} className="btn-navy mt-4"><UserPlus className="w-4 h-4" aria-hidden="true" /> {t('cli.agregar')}</button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                <th className="px-6 py-3 font-medium">{t('cli.colCliente')}</th>
                <th className="px-4 py-3 font-medium">{t('cli.colContacto')}</th>
                <th className="px-4 py-3 font-medium">{t('cli.colCotizaciones')}</th>
                <th className="px-4 py-3 font-medium">{t('cli.colValor')}</th>
                <th className="px-4 py-3 font-medium">{t('cli.colEstado')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const a = agg[c.id] ?? { count: 0, valor: 0 }
                const activo = a.count > 0
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {(c.empresa || c.nombre || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-navy-900">{c.empresa || c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{c.nombre}</p>
                      {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.count}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(a.valor)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${activo ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
                        {activo ? t('cli.activo') : t('cli.prospecto')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openModal(c)} aria-label={`Editar cliente ${c.empresa || c.nombre}`} className="p-2 text-slate-500 hover:text-navy-700 hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                        <button onClick={() => handleDelete(c.id)} aria-label={`Eliminar cliente ${c.empresa || c.nombre}`} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal ancho="max-w-md" onClose={() => setModal(false)} sinCerrar={saving}
          titulo={editing ? t('cli.editarCliente') : t('cli.nuevoCliente')}>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label htmlFor="cli-nombreContacto" className="label">{t('cli.nombreContacto')}</label><input id="cli-nombreContacto" className="input" required value={form.nombre} onChange={set('nombre')} /></div>
                <div><label htmlFor="cli-empresa" className="label">{t('cli.empresa')}</label><input id="cli-empresa" className="input" value={form.empresa} onChange={set('empresa')} /></div>
                <div><label htmlFor="cli-rfc" className="label">{t('cli.rfc')}</label><input id="cli-rfc" className="input" value={form.rfc} onChange={set('rfc')} /></div>
                <div className="col-span-2"><label htmlFor="cli-razonSocial" className="label">{t('cli.razonSocial')}</label><input id="cli-razonSocial" className="input" value={form.razon_social} onChange={set('razon_social')} /></div>
                <div className="col-span-2"><label htmlFor="cli-correo" className="label">{t('cli.correo')}</label><input id="cli-correo" type="email" className="input" value={form.email} onChange={set('email')} /></div>
                <div><label htmlFor="cli-telefono" className="label">{t('cli.telefono')}</label><input id="cli-telefono" className="input" value={form.telefono} onChange={set('telefono')} /></div>
                <div className="col-span-2">
                  <CampoTelefono label={t('cli.waLabel')} value={form.whatsapp}
                    onChange={v => setForm(f => ({ ...f, whatsapp: v }))}
                    paisDefault={form.pais || 'MX'} />
                </div>
                <div><label htmlFor="cli-pais" className="label">{t('cli.pais')}</label>
                  <select id="cli-pais" className="input" value={form.pais} onChange={set('pais')}>
                    <option value="MX">México</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option><option value="PE">Perú</option><option value="US">Estados Unidos</option>
                  </select>
                </div>
                <div><label htmlFor="cli-cp" className="label">{t('cli.cp')}</label><input id="cli-cp" className="input" value={form.codigo_postal} onChange={set('codigo_postal')} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">{t('cli.cancelar')}</button>
                <button type="submit" disabled={saving} className="btn-navy flex-1 justify-center">
                  {saving && <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editing ? t('cli.guardar') : t('cli.crearCliente')}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  )
}
