import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  FileText, LayoutDashboard, Users, Package, Layers, CreditCard,
  Settings, HelpCircle, LogOut, Menu, X, ChevronDown, Bell, Zap
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/productos', label: 'Productos', icon: Package },
  { to: '/app/plantillas', label: 'Plantillas', icon: Layers },
  { to: '/app/folios', label: 'Folios', icon: CreditCard },
  { to: '/app/configuracion', label: 'Configuración', icon: Settings },
  { to: '/app/soporte', label: 'Soporte', icon: HelpCircle },
]

export default function AppLayout() {
  const { profile, signOut, isAdminUser } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <img src="/logo-icon.svg" width={30} height={35} alt="CotizaGo" />
          <span className="font-extrabold text-slate-800 text-lg tracking-tight">CotizaGo</span>
        </div>
      </div>

      {/* Folios badge */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between bg-primary-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-medium text-primary-700">Folios disponibles</span>
          </div>
          <span className="text-sm font-bold text-primary-700">{profile?.folios_balance ?? 0}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-slate-100">
        {isAdminUser && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg text-xs font-medium text-navy-700 bg-navy-50 hover:bg-navy-100 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Panel Admin
          </button>
        )}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-700">
              {(profile?.nombre ?? profile?.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{profile?.nombre ?? 'Usuario'}</p>
            <p className="text-xs text-slate-500 truncate">{profile?.empresa ?? profile?.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-red-500 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-white shadow-xl z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-800">CotizaGo</span>
          </div>
          <div className="w-5" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
