import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Logo from '../Logo'
import {
  LayoutDashboard, Users, FileText, CreditCard, Package2, Blocks,
  LifeBuoy, UserCog, ScrollText, Settings, LogOut, Menu, X, ArrowLeft, Mail,
} from 'lucide-react'
import clsx from 'clsx'

const adminNav = [
  { to: '/admin', label: 'Resumen global', icon: LayoutDashboard, end: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/admin/pagos', label: 'Pagos y cobros', icon: CreditCard },
  { to: '/admin/paquetes', label: 'Paquetes de folios', icon: Package2 },
  { to: '/admin/clientes', label: 'Clientes', icon: Blocks },
  { to: '/admin/email-templates', label: 'Plantillas email', icon: Mail },
  { to: '/admin/soporte', label: 'Soporte', icon: LifeBuoy },
  { to: '/admin/equipo', label: 'Equipo', icon: UserCog },
  { to: '/admin/logs', label: 'Auditoría', icon: ScrollText },
  { to: '/admin/config', label: 'Configuración global', icon: Settings },
]

const linkClasses = ({ isActive }: { isActive: boolean }) => clsx(
  'flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium transition-all',
  isActive
    ? 'text-[#42E0CE] font-bold bg-gradient-to-r from-[#123357] to-[#173961] shadow-[inset_3px_0_0_#21C8BA]'
    : 'text-[#AEBED0] hover:text-white hover:bg-[#102743] hover:translate-x-0.5'
)

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const currentLabel = adminNav.find(i => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))?.label ?? 'Superadmin'
  const inicial = (profile?.nombre ?? profile?.email ?? 'A')[0].toUpperCase()

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-1 pb-4"><Logo variant="white" className="h-9" /></div>
      <div className="px-3 pb-4 mb-2 border-b border-[#20304A]">
        <p className="text-[10px] font-semibold tracking-widest text-[#3FD4C7] uppercase">Control central</p>
        <p className="text-sm font-bold text-white mt-0.5">Superadministrador</p>
      </div>
      <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {adminNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClasses}>
            <item.icon className="w-[18px] h-[18px] shrink-0" />{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="pt-3 mt-2 border-t border-[#20304A] space-y-1">
        <Link to="/app" className="flex items-center gap-3 px-3.5 py-2.5 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <ArrowLeft className="w-[18px] h-[18px]" /> Volver a mi panel
        </Link>
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <LogOut className="w-[18px] h-[18px]" /> Salir
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-fondo">
      <aside className="hidden lg:flex flex-col w-[276px] shrink-0 bg-navy-950 border-r border-[#20304A] px-4 py-6">
        <Sidebar />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-[276px] bg-navy-950 border-r border-[#20304A] px-4 py-6 z-10">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-4 text-[#AEBED0] hover:text-white"><X className="w-5 h-5" /></button>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-4 lg:px-8 h-16 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden text-navy-700"><Menu className="w-5 h-5" /></button>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase leading-none">Cotiza Go · Control central</p>
              <p className="text-sm font-bold text-navy-900 mt-0.5">{currentLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-success-600 font-medium"><span className="w-2 h-2 rounded-full bg-success-500" /> Operativo</span>
            <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">{inicial}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
