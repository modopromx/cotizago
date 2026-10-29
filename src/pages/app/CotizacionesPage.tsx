import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate, aFecha } from '../../lib/utils'
import { descargarCotizacion } from '../../lib/cotizacionPdf'
import { llenarPlantilla, abrirWhatsApp } from '../../lib/plantillas'
import { enviarCotizacionPorEmail, generarLinkWhatsApp } from '../../lib/envios'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Link2, FileText, MessageCircle, ExternalLink, Download, Copy, Ban, Mail, Eye, MoreHorizontal, BellRing, PartyPopper } from 'lucide-react'

const ESTADO_BADGE: Record<string, string> = {
  aceptada: 'bg-success-50 text-success-700',
  rechazada: 'bg-red-50 text-red-700',
  enviada: 'bg-azul-50 text-azul-600',
  vista: 'bg-primary-50 text-primary-700',
  pendiente: 'bg-amber-50 text-amber-700',
  borrador: 'bg-slate-100 text-slate-500',
  vencida: 'bg-slate-100 text-slate-500',
  cancelada: 'bg-slate-100 text-slate-500',
}

const TABS = [
  { key: 'todas', labelKey: 'cot.tabTodas' },
  { key: 'pendientes', labelKey: 'cot.tabPendientes' },
  { key: 'aceptada', labelKey: 'cot.tabAceptadas' },
  { key: 'rechazada', labelKey: 'cot.tabRechazadas' },
  { key: 'borrador', labelKey: 'cot.tabBorradores' },
]
const esPendiente = (e: string) => ['enviada', 'vista', 'pendiente'].includes(e)

// Botón de ícono de la tabla de escritorio: 36px de área táctil y nombre
// accesible (aria-label) además del title.
const BTN_ICONO = 'w-9 h-9 inline-flex items-center justify-center text-slate-500 rounded-lg'

type Accion = { key: string; label: string; Icon: any; onClick: () => void; disabled?: boolean; peligro?: boolean }

