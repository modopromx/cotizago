// Aviso de version nueva de la PWA.
//
// El service worker se registra en modo 'prompt': cuando hay una version nueva
// NO se recarga sola. Si lo hiciera, podria recargar la pestana justo mientras
// alguien captura una cotizacion y perderia lo escrito. Aqui se le avisa y el
// usuario decide cuando aplicarla.
//
// NOTA: el aviso "Lista para usar sin internet" (offlineReady) se quito a
// proposito: aparecia en cada visita y molestaba. Solo dejamos el aviso util,
// el de version nueva. El registro del SW se mantiene igual (la PWA sigue
// funcionando offline), solo no se anuncia.
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export default function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayVersionNueva) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy-900">Hay una versión nueva</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Guarda lo que estés haciendo antes de actualizar.
            </p>
          </div>
          <button onClick={() => setHayVersionNueva(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setHayVersionNueva(false)} className="btn-secondary flex-1 justify-center text-xs">
            Ahora no
          </button>
          <button onClick={() => updateServiceWorker(true)} className="btn-navy flex-1 justify-center text-xs">
            Actualizar
          </button>
        </div>
      </div>
    </div>
  )
}
