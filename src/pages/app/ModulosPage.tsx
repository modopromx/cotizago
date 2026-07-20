import { Blocks } from 'lucide-react'

// Marketplace de módulos contratables. La lógica completa (contratar, suscripción,
// Stripe/Mercado Pago) llega en un sprint posterior; por ahora es el placeholder
// del shell para que la navegación del menú funcione.
export default function ModulosPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-navy-900">Módulos e integraciones</h1>
      <p className="text-slate-500 text-sm mt-1">Contrata únicamente los módulos que necesita tu negocio.</p>
      <div className="card p-10 mt-6 text-center">
        <span className="inline-flex w-12 h-12 rounded-xl bg-primary-50 text-primary-600 items-center justify-center">
          <Blocks className="w-6 h-6" />
        </span>
        <p className="mt-4 font-medium text-navy-900">Marketplace en camino</p>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Aquí podrás activar WhatsApp propio, email profesional, pagos en línea, CRM y más.
        </p>
      </div>
    </div>
  )
}
