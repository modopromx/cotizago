import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Save, Building2, CreditCard, Upload } from 'lucide-react'

export default function ConfiguracionPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'empresa' | 'pago'>('empresa')

  useEffect(() => { if (profile) setForm({ ...profile }) }, [profile])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      nombre: form.nombre, empresa: form.empresa, razon_social: form.razon_social, rfc: form.rfc,
      telefono: form.telefono, direccion: form.direccion, email_empresa: form.email_empresa,
      codigo_postal: form.codigo_postal, pais: form.pais, moneda: form.moneda,
      banco: form.banco, titular: form.titular, numero_cuenta: form.numero_cuenta,
      clabe: form.clabe, link_pago: form.link_pago,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)
    if (error) toast.error('Error al guardar')
    else { toast.success('Configuración guardada'); await refreshProfile() }
    setSaving(false)
  }

  const tabs = [
    { id: 'empresa', label: 'Datos de empresa', icon: Building2 },
    { id: 'pago', label: 'Datos de pago', icon: CreditCard },
  ]

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 text-sm">Personaliza tu información para las cotizaciones</p>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        {tab === 'empresa' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Tu nombre</label><input className="input" value={form.nombre ?? ''} onChange={set('nombre')} /></div>
              <div><label className="label">Empresa</label><input className="input" value={form.empresa ?? ''} onChange={set('empresa')} /></div>
              <div className="col-span-2"><label className="label">Razón social</label><input className="input" value={form.razon_social ?? ''} onChange={set('razon_social')} /></div>
              <div><label className="label">RFC</label><input className="input" value={form.rfc ?? ''} onChange={set('rfc')} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.telefono ?? ''} onChange={set('telefono')} /></div>
              <div className="col-span-2"><label className="label">Correo empresa</label><input type="email" className="input" value={form.email_empresa ?? ''} onChange={set('email_empresa')} /></div>
              <div className="col-span-2"><label className="label">Dirección</label><input className="input" value={form.direccion ?? ''} onChange={set('direccion')} /></div>
              <div><label className="label">País</label>
                <select className="input" value={form.pais ?? 'MX'} onChange={set('pais')}>
                  <option value="MX">México</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option><option value="PE">Perú</option><option value="US">EE.UU.</option>
                </select>
              </div>
              <div><label className="label">Moneda</label>
                <select className="input" value={form.moneda ?? 'MXN'} onChange={set('moneda')}>
                  <option value="MXN">MXN</option><option value="USD">USD</option><option value="COP">COP</option>
                </select>
              </div>
            </div>
          </>
        )}

        {tab === 'pago' && (
          <>
            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
              Estos datos aparecerán en tus cotizaciones para que los clientes sepan a dónde transferir.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Banco</label><input className="input" value={form.banco ?? ''} onChange={set('banco')} /></div>
              <div><label className="label">Titular</label><input className="input" value={form.titular ?? ''} onChange={set('titular')} /></div>
              <div><label className="label">Número de cuenta</label><input className="input" value={form.numero_cuenta ?? ''} onChange={set('numero_cuenta')} /></div>
              <div><label className="label">CLABE interbancaria</label><input className="input" value={form.clabe ?? ''} onChange={set('clabe')} /></div>
              <div className="col-span-2"><label className="label">Link de pago (Clip, Conekta, MercadoPago...)</label><input className="input" placeholder="https://..." value={form.link_pago ?? ''} onChange={set('link_pago')} /></div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <Save className="w-4 h-4" /> Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
