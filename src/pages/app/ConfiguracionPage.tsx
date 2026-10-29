import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Save, Building2, CreditCard, Palette, Upload, Trash2 } from 'lucide-react'

type Tab = 'empresa' | 'pago'

// Catálogo SAT de Régimen Fiscal (c_RegimenFiscal), morales y físicas.
const REGIMENES = [
  { v: '601', l: '601 · General de Ley Personas Morales' },
  { v: '603', l: '603 · Personas Morales con Fines no Lucrativos' },
  { v: '605', l: '605 · Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { v: '606', l: '606 · Arrendamiento' },
  { v: '607', l: '607 · Enajenación o Adquisición de Bienes' },
  { v: '608', l: '608 · Demás ingresos' },
  { v: '610', l: '610 · Residentes en el Extranjero sin Establecimiento en México' },
  { v: '611', l: '611 · Ingresos por Dividendos (socios y accionistas)' },
  { v: '612', l: '612 · Personas Físicas con Actividades Empresariales y Profesionales' },
  { v: '614', l: '614 · Ingresos por intereses' },
  { v: '616', l: '616 · Sin obligaciones fiscales' },
  { v: '620', l: '620 · Sociedades Cooperativas de Producción' },
  { v: '621', l: '621 · Incorporación Fiscal' },
  { v: '622', l: '622 · Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { v: '625', l: '625 · Actividades Empresariales por Plataformas Tecnológicas' },
  { v: '626', l: '626 · Régimen Simplificado de Confianza (RESICO)' },
]

// Catálogo SAT de Uso de CFDI (c_UsoCFDI), los más usados en servicios/ventas.
const USOS_CFDI = [
  { v: 'G01', l: 'G01 · Adquisición de mercancías' },
  { v: 'G02', l: 'G02 · Devoluciones, descuentos o bonificaciones' },
  { v: 'G03', l: 'G03 · Gastos en general' },
  { v: 'I01', l: 'I01 · Construcciones' },
  { v: 'I04', l: 'I04 · Equipo de cómputo y accesorios' },
  { v: 'I08', l: 'I08 · Otra maquinaria y equipo' },
  { v: 'D10', l: 'D10 · Pagos por servicios educativos (colegiaturas)' },
  { v: 'CP01', l: 'CP01 · Pagos' },
  { v: 'S01', l: 'S01 · Sin efectos fiscales' },
]

export default function ConfiguracionPage() {
  const { t } = useTranslation()
  const { profile, refreshProfile } = useAuth()
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
    if (file.size > 2 * 1024 * 1024) { toast.error(t('cfg.logoMax')); return }
    setSubiendo(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const ruta = `${wsId}/logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(ruta, file, { upsert: true, contentType: file.type })
    if (error) { toast.error(t('cfg.noSubir') + error.message); setSubiendo(false); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(ruta)
    setForm((f: any) => ({ ...f, logo_url: data.publicUrl }))
    toast.success(t('cfg.logoSubido'))
    setSubiendo(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wsId) { toast.error(t('cfg.noWorkspace')); return }
    setSaving(true)

    // Candado anti-duplicados: el teléfono no puede estar en otra cuenta.
    if (form.telefono) {
      const { data: dup } = await supabase.rpc('verificar_duplicado', {
        p_user_id: profile?.id ?? null, p_nombre: null, p_telefono: form.telefono, p_email: null,
      })
      if (dup === 'telefono') {
        toast.error(t('cfg.telDup'))
        setSaving(false)
        return
      }
    }

    // Solo enlaces web (https://…): la base rechaza javascript:, data:, etc.
    if (form.link_pago && !/^https?:\/\//i.test(String(form.link_pago).trim())) {
      toast.error(t('cfg.linkPagoInvalido'))
      setSaving(false)
      return
    }

    const { error } = await supabase.from('empresas').upsert(
      { ...form, workspace_id: wsId, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id' }
    )
    if (error) { toast.error(t('cfg.errorGuardar') + error.message); setSaving(false); return }

    // Espeja el logo y el nombre en el perfil, que es de donde el avatar del
    // header toma la imagen de la empresa.
    if (profile?.id) {
      await supabase.from('profiles').update({
        logo_url: form.logo_url || null,
        empresa: form.nombre_comercial || form.razon_social || profile.empresa,
      }).eq('id', profile.id)
      await refreshProfile()
    }
    toast.success(t('cfg.guardada'))
    setSaving(false)
  }

  if (loading) return <div className="card p-8 text-center text-slate-500 text-sm">{t('cfg.cargando')}</div>

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'empresa', label: t('cfg.tabEmpresa'), icon: Building2 },
    { id: 'pago', label: t('cfg.tabPago'), icon: CreditCard },
  ]

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('cfg.title')}</h1>
        <p className="text-slate-500 text-sm">{t('cfg.subtitle')}</p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 bg-fondo p-1 rounded-xl w-fit">
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} aria-pressed={tab === tb.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tb.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tb.icon className="w-4 h-4" aria-hidden="true" /> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && (
        <>
          {/* Datos fiscales (sirve para persona moral, física o freelancer) */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><Building2 className="w-4 h-4 text-primary-700" aria-hidden="true" /> {t('cfg.datosFiscales')}</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label htmlFor="cfg-nombre_comercial" className="label">{t('cfg.nombreComercial')}</label><input id="cfg-nombre_comercial" className="input" value={form.nombre_comercial ?? ''} onChange={set('nombre_comercial')} /></div>
              <div><label htmlFor="cfg-razon_social" className="label">{t('cfg.razonSocial')}</label><input id="cfg-razon_social" className="input" value={form.razon_social ?? ''} onChange={set('razon_social')} /></div>
              <div><label htmlFor="cfg-rfc" className="label">{t('cfg.rfc')}</label><input id="cfg-rfc" className="input" value={form.rfc ?? ''} onChange={set('rfc')} /></div>
              <div><label htmlFor="cfg-regimen_fiscal" className="label">{t('cfg.regimenFiscal')}</label>
                <select id="cfg-regimen_fiscal" className="input" value={form.regimen_fiscal ?? ''} onChange={set('regimen_fiscal')}>
                  <option value="">{t('cfg.selecciona')}</option>
                  {REGIMENES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
              <div><label htmlFor="cfg-uso_cfdi" className="label">{t('cfg.usoCfdi')}</label>
                <select id="cfg-uso_cfdi" className="input" value={form.uso_cfdi ?? ''} onChange={set('uso_cfdi')}>
                  <option value="">{t('cfg.selecciona')}</option>
                  {USOS_CFDI.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
                </select>
              </div>
              <div><label htmlFor="cfg-pais" className="label">{t('cfg.pais')}</label>
                <select id="cfg-pais" className="input" value={form.pais ?? 'MX'} onChange={set('pais')}>
                  <option value="MX">México</option><option value="US">Estados Unidos</option><option value="CO">Colombia</option><option value="AR">Argentina</option><option value="CL">Chile</option>
                </select>
              </div>
              <div><label htmlFor="cfg-codigo_postal" className="label">{t('cfg.cp')}</label><input id="cfg-codigo_postal" className="input" value={form.codigo_postal ?? ''} onChange={set('codigo_postal')} /></div>
              <div><label htmlFor="cfg-telefono" className="label">{t('cfg.telefono')}</label><input id="cfg-telefono" className="input" value={form.telefono ?? ''} onChange={set('telefono')} /></div>
              <div><label htmlFor="cfg-email" className="label">{t('cfg.emailEmpresa')}</label><input id="cfg-email" type="email" className="input" value={form.email ?? ''} onChange={set('email')} /></div>
              <div className="sm:col-span-2"><label htmlFor="cfg-direccion" className="label">{t('cfg.direccion')}</label><input id="cfg-direccion" className="input" value={form.direccion ?? ''} onChange={set('direccion')} /></div>
              <div className="sm:col-span-2"><label htmlFor="cfg-sitio_web" className="label">{t('cfg.sitioWeb')}</label><input id="cfg-sitio_web" className="input" placeholder="https://..." value={form.sitio_web ?? ''} onChange={set('sitio_web')} /></div>
              <div className="sm:col-span-2" data-tour="cfg-logo">
                <p className="label">{t('cfg.logo')}</p>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-16 rounded-xl border border-dashed border-slate-300 bg-fondo flex items-center justify-center overflow-hidden shrink-0">
                    {form.logo_url
                      ? <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                      : <span className="text-[11px] text-slate-500">{t('cfg.sinLogo')}</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <label className="btn-secondary cursor-pointer text-xs focus-within:ring-2 focus-within:ring-primary-500">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" /> {subiendo ? t('cfg.subiendo') : t('cfg.subirLogo')}
                        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={subirLogo} disabled={subiendo} />
                      </label>
                      {form.logo_url && (
                        <button type="button" onClick={() => setForm((f: any) => ({ ...f, logo_url: '' }))} className="btn-secondary text-xs text-red-700"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> {t('cfg.quitar')}</button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">{t('cfg.logoAyuda')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Estilo de cotización */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 text-navy-900 font-semibold"><Palette className="w-4 h-4 text-primary-700" aria-hidden="true" /> {t('cfg.estilo')}</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cfg-color_principal" className="label">{t('cfg.colorPrincipal')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label={t('cfg.colorPrincipal')} className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer" value={form.color_principal ?? '#08AEB6'} onChange={set('color_principal')} />
                  <input id="cfg-color_principal" className="input" value={form.color_principal ?? '#08AEB6'} onChange={set('color_principal')} />
                </div>
              </div>
              <div><label htmlFor="cfg-moneda" className="label">{t('cfg.monedaDefault')}</label>
                <select id="cfg-moneda" className="input" value={form.moneda ?? 'MXN'} onChange={set('moneda')}>
                  <option value="MXN">MXN · Peso mexicano</option><option value="USD">USD · Dólar americano</option>
                </select>
              </div>
              <div><label htmlFor="cfg-impuesto_default" className="label">{t('cfg.impuestoDefault')}</label>
                <select id="cfg-impuesto_default" className="input" value={String(form.impuesto_default ?? 16)} onChange={set('impuesto_default')}>
                  <option value="16">{t('cfg.iva16')}</option><option value="8">{t('cfg.iva8')}</option><option value="0">{t('cfg.sinImpuestos')}</option>
                </select>
              </div>
              <div><label htmlFor="cfg-vigencia_dias" className="label">{t('cfg.vigenciaDefault')}</label>
                <select id="cfg-vigencia_dias" className="input" value={String(form.vigencia_dias ?? 15)} onChange={set('vigencia_dias')}>
                  <option value="15">{t('cfg.dias15')}</option><option value="30">{t('cfg.dias30')}</option><option value="60">{t('cfg.dias60')}</option>
                </select>
              </div>
              <div className="sm:col-span-2"><label htmlFor="cfg-condiciones" className="label">{t('cfg.condiciones')}</label>
                <textarea id="cfg-condiciones" className="input resize-none" rows={2} placeholder={t('cfg.condicionesPh')} value={form.condiciones ?? ''} onChange={set('condiciones') as any} />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'pago' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-navy-900 font-semibold"><CreditCard className="w-4 h-4 text-primary-700" aria-hidden="true" /> {t('cfg.formasPago')}</div>
          <p className="text-xs text-slate-500 bg-fondo rounded-lg p-3">{t('cfg.formasPagoIntro')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label htmlFor="cfg-banco" className="label">{t('cfg.banco')}</label><input id="cfg-banco" className="input" value={form.banco ?? ''} onChange={set('banco')} /></div>
            <div><label htmlFor="cfg-titular" className="label">{t('cfg.titular')}</label><input id="cfg-titular" className="input" value={form.titular ?? ''} onChange={set('titular')} /></div>
            <div><label htmlFor="cfg-numero_cuenta" className="label">{t('cfg.numeroCuenta')}</label><input id="cfg-numero_cuenta" className="input" value={form.numero_cuenta ?? ''} onChange={set('numero_cuenta')} /></div>
            <div><label htmlFor="cfg-clabe" className="label">{t('cfg.clabe')}</label><input id="cfg-clabe" className="input" value={form.clabe ?? ''} onChange={set('clabe')} /></div>
            <div className="sm:col-span-2"><label htmlFor="cfg-link_pago" className="label">{t('cfg.linkPago')}</label><input id="cfg-link_pago" className="input" placeholder="https://..." value={form.link_pago ?? ''} onChange={set('link_pago')} /></div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className="btn-navy">
          {saving && <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          <Save className="w-4 h-4" aria-hidden="true" /> {t('cfg.guardar')}
        </button>
      </div>
    </form>
  )
}
