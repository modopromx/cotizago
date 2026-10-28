import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { usePaquetes, precioDe, fmtPrecio, SIMBOLO_MONEDA } from '../../lib/usePaquetes'
import { cargarConfigStripe, instanciaStripe } from '../../lib/stripe'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'
import { Coins, Check, X } from 'lucide-react'

export default function FoliosPage() {
  const { t, i18n } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const { paquetes } = usePaquetes()   // paquetes en vivo (realtime)
  const [checkout, setCheckout] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCfg, setStripeCfg] = useState<{ pk: string; habilitado: boolean }>({ pk: '', habilitado: false })
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  useEffect(() => {
    const pago = params.get('pago')
    if (pago === 'procesando') {
      // El webhook acredita en segundo plano; refrescamos el saldo un par de veces.
      refreshProfile()
      setTimeout(refreshProfile, 2500)
      // Con tarjeta el pago ya está aprobado a los pocos segundos. Si sigue
      // pendiente es una ficha OXXO: los folios llegan cuando se pague en tienda.
      setTimeout(async () => {
        refreshProfile()
        const { data } = await supabase.from('pagos').select('estado')
          .eq('tipo', 'folio_topup').order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (data?.estado === 'pendiente') toast(t('fol.pagoOxxo'), { icon: '🧾', duration: 10000 })
        else toast.success(t('fol.pagoRecibido'))
      }, 5000)
    } else if (pago === 'cancelado') toast.error(t('fol.pagoCancelado'))
  }, [])

  useEffect(() => { cargarConfigStripe().then(setStripeCfg) }, [])

  // Escape cierra el checkout embebido (no usa <Modal> por el iframe de Stripe).
  useEffect(() => {
    if (!clientSecret) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setClientSecret(null) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [clientSecret])

  const handleCompra = async (p: any) => {
    if (!user) return
    if (!stripeCfg.habilitado || !stripeCfg.pk) {
      toast(t('fol.pagosNoActivos'), { icon: '💬', duration: 6000 })
      return
    }
    setCheckout(p.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('fol.sesionExpirada')); return }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ paquete_id: p.id, moneda: precioDe(p, i18n.language).moneda }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.clientSecret) {
        setStripePromise(instanciaStripe(stripeCfg.pk))
        setClientSecret(data.clientSecret)
      }
      else toast.error(data.error ?? t('fol.noIniciarPago'))
    } catch {
      toast.error(t('fol.errorConectarPagos'))
    } finally { setCheckout(null) }
  }

  return (
    <div className="space-y-6">
      {/* Checkout embebido de Stripe */}
      {clientSecret && stripePromise && (
        // No usa <Modal>: su trampa de foco no ve el iframe de Stripe y el
        // teclado no podría entrar al formulario de pago.
        <div className="fixed inset-0 bg-navy-950/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="fol-checkout-titulo" className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 id="fol-checkout-titulo" className="font-bold text-navy-900">{t('fol.pagoSeguro')}</h2>
              <button onClick={() => setClientSecret(null)} aria-label="Cerrar" className="p-2 -m-2 text-slate-500 hover:text-slate-600"><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
            <div className="p-2">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t('fol.title')}</h1>
        <p className="text-slate-500 text-sm">{t('fol.subtitle')}</p>
      </div>

      {/* Saldo */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #06213B, #08AEB6)' }}>
        <div className="absolute -right-10 -top-10 w-52 h-52 bg-white/5 rounded-full" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider"><Coins className="w-4 h-4" aria-hidden="true" /> {t('fol.saldoActual')}</div>
          <p className="text-5xl font-black mt-2">{profile?.folios_balance ?? 0} <span className="text-2xl font-semibold text-white/70">{t('fol.folios')}</span></p>
          <p className="text-white/80 text-sm mt-1">{t('fol.folioNoCaduca')}</p>
        </div>
      </div>

      {/* Paquetes */}
      <div>
        <h2 className="text-lg font-bold text-navy-900">{t('fol.compraMas')}</h2>
        <p className="text-slate-500 text-sm mb-4">{t('fol.compraSub')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paquetes.map(p => {
            const pr = precioDe(p, i18n.language)
            return (
            <div key={p.id} className={`card p-6 relative ${p.popular ? 'ring-2 ring-primary-500 shadow-card-hover' : ''}`}>
              {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-navy-900 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">{t('fol.masElegido')}</span>}
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{t('fol.paquete')}</p>
              <h3 className="text-lg font-bold text-navy-900">{p.nombre}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-primary-700">{p.folios}</span><span className="text-slate-500 mb-1">{t('fol.folios')}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{SIMBOLO_MONEDA[pr.moneda] ?? '$'}{(pr.precio / p.folios).toFixed(2)} {t('fol.porFolio')}</p>
              <p className="mt-3 text-2xl font-extrabold text-navy-900">{SIMBOLO_MONEDA[pr.moneda] ?? '$'}{fmtPrecio(pr.precio)} <span className="text-sm font-medium text-slate-500">{pr.moneda}</span></p>
              <button onClick={() => handleCompra(p)} disabled={checkout === p.id}
                className={`mt-4 w-full justify-center ${p.popular ? 'btn-primary' : 'btn-navy'}`}>
                {checkout === p.id ? <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {checkout === p.id ? t('fol.conectando') : t('fol.comprar')}
              </button>
              <ul className="mt-5 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" aria-hidden="true" /> {t('fol.benSinCaduca')}</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" aria-hidden="true" /> {t('fol.benAcumulables')}</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" aria-hidden="true" /> {t('fol.benActivacion')}</li>
              </ul>
            </div>
            )
          })}
        </div>
        <p className="text-center text-xs text-slate-500 mt-4">{t('fol.pagoSeguroPie')}</p>
      </div>

      {/* Las facturas/notas se gestionan en su propia página (menú → Notas y facturas) */}
      <p className="text-center text-xs text-slate-500">
        {t('fol.verFacturas')} <Link to="/app/facturas" className="text-primary-700 hover:underline font-medium">{t('fol.facturasTitle')}</Link>
      </p>
    </div>
  )
}
