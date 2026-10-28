// Modal que aparece al guardar una cotización: ofrece enviarla de inmediato.
//  - Descargar PDF: siempre disponible (gratis, no consume folio).
//  - WhatsApp / Email: incluidos en el plan; el primer envío marca la cotización
//    como "enviada" y consume 1 folio (RPC idempotente enviar_cotizacion). Los
//    módulos "propio" solo sirven para usar tu propio número/dominio, no para
//    desbloquear el envío básico.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/utils'
import { descargarCotizacion } from '../lib/cotizacionPdf'
import { llenarPlantilla, abrirWhatsApp } from '../lib/plantillas'
import { enviarCotizacionPorEmail, generarLinkWhatsApp, avisarSaldoFolios } from '../lib/envios'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { Download, MessageCircle, Mail, ArrowRight, CheckCircle2 } from 'lucide-react'

const WA_FALLBACK = 'Hola {{cliente}}, te comparto la cotización {{folio}} por {{total}}: {{enlace_publico}}'

export default function ModalEnviarCotizacion({ cot, onClose }: { cot: any; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const [plantillaWA, setPlantillaWA] = useState(WA_FALLBACK)
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    const ws = profile?.workspace_id
    if (!ws) return
    supabase.from('plantillas_mensajes').select('cuerpo')
      .eq('workspace_id', ws).eq('canal', 'whatsapp').eq('momento', 'envio_inicial').maybeSingle()
      .then(({ data }) => { if (data?.cuerpo) setPlantillaWA(data.cuerpo) })
  }, [profile?.workspace_id])

  // Marca como enviada y consume 1 folio (solo la primera vez). false si falla.
  const marcarEnviada = async (): Promise<boolean> => {
    const { error } = await supabase.rpc('enviar_cotizacion', { cotizacion_uuid: cot.id })
    if (error) {
      toast.error(error.message.includes('folios') ? t('env.sinFolios') : error.message)
      return false
    }
    await refreshProfile()
    const uid = cot.user_id ?? profile?.id
    if (uid) {
      const { data: p } = await supabase.from('profiles').select('folios_balance,email,nombre').eq('id', uid).single()
      if (p) avisarSaldoFolios(p.folios_balance ?? 0, p.email, p.nombre ?? undefined)
    }
    return true
  }

  const cerrarYListar = () => { onClose(); navigate('/app/cotizaciones') }

  const handlePdf = async () => {
    setOcupado('pdf')
    try { if (await descargarCotizacion(cot.id)) toast.success(t('env.pdfOk')) }
    catch { toast.error(t('env.pdfErr')) }
    setOcupado(null)
  }

  const handleWa = async () => {
    setOcupado('wa')
    if (!(await marcarEnviada())) { setOcupado(null); return }
    const enlace = `${window.location.origin}/c/${cot.token}`
    const msg = llenarPlantilla(plantillaWA, {
      cliente: cot.cliente_nombre || 'Hola', folio: cot.numero,
      total: formatCurrency(cot.total, cot.moneda), empresa: profile?.empresa ?? '',
      enlace_publico: enlace, vendedor: profile?.nombre ?? '',
    })
    const digitos = (cot.cliente_whatsapp ?? '').replace(/\D/g, '')
    if (digitos.length < 10) {
      abrirWhatsApp(msg, undefined)
    } else {
      const { url } = await generarLinkWhatsApp({ telefono: digitos, mensaje: msg, referencia: cot.numero, cotizacionId: cot.id })
      window.open(url, '_blank')
    }
    setOcupado(null)
    cerrarYListar()
  }

  const handleEmail = async () => {
    if (!cot.cliente_email) { toast.error(t('env.sinCorreo')); return }
    setOcupado('email')
    if (!(await marcarEnviada())) { setOcupado(null); return }
    try {
      await enviarCotizacionPorEmail(cot.id)
      toast.success(t('env.enviadaEmail', { email: cot.cliente_email }))
    } catch (e: any) { toast.error(e?.message ?? t('env.errorEnviar')) }
    setOcupado(null)
    cerrarYListar()
  }

  const cargando = (k: string) => (
    <span role="status" aria-label={t('cot.cargando')} className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ display: ocupado === k ? 'inline-block' : 'none' }} />
  )

  // Fila de canal de envío.
  const Canal = ({ k, Icon, color, titulo, sub, onClick }: any) => (
    <button type="button" onClick={onClick} disabled={!!ocupado}
      className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-primary-300 hover:bg-primary-50/40 transition-colors disabled:opacity-60">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-navy-900">{titulo}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
      {ocupado === k ? cargando(k) : <ArrowRight className="w-4 h-4 text-slate-300" aria-hidden="true" />}
    </button>
  )

  // Usa el Modal compartido: role="dialog", Escape, trampa de foco y botón
  // Cerrar con nombre accesible. Cerrar (X, Escape o fondo) = «más tarde».
  return (
    <Modal ancho="max-w-md" onClose={cerrarYListar} titulo={
      <span className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-success-50 text-success-700 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" aria-hidden="true" /></span>
        <span>
          <span className="block font-bold text-navy-900">{t('env.guardada')}</span>
          <span className="block text-xs font-normal text-slate-500">{cot.numero}</span>
        </span>
      </span>
    }>
      <div className="space-y-2.5">
        <p className="text-sm text-slate-500 mb-1">{t('env.comoEnviar')}</p>

        <Canal k="pdf" Icon={Download} color="bg-fondo text-navy-700" titulo={t('env.pdf')} sub={t('env.pdfSub')} onClick={handlePdf} />
        <Canal k="wa" Icon={MessageCircle} color="bg-success-50 text-success-700" titulo={t('env.whatsapp')} sub={t('env.whatsappSub')} onClick={handleWa} />
        <Canal k="email" Icon={Mail} color="bg-azul-50 text-azul-600" titulo={t('env.email')} sub={t('env.emailSub')} onClick={handleEmail} />

        <button type="button" onClick={cerrarYListar} className="w-full min-h-[44px] text-center text-sm text-slate-500 hover:text-navy-700 pt-2">
          {t('env.masTarde')}
        </button>
      </div>
    </Modal>
  )
}