// Menú «Más acciones» de las tarjetas móviles. Botón con aria-haspopup /
// aria-expanded; Escape o un clic fuera lo cierran y devuelven el foco.
function MenuAcciones({ acciones, etiqueta }: { acciones: Accion[]; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const boton = useRef<HTMLButtonElement>(null)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    caja.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAbierto(false); boton.current?.focus() }
    }
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('keydown', tecla)
    document.addEventListener('mousedown', fuera)
    return () => { document.removeEventListener('keydown', tecla); document.removeEventListener('mousedown', fuera) }
  }, [abierto])

  return (
    <div className="relative">
      <button ref={boton} type="button" onClick={() => setAbierto(a => !a)}
        aria-haspopup="menu" aria-expanded={abierto} aria-controls={id} aria-label={etiqueta}
        className="w-11 h-11 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
        <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
      </button>
      {abierto && (
        <div ref={caja} id={id} role="menu" aria-label={etiqueta}
          className="absolute right-0 bottom-full mb-2 z-20 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
          {acciones.map(a => (
            <button key={a.key} type="button" role="menuitem" disabled={a.disabled}
              onClick={() => { setAbierto(false); a.onClick() }}
              className={`w-full min-h-[44px] flex items-center gap-3 px-4 text-sm text-left hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent ${a.peligro ? 'text-red-700' : 'text-navy-900'}`}>
              <a.Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CotizacionesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('todas')

  const [plantillaWA, setPlantillaWA] = useState<string>('')
  // Plantillas de seguimiento por WhatsApp (recordatorio / aceptada): se mandan a
  // mano desde la lista, con el texto que el usuario escribió en Plantillas.
  const [plantillasSeg, setPlantillasSeg] = useState<Record<string, string>>({})

  const load = async () => {
    // Aísla al workspace propio: el superadmin tiene acceso amplio por RLS
    // (para el panel admin), pero en SU panel personal solo debe ver lo suyo.
    if (!user || !profile?.workspace_id) return
    const { data } = await supabase.from('cotizaciones')
      .select('id,numero,estado,total,moneda,updated_at,cliente_nombre,cliente_empresa,cliente_whatsapp,cliente_email,token,visto_at,visto_count')
      .eq('workspace_id', profile.workspace_id)
      .order('updated_at', { ascending: false })
    setCotizaciones(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user, profile?.workspace_id])

  useEffect(() => {
    if (!profile?.workspace_id) return
    supabase.from('plantillas_mensajes').select('momento,cuerpo')
      .eq('workspace_id', profile.workspace_id).eq('canal', 'whatsapp')
      .then(({ data }) => {
        const m: Record<string, string> = {}
        ;(data ?? []).forEach((r: any) => { if (r.cuerpo?.trim()) m[r.momento] = r.cuerpo })
        setPlantillaWA(m.envio_inicial ?? 'Hola {{cliente}}, te comparto la cotización {{folio}} por {{total}}: {{enlace_publico}}')
        setPlantillasSeg(m)
      })
  }, [profile?.workspace_id])

  const handleDelete = async (id: string) => {
    if (!confirm(t('cot.confEliminar'))) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    toast.success(t('cot.eliminada')); load()
  }
  // Copiar / Ver comparten el enlace público, que SOLO vive si la cotización
  // está enviada. Igual que WhatsApp/Email, publicamos el borrador primero
  // (consume 1 folio la 1a vez) para no entregar un enlace muerto.
  const handleCopy = async (c: any) => {
    if (!(await marcarEnviada(c))) return
    navigator.clipboard.writeText(`${window.location.origin}/c/${c.token}`)
    toast.success(t('cot.enlaceCopiado'))
  }
  const handleVer = async (c: any) => {
    if (!(await marcarEnviada(c))) return
    window.open(`${window.location.origin}/c/${c.token}`, '_blank')
  }
  const handlePDF = async (id: string) => {
    const tid = toast.loading(t('cot.genPdf'))
    try { if (await descargarCotizacion(id)) toast.success(t('cot.pdfOk'), { id: tid }); else toast.dismiss(tid) }
    catch { toast.error(t('cot.pdfErr'), { id: tid }) }
  }
  // Enviar = marcar como "enviada" (consume 1 folio la primera vez) para que el
  // enlace público quede vivo. Sin esto, un borrador enviado da un link muerto
  // (el RPC público oculta los borradores). Idempotente: si ya está enviada, no
  // reconsume. Devuelve false si no hay folios.
  const marcarEnviada = async (c: any): Promise<boolean> => {
    if (c.estado !== 'borrador') return true
    const { error } = await supabase.rpc('enviar_cotizacion', { cotizacion_uuid: c.id })
    if (error) {
      toast.error(error.message.includes('folios') ? t('qe.noEnviarFolios') : error.message)
      return false
    }
    await refreshProfile()
    load()
    return true
  }
  const handleWhatsApp = async (c: any) => {
    if (!(await marcarEnviada(c))) return
    const enlace = `${window.location.origin}/c/${c.token}`
    const msg = llenarPlantilla(plantillaWA, {
      cliente: c.cliente_nombre || 'Hola', folio: c.numero,
      total: formatCurrency(c.total, c.moneda), empresa: profile?.empresa ?? profile?.nombre ?? '',
      enlace_publico: enlace, vendedor: profile?.nombre ?? '',
    })
    const digitos = (c.cliente_whatsapp ?? '').replace(/\D/g, '')
    if (digitos.length < 10) {
      abrirWhatsApp(msg, undefined)
      toast(t('cot.sinWa'), { icon: '📱', duration: 5000 })
      return
    }
    const tid = toast.loading(t('cot.prepWa'))
    const { url, fuente } = await generarLinkWhatsApp({
      telefono: digitos, mensaje: msg, referencia: c.numero, cotizacionId: c.id,
    })
    toast.success(fuente === 'walinker' ? t('cot.linkMarca') : t('cot.abriendoWa'), { id: tid })
    window.open(url, '_blank')
  }
  // Seguimiento por WhatsApp con la plantilla del momento (no consume folio: la
  // cotización ya se envió). 'recordatorio' si sigue pendiente, 'aceptada' si la aceptó.
  const PLANTILLA_SEG: Record<string, string> = {
    recordatorio: 'Hola {{cliente}}, ¿tuviste oportunidad de revisar la cotización {{folio}}? Sigue disponible aquí: {{enlace_publico}}',
    aceptada: '¡Gracias {{cliente}}! Confirmamos la aceptación de la cotización {{folio}}. Pronto nos pondremos en contacto para los siguientes pasos.',
  }
  const handleSeguimiento = async (c: any, momento: 'recordatorio' | 'aceptada') => {
    const enlace = `${window.location.origin}/c/${c.token}`
    const msg = llenarPlantilla(plantillasSeg[momento] ?? PLANTILLA_SEG[momento], {
      cliente: c.cliente_nombre || 'Hola', folio: c.numero,
      total: formatCurrency(c.total, c.moneda), empresa: profile?.empresa ?? profile?.nombre ?? '',
      enlace_publico: enlace, vendedor: profile?.nombre ?? '',
    })
    const digitos = (c.cliente_whatsapp ?? '').replace(/\D/g, '')
    if (digitos.length < 10) { abrirWhatsApp(msg, undefined); toast(t('cot.sinWa'), { icon: '📱', duration: 5000 }); return }
    const { url } = await generarLinkWhatsApp({ telefono: digitos, mensaje: msg, referencia: c.numero, cotizacionId: c.id })
    window.open(url, '_blank')
  }
  const seguimientoDe = (c: any) =>
    ['enviada', 'vista'].includes(c.estado) ? { momento: 'recordatorio' as const, label: t('cot.ttRecordatorio'), Icon: BellRing }
    : c.estado === 'aceptada' ? { momento: 'aceptada' as const, label: t('cot.ttAceptada'), Icon: PartyPopper }
    : null

  const handleEmail = async (c: any) => {
    if (!(await marcarEnviada(c))) return
    const tid = toast.loading(t('cot.enviandoCorreo'))
    try {
      await enviarCotizacionPorEmail(c.id)
      toast.success(t('cot.correoOk', { email: c.cliente_email }), { id: tid })
    } catch (e: any) {
      toast.error(e?.message ?? t('cot.correoErr'), { id: tid })
    }
  }
  const handleDuplicar = async (id: string) => {
    if (!user) return
    const { data: orig } = await supabase.from('cotizaciones').select('*').eq('id', id).single()
    if (!orig) return
    const { data: items } = await supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden')
    const numero = await supabase.rpc('generate_cotizacion_number', { user_uuid: user.id })
    // La copia es una cotización NUEVA: fecha de hoy, la misma vigencia en días y sin
    // nada de la original (enlace de WhatsApp, respuesta, visitas, envío).
    const { id: _id, created_at, updated_at, token, numero: _n, estado, folio_consumido, enviada_at, visto_at, visto_count,
      visto_ip, visto_pais, respuesta, wa_link, fecha_emision, fecha_vencimiento, ...resto } = orig
    const diasVigencia = fecha_emision && fecha_vencimiento
      ? Math.round((aFecha(fecha_vencimiento).getTime() - aFecha(fecha_emision).getTime()) / 86_400_000) : null
    let nuevaVence: string | null = null
    if (diasVigencia != null && diasVigencia >= 0) {
      const d = new Date(); d.setDate(d.getDate() + diasVigencia)
      nuevaVence = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const { data: nueva, error } = await supabase.from('cotizaciones')
      .insert({ ...resto, numero: numero.data, estado: 'borrador', folio_consumido: false, fecha_vencimiento: nuevaVence })
      .select('id').single()
    if (error || !nueva) { toast.error(t('cot.noDuplicar')); return }
    if (items?.length) {
      const { error: eItems } = await supabase.from('cotizacion_items').insert(
        items.map(({ id: _i, cotizacion_id, created_at: _c, ...it }) => ({ ...it, cotizacion_id: nueva.id }))
      )
      // Sin conceptos la copia no sirve: se borra y se avisa.
      if (eItems) { await supabase.from('cotizaciones').delete().eq('id', nueva.id); toast.error(t('cot.noDuplicar')); return }
    }
    toast.success(t('cot.duplicada')); load()
  }
  const handleCancelar = async (id: string) => {
    if (!confirm(t('cot.confCancelar'))) return
    await supabase.from('cotizaciones').update({ estado: 'cancelada' }).eq('id', id)
    toast.success(t('cot.cancelada')); load()
  }

  const filtered = cotizaciones.filter(c => {
    const s = search.toLowerCase()
    const matchSearch = [c.numero, c.cliente_nombre, c.cliente_empresa].some(v => v?.toLowerCase().includes(s))
    const matchTab = tab === 'todas' ? true : tab === 'pendientes' ? esPendiente(c.estado) : c.estado === tab
    return matchSearch && matchTab
  })

  // Acciones de una cotización para el menú móvil (mismos handlers que la tabla).
  // La acción principal (WhatsApp si es borrador / Ver si no) va fuera del menú.
  const accionesDe = (c: any): Accion[] => [
    { key: 'pdf', label: t('cot.ttPdf'), Icon: Download, onClick: () => handlePDF(c.id) },
    ...(c.estado === 'borrador' ? [] : [{ key: 'wa', label: t('cot.ttWa'), Icon: MessageCircle, onClick: () => handleWhatsApp(c) }]),
    ...(() => { const sg = seguimientoDe(c); return sg ? [{ key: 'seguimiento', label: sg.label, Icon: sg.Icon, onClick: () => handleSeguimiento(c, sg.momento) }] : [] })(),
    { key: 'email', label: c.cliente_email ? t('cot.ttEmail') : t('cot.ttEmailNo'), Icon: Mail, onClick: () => handleEmail(c), disabled: !c.cliente_email },
    { key: 'enlace', label: t('cot.ttEnlace'), Icon: Link2, onClick: () => handleCopy(c) },
    ...(c.estado === 'borrador' ? [{ key: 'ver', label: t('cot.ttVer'), Icon: ExternalLink, onClick: () => handleVer(c) }] : []),
    { key: 'editar', label: t('cot.ttEditar'), Icon: Edit2, onClick: () => navigate(`/app/cotizaciones/${c.id}/editar`) },
    { key: 'duplicar', label: t('cot.ttDuplicar'), Icon: Copy, onClick: () => handleDuplicar(c.id) },
    ...(c.estado !== 'cancelada' ? [{ key: 'cancelar', label: t('cot.ttCancelar'), Icon: Ban, onClick: () => handleCancelar(c.id) }] : []),
    { key: 'eliminar', label: t('cot.ttEliminar'), Icon: Trash2, onClick: () => handleDelete(c.id), peligro: true },
  ]

  const countFor = (key: string) => cotizaciones.filter(c =>
    key === 'todas' ? true : key === 'pendientes' ? esPendiente(c.estado) : c.estado === key).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t('shell.cotizaciones')}</h1>
          <p className="text-slate-500 text-sm">{t('cot.subtitle')}</p>
        </div>
        <Link to="/app/cotizaciones/nueva" className="btn-navy"><Plus className="w-4 h-4" aria-hidden="true" /> {t('shell.nuevaCotizacion')}</Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
        <input type="search" className="input pl-9" aria-label={t('cot.buscar')} placeholder={t('cot.buscar')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)} aria-pressed={tab === tb.key}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === tb.key ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t(tb.labelKey)} <span className={tab === tb.key ? 'text-white/60' : 'text-slate-500'}>{countFor(tb.key)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div role="status" className="card p-8 text-center text-slate-500 text-sm">{t('cot.cargando')}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-navy-900 font-medium mb-1">{cotizaciones.length === 0 ? t('cot.sinCotis') : t('cot.sinResultados')}</p>
          <Link to="/app/cotizaciones/nueva" className="btn-navy mt-3"><Plus className="w-4 h-4" aria-hidden="true" /> {t('shell.nuevaCotizacion')}</Link>
        </div>
      ) : (<>
        {/* Móvil: tarjetas con una acción principal visible y el resto en «Más acciones». */}
        <ul className="md:hidden space-y-3">
          {filtered.map(c => (
            <li key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500">{c.numero}</p>
                  <p className="text-navy-900 font-medium truncate">{c.cliente_nombre ?? '—'}</p>
                  {c.cliente_empresa && <p className="text-xs text-slate-500 truncate">{c.cliente_empresa}</p>}
                </div>
                <p className="font-semibold text-navy-900 shrink-0">{formatCurrency(c.total, c.moneda)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>{t(`estado.${c.estado}`, { defaultValue: c.estado })}</span>
                {Number(c.visto_count) > 0 && (
                  <span className="flex items-center gap-1 text-xs text-primary-700">
                    <Eye className="w-3 h-3" aria-hidden="true" /> Visto{Number(c.visto_count) > 1 ? ` · ${c.visto_count}×` : ''}
                  </span>
                )}
                <span className="text-xs text-slate-500 ml-auto">{formatDate(c.updated_at)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {c.estado === 'borrador' ? (
                  <button type="button" data-tour="cot-enviar" onClick={() => handleWhatsApp(c)} className="btn-primary flex-1 min-h-[44px]">
                    <MessageCircle className="w-4 h-4" aria-hidden="true" /> {t('cot.ttWa')}
                  </button>
                ) : (
                  <button type="button" onClick={() => handleVer(c)} className="btn-primary flex-1 min-h-[44px]">
                    <ExternalLink className="w-4 h-4" aria-hidden="true" /> {t('cot.ttVer')}
                  </button>
                )}
                <MenuAcciones acciones={accionesDe(c)} etiqueta={`${t('cot.colAcciones')} · ${c.numero}`} />
              </div>
            </li>
          ))}
        </ul>

        {/* Escritorio: tabla. */}
        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">{t('cot.colFolio')}</th>
                  <th className="px-4 py-3 font-medium">{t('cot.colCliente')}</th>
                  <th className="px-4 py-3 font-medium">{t('cot.colTotal')}</th>
                  <th className="px-4 py-3 font-medium">{t('cot.colEstado')}</th>
                  <th className="px-4 py-3 font-medium">{t('cot.colActualizada')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('cot.colAcciones')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.numero}</td>
                    <td className="px-4 py-3">
                      <p className="text-navy-900">{c.cliente_nombre ?? '—'}</p>
                      {c.cliente_empresa && <p className="text-xs text-slate-500">{c.cliente_empresa}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(c.total, c.moneda)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ESTADO_BADGE[c.estado] ?? 'bg-slate-100 text-slate-500'}`}>{t(`estado.${c.estado}`, { defaultValue: c.estado })}</span>
                      {Number(c.visto_count) > 0 && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-primary-700" title={c.visto_at ? `Visto por primera vez: ${formatDate(c.visto_at)}` : ''}>
                          <Eye className="w-3 h-3" aria-hidden="true" /> Visto{Number(c.visto_count) > 1 ? ` · ${c.visto_count}×` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePDF(c.id)} title={t('cot.ttPdf')} aria-label={t('cot.ttPdf')} className={`${BTN_ICONO} hover:text-navy-700 hover:bg-slate-100`}><Download className="w-4 h-4" aria-hidden="true" /></button>
                        <button data-tour="cot-enviar" onClick={() => handleWhatsApp(c)} title={t('cot.ttWa')} aria-label={t('cot.ttWa')} className={`${BTN_ICONO} hover:text-success-600 hover:bg-success-50`}><MessageCircle className="w-4 h-4" aria-hidden="true" /></button>
                        {(() => { const sg = seguimientoDe(c); return sg ? <button onClick={() => handleSeguimiento(c, sg.momento)} title={sg.label} aria-label={sg.label} className={`${BTN_ICONO} hover:text-success-600 hover:bg-success-50`}><sg.Icon className="w-4 h-4" aria-hidden="true" /></button> : null })()}
                        <button onClick={() => handleEmail(c)} disabled={!c.cliente_email} title={c.cliente_email ? t('cot.ttEmail') : t('cot.ttEmailNo')} aria-label={c.cliente_email ? t('cot.ttEmail') : t('cot.ttEmailNo')} className={`${BTN_ICONO} hover:text-azul-600 hover:bg-azul-50 disabled:opacity-30 disabled:hover:bg-transparent`}><Mail className="w-4 h-4" aria-hidden="true" /></button>
                        <button onClick={() => handleCopy(c)} title={t('cot.ttEnlace')} aria-label={t('cot.ttEnlace')} className={`${BTN_ICONO} hover:text-azul-600 hover:bg-azul-50`}><Link2 className="w-4 h-4" aria-hidden="true" /></button>
                        <button onClick={() => handleVer(c)} title={t('cot.ttVer')} aria-label={t('cot.ttVer')} className={`${BTN_ICONO} hover:text-primary-700 hover:bg-primary-50`}><ExternalLink className="w-4 h-4" aria-hidden="true" /></button>
                        <Link to={`/app/cotizaciones/${c.id}/editar`} title={t('cot.ttEditar')} aria-label={t('cot.ttEditar')} className={`${BTN_ICONO} hover:text-navy-700 hover:bg-slate-100`}><Edit2 className="w-4 h-4" aria-hidden="true" /></Link>
                        <button onClick={() => handleDuplicar(c.id)} title={t('cot.ttDuplicar')} aria-label={t('cot.ttDuplicar')} className={`${BTN_ICONO} hover:text-navy-700 hover:bg-slate-100`}><Copy className="w-4 h-4" aria-hidden="true" /></button>
                        {c.estado !== 'cancelada' && <button onClick={() => handleCancelar(c.id)} title={t('cot.ttCancelar')} aria-label={t('cot.ttCancelar')} className={`${BTN_ICONO} hover:text-amber-600 hover:bg-amber-50`}><Ban className="w-4 h-4" aria-hidden="true" /></button>}
                        <button onClick={() => handleDelete(c.id)} title={t('cot.ttEliminar')} aria-label={t('cot.ttEliminar')} className={`${BTN_ICONO} hover:text-red-600 hover:bg-red-50`}><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  )
}
