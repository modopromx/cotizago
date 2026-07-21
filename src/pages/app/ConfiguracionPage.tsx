import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Save, Building2, CreditCard, Palette, Upload, Trash2 } from 'lucide-react'

type Tab = 'empresa' | 'pago'

const REGIMENES = [
  { v: '601', l: '601 · General de Ley Personas Morales' },
  { v: '612', l: '612 · Personas Físicas con Actividades Empresariales' },
  { v: '626', l: '626 · RESICO' },
  { v: '605', l: '605 · Sueldos y Salarios' },
]

export default function ConfiguracionPage() {
  const { profile } = useAuth()
  const wsId = profile?.workspace_id
  const [form, setForm] = useState<any>({ tipo: 'empresa', pais: 'MX', moneda: 'MXN', impuesto_default: 16, vigencia_dias: 15, color_principal: '#08AEB6' })
  const [tab, setTab] = useState<Tab>('empresa')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    if (!wsId) return
    supabase.from('empresas').select('*').eq('workspace_id', wsId).maybeSingle()
      .then(({ data }) => { if (data) setForm((f: any) => ({ ...f, ...data })); setLoading(false) })
  }, [wsId])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }))

  // Sube el logo al almacenamiento del workspace y guarda su URL pública.
  const subirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !wsId) return
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo no debe pasar de 2 MB'); return }
    setSubiendo(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const ruta = `${wsId}/logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(ruta, file, { upsert: true, contentType: file.type })
    if (error) { toast.error('No se pudo subir: ' + error.message); setSubiendo(false); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(ruta)
    setForm((f: any) => ({ ...f, logo_url: data.publicUrl }))
    toast.success('Logo subido. No olvides guardar.')
    setSubiendo(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wsId) { toast.error('No se encontró tu workspace'); return }
    setSaving(true)

    // Candado anti-duplicados: el teléfono no puede estar en otra cuenta.
    if (form.telefono) {
      const { data: dup } = await supabase.rpc('verificar_duplicado', {
        p_user_id: profile?.id ?? null, p_nombre: null, p_telefono: form.telefono, p_email: null,
      })
      if (dup === 'telefono') {
        toast.error('Ese teléfono ya está registrado en otra cuenta.')
        setSaving(false)
        return
      }
    }

    const { error } = await supabase.from('empresas').upsert(
      { ...form, workspace_id: wsId, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' }
    )
    if (error) toast.error('Error al guardar: ' + error.message)
    else toast.success('Configuración guardada')
    setSaving(false)
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">Cargando...</div>

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'empresa', label: 'Empresa / Marca', icon: Building2 },
    { id: 'pago', label: 'Formas de pago', icon: CreditCard },
  ]

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Configuración de tu empresa</h1>
        <p className="text-slate-500 text-sm">Estos datos aparecerán automáticamente en todas tus cotizaciones.</p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && (
        <>
          {/* Tipo de emisor */}
          <div className="card p-5">
            <p className="label">Tipo de emisor</p>
            <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit">
              {[['empresa', 'Empresa / Marca'], ['persona_fisica', 'Persona física']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm((f: any) => ({ ...f, tipo: v }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.tipo === v ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Datos fiscales */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><Building2 className="w-4 h-4 text-primary-600" /> Datos generales y fiscales</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Nombre comercial</label><input className="input" value={form.nombre_comercial ?? ''} onChange={set('nombre_comercial')} /></div>
              <div><label className="label">Razón social</label><input className="input" value={form.razon_social ?? ''} onChange={set('razon_social')} /></div>
              <div><label className="label">RFC / ID fiscal</label><input className="input" value={form.rfc ?? ''} onChange={set('rfc')} /></div>
              <div><label className="label">Régimen fiscal</label>
                <select className="input" value={form.regimen_fiscal ?? ''} onChange={set('regimen_fiscal')}>
                  <option value="">Selecciona...</option>
                  {REGIMENES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
              <div><label className="label">País</label>
                <select className="input" value={form.pais ?? 'MX'} onChange={set('pais')}>
                  <option value="MX">México</option><option value="US">Estados Unidos</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option>
                </select>
              </div>
              <div><label className="label">Código postal</label><input className="input" value={form.codigo_postal ?? ''} onChange={set('codigo_postal')} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.telefono ?? ''} onChange={set('telefono')} /></div>
              <div><label className="label">Email de empresa</label><input type="email" className="input" value={form.email ?? ''} onChange={set('email')} /></div>
              <div className="sm:col-span-2"><label className="label">Dirección fiscal</label><input className="input" value={form.direccion ?? ''} onChange={set('direccion')} /></div>
              <div className="sm:col-span-2"><label className="label">Sitio web</label><input className="input" placeholder="https://..." value={form.sitio_web ?? ''} onChange={set('sitio_web')} /></div>
              <div className="sm:col-span-2">
                <label className="label">Logotipo de tus cotizaciones</label>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-16 rounded-xl border border-dashed border-slate-300 bg-fondo flex items-center justify-center overflow-hidden shrink-0">
                    {form.logo_url
                      ? <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                      : <span className="text-[11px] text-slate-400">Sin logo</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <label className="btn-secondary cursor-pointer text-xs">
                        <Upload className="w-3.5 h-3.5" /> {subiendo ? 'Subiendo...' : 'Subir logotipo'}
                        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={subirLogo} disabled={subiendo} />
                      </label>
                      {form.logo_url && (
                        <button type="button" onClick={() => setForm((f: any) => ({ ...f, logo_url: '' }))} className="btn-secondary text-xs text-red-600"><Trash2 className="w-3.5 h-3.5" /> Quitar</button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">PNG, JPG o SVG con fondo transparente · Máximo 2 MB. Aparecerá en tus PDF y en la cotización pública.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estilo de cotización */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><Palette className="w-4 h-4 text-primary-600" /> Estilo de cotización</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Color principal</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer" value={form.color_principal ?? '#08AEB6'} onChange={set('color_principal')} />
                  <input className="input" value={form.color_principal ?? '#08AEB6'} onChange={set('color_principal')} />
                </div>
              </div>
              <div><label className="label">Moneda predeterminada</label>
                <select className="input" value={form.moneda ?? 'MXN'} onChange={set('moneda')}>
                  <option value="MXN">MXN · Peso mexicano</option><option value="USD">USD · Dólar americano</option>
                </select>
              </div>
              <div><label className="label">Impuesto predeterminado</label>
                <select className="input" value={String(form.impuesto_default ?? 16)} onChange={set('impuesto_default')}>
                  <option value="16">IVA 16%</option><option value="8">IVA 8%</option><option value="0">Sin impuestos</option>
                </select>
              </div>
              <div><label className="label">Vigencia predeterminada</label>
                <select className="input" value={String(form.vigencia_dias ?? 15)} onChange={set('vigencia_dias')}>
                  <option value="15">15 días</option><option value="30">30 días</option><option value="60">60 días</option>
                </select>
              </div>
              <div className="sm:col-span-2"><label className="label">Condiciones comerciales</label>
                <textarea className="input resize-none" rows={2} placeholder="50% de anticipo y 50% contra entrega..." value={form.condiciones ?? ''} onChange={set('condiciones') as any} />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'pago' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-navy-900 font-semibold"><CreditCard className="w-4 h-4 text-primary-600" /> Formas de pago</div>
          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">Aparecerán en tus cotizaciones para que tus clientes sepan a dónde transferir.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Banco</label><input className="input" value={form.banco ?? ''} onChange={set('banco')} /></div>
            <div><label className="label">Titular</label><input className="input" value={form.titular ?? ''} onChange={set('titular')} /></div>
            <div><label className="label">Número de cuenta</label><input className="input" value={form.numero_cuenta ?? ''} onChange={set('numero_cuenta')} /></div>
            <div><label className="label">CLABE interbancaria</label><input className="input" value={form.clabe ?? ''} onChange={set('clabe')} /></div>
            <div className="sm:col-span-2"><label className="label">Link de pago (Clip, Mercado Pago, Stripe...)</label><input className="input" placeholder="https://..." value={form.link_pago ?? ''} onChange={set('link_pago')} /></div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className="btn-navy">
          {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          <Save className="w-4 h-4" /> Guardar configuración
        </button>
      </div>
    </form>
  )
}
