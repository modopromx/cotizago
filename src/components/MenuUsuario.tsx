// Avatar del header con menú de perfil y accesos rápidos.
// - Muestra el logotipo de la empresa (profiles.logo_url) si ya lo subieron;
//   si no, la inicial.
// - Al hacer clic despliega: datos de la cuenta + accesos a Mi empresa,
//   Comprar folios y Módulos, y cerrar sesión.
// El desplegable va en posición fija: el header está dentro de un contenedor
// con overflow-hidden que lo recortaría si fuera absolute.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Building2, Coins, Blocks, LogOut, ChevronDown } from 'lucide-react'

export default function MenuUsuario() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [open])

  const inicial = (profile?.nombre ?? profile?.email ?? 'U')[0].toUpperCase()
  const titulo = profile?.empresa || profile?.nombre || 'Mi cuenta'
  const folios = profile?.folios_balance ?? 0
  const logo = profile?.logo_url

  const ir = (ruta: string) => { setOpen(false); navigate(ruta) }
  const salir = async () => { setOpen(false); await signOut(); navigate('/login') }

  const accesos = [
    { icon: Building2, label: 'Mi empresa', sub: 'Datos y logotipo', ruta: '/app/configuracion' },
    { icon: Coins, label: 'Comprar folios', sub: `${folios} disponibles`, ruta: '/app/folios' },
    { icon: Blocks, label: 'Módulos', sub: 'Amplía tu cuenta', ruta: '/app/modulos' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full p-0.5 hover:bg-slate-100 transition-colors">
        {logo
          ? <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
          : <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">{inicial}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="fixed top-[66px] right-4 lg:right-8 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60]">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100">
            {logo
              ? <img src={logo} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
              : <span className="w-10 h-10 rounded-lg bg-primary-50 text-primary-700 text-sm font-bold flex items-center justify-center shrink-0">{inicial}</span>}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy-900 truncate">{titulo}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>

          <div className="py-1.5">
            {accesos.map(a => (
              <button key={a.ruta} onClick={() => ir(a.ruta)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left">
                <span className="w-8 h-8 rounded-lg bg-fondo text-navy-700 flex items-center justify-center shrink-0">
                  <a.icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-navy-900">{a.label}</span>
                  <span className="block text-[11px] text-slate-400">{a.sub}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 py-1.5">
            <button onClick={salir}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left text-red-600">
              <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><LogOut className="w-4 h-4" /></span>
              <span className="text-sm">Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
