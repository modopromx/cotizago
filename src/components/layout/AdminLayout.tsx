import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  FileText, LayoutDashboard, Users, CreditCard, Package2, LifeBuoy,
  Settings, LogOut, Menu, X, Shield, ChevronLeft, UserCog, ScrollText, MessageCircle, Mail
} from 'lucide-react'
import clsx from 'clsx'

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/admin/paquetes', label: 'Paquetes Folios', icon: Package2 },
  { to: '/admin/soporte', label: 'Soporte', icon: LifeBuoy },
  { to: '/admin/equipo', label: 'Equipo', icon: UserCog },
  { to: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { to: '/admin/email-templates', label: 'Plantillas Email', icon: Mail },
  { to: '/admin/logs', label: 'Logs', icon: ScrollText },
  { to: '/admin/config', label: 'Configuración', icon: Settings },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-navy-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">CotizaGo</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Shield className="w-3 h-3 text-navy-400" />
          <span className="text-xs text-navy-400 font-medium">Panel Administrador</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {adminNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-navy-700 text-white'
                : 'text-navy-300 hover:bg-navy-800 hover:text-white'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-navy-800">
        <button
          onClick={() => navigate('/app')}
          className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Volver a mi cuenta
        </button>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary-400">
              {(profile?.nombre ?? 'A')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.nombre ?? 'Admin'}</p>
            <p className="text-xs text-navy-400 truncate">{profile?.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-navy-400 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="hidden lg:flex flex-col w-60 bg-navy-950 flex-shrink-0">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-navy-950 shadow-xl z-10">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-navy-400">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-navy-950 border-b border-navy-800">
          <button onClick={() => setSidebarOpen(true)} className="text-navy-300">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-white text-sm">Admin · CotizaGo</span>
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
