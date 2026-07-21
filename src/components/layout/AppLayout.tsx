import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Logo from '../Logo'
import {
  LayoutDashboard, FileText, Users, Package, Coins, Blocks,
  Mail, Building2, LogOut, Menu, X, Plus, LifeBuoy,
} from 'lucide-react'
import clsx from 'clsx'

// Menú del panel según el diseño de referencia.
const navItems = [
  { to: '/app', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/app/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/productos', label: 'Productos', icon: Package },
  { to: '/app/folios', label: 'Comprar folios', icon: Coins },
  { to: '/app/modulos', label: 'Módulos', icon: Blocks },
  { to: '/app/plantillas', label: 'Plantillas', icon: Mail },
  { to: '/app/configuracion', label: 'Mi empresa', icon: Building2 },
  // La pantalla existía y estaba enrutada, pero sin entrada en el menú nadie
  // podía llegar: el Soporte del superadmin esperaba tickets que ningún usuario
  // tenía forma de crear.
  { to: '/app/soporte', label: 'Soporte', icon: LifeBuoy },
]

// clases del item de navegación (activo = turquesa + barra de acento + degradado)
const linkClasses = ({ isActive }: { isActive: boolean }) => clsx(
  'flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium transition-all',
  isActive
    ? 'text-[#42E0CE] font-bold bg-gradient-to-r from-[#123357] to-[#173961] shadow-[inset_3px_0_0_#21C8BA]'
    : 'text-[#AEBED0] hover:text-white hover:bg-[#102743] hover:translate-x-0.5'
)

export default function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const currentLabel = navItems.find(i =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)
  )?.label ?? 'Panel'

  const inicial = (profile?.nombre ?? profile?.email ?? 'U')[0].toUpperCase()

  // JSX en una variable (no un componente definido en el render): así React no
  // desmonta y vuelve a montar el menú en cada actualización.
  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo (blanco sobre fondo oscuro) */}
      <div className="px-2 pt-1 pb-6">
        <Logo variant="white" className="h-9" />
      </div>

      {/* Datos del usuario */}
      <div className="px-3 pb-4 mb-2 border-b border-[#20304A]">
        <p className="text-sm font-bold text-white">{profile?.nombre ?? 'Mi cuenta'}</p>
        <p className="text-[11px] text-[#3FD4C7] mt-0.5">
          Plan {(profile?.plan ?? 'gratis')[0].toUpperCase() + (profile?.plan ?? 'gratis').slice(1)} · {profile?.folios_balance ?? 0} folios
        </p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClasses}>
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Salir */}
      <div className="pt-3 mt-2 border-t border-[#20304A]">
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <LogOut className="w-[18px] h-[18px]" /> Salir
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-fondo">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-[276px] shrink-0 bg-navy-950 border-r border-[#20304A] px-4 py-6">
        {sidebar}
      </aside>

      {/* Sidebar móvil */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-[276px] bg-navy-950 border-r border-[#20304A] px-4 py-6 z-10">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-4 text-[#AEBED0] hover:text-white">
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-4 lg:px-8 h-16 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden text-navy-700"><Menu className="w-5 h-5" /></button>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase leading-none">Mi cuenta</p>
              <p className="text-sm font-bold text-navy-900 mt-0.5">{currentLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/app/cotizaciones/nueva')} className="hidden sm:inline-flex btn-navy text-xs">
              <Plus className="w-4 h-4" /> Nueva cotización
            </button>
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-navy-900 leading-none">{profile?.nombre ?? 'Usuario'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Plan {(profile?.plan ?? 'gratis')}</p>
              </div>
              <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">{inicial}</span>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
