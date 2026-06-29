import { Layers } from 'lucide-react'

const PLANTILLAS = [
  { id: 'clasica', nombre: 'Clásica', desc: 'Diseño limpio y profesional', preview: '🗒️', badge: 'Popular' },
  { id: 'moderna', nombre: 'Moderna', desc: 'Colores corporativos con acento', preview: '📋', badge: '' },
  { id: 'minimalista', nombre: 'Minimalista', desc: 'Simple y elegante', preview: '📄', badge: '' },
  { id: 'ejecutiva', nombre: 'Ejecutiva', desc: 'Para grandes corporativos', preview: '💼', badge: 'Premium' },
]

export default function PlantillasPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Plantillas</h1>
        <p className="text-slate-500 text-sm">Elige el diseño de tus cotizaciones</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANTILLAS.map(p => (
          <div key={p.id} className="card p-5 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all border-2 border-transparent">
            <div className="text-4xl mb-3">{p.preview}</div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-slate-800">{p.nombre}</p>
              {p.badge && <span className="badge bg-primary-100 text-primary-700">{p.badge}</span>}
            </div>
            <p className="text-xs text-slate-500">{p.desc}</p>
            <button className="btn-secondary w-full mt-4 justify-center text-xs">Seleccionar</button>
          </div>
        ))}
      </div>
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-navy-50 border-primary-200">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-primary-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-800">Personalización avanzada próximamente</p>
            <p className="text-sm text-slate-500 mt-0.5">Podrás editar colores, tipografías y logos en cada plantilla.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
