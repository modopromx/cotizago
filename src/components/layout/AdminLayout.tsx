import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import Logo from '../Logo'
import MenuUsuario from '../MenuUsuario'
import NotificacionesAdmin from '../NotificacionesAdmin'
import SelectorIdioma from '../SelectorIdioma'
import {
  LayoutDashboard, Users, FileText, CreditCard, Package2, Blocks,
  LifeBuoy, UserCog, ScrollText, Settings, LogOut, Menu, X, ArrowLeft, Mail, Receipt, Gift,
} from 'lucide-react'
import clsx from 'clsx'

const adminNav = [
  { to: '/admin', labelKey: 'shell.resumenGlobal', icon: LayoutDashboard, end: true },
  { to: '/admin/usuarios', labelKey: 'shell.usuarios', icon: Users },
  { to: '/admin/cotizaciones', labelKey: 'shell.cotizaciones', icon: FileText },
  { to: '/admin/pagos', labelKey: 'shell.pagos', icon: CreditCard },
  { to: '/admin/referidos', labelKey: 'shell.afiliados', icon: Gift },
  { to: '/admin/facturacion', labelKey: 'shell.facturacionAdmin', icon: Receipt },
  { to: '/admin/paquetes', labelKey: 'shell.paquetesFolios', icon: Package2 },
  { to: '/admin/modulos', labelKey: 'shell.planesModulos', icon: Blocks },
  { to: '/admin/clientes', labelKey: 'shell.clientes', icon: Blocks },
  { to: '/admin/email-templates', labelKey: 'shell.plantillasEmail', icon: Mail },
  { to: '/admin/soporte', labelKey: 'shell.soporte', icon: LifeBuoy },
  { to: '/admin/equipo', labelKey: 'shell.equipo', icon: UserCog },
  { to: '/admin/logs', labelKey: 'shell.auditoria', icon: ScrollText },
  { to: '/admin/config', labelKey: 'shell.configGlobal', icon: Settings },
]

const linkClasses = ({ isActive }: { isActive: boolean }) => clsx(
  'flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium transition-all',
  isActive
    ? 'text-[#42E0CE] font-bold bg-gradient-to-r from-[#123357] to-[#173961] shadow-[inset_3px_0_0_#21C8BA]'
    : 'text-[#AEBED0] hover:text-white hover:bg-[#102743] hover:translate-x-0.5'
)

export default function AdminLayout() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // Menú móvil accesible: Escape lo cierra, el foco entra al abrir y vuelve
  // a la hamburguesa al cerrar.
  const hamburguesa = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    drawer.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', tecla)
    const boton = hamburguesa.current
    return () => { document.removeEventListener('keydown', tecla); boton?.focus() }
  }, [open])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const current = adminNav.find(i => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))
  const currentLabel = current ? t(current.labelKey) : t('shell.superadminShort')

  // JSX en variable, no componente en el render (evita re-montajes).
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex justify-center pt-1 pb-5"><Logo variant="chip" className="h-10" /></div>
      <div className="px-3 pb-4 mb-2 border-b border-[#20304A]">
        <p className="text-[10px] font-semibold tracking-widest text-[#3FD4C7] uppercase">{t('shell.controlCentral')}</p>
        <p className="text-sm font-bold text-white mt-0.5">{t('shell.superadmin')}</p>
      </div>
      <nav aria-label={t('shell.superadmin')} className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {adminNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClasses}>
            <item.icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />{t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="pt-3 mt-2 border-t border-[#20304A] space-y-1">
        <Link to="/app" className="flex items-center gap-3 px-3.5 py-2.5 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" /> {t('shell.volverPanel')}
        </Link>
        <button type="button" onClick={handleSignOut} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <LogOut className="w-[18px] h-[18px]" aria-hidden="true" /> {t('shell.salir')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh bg-fondo">
      <aside className="hidden lg:flex flex-col w-[276px] shrink-0 bg-navy-950 border-r border-[#20304A] px-4 py-6">
        {sidebar}
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside ref={drawer} id="menu-movil" role="dialog" aria-modal="true" aria-label={t('shell.menu', { defaultValue: 'Menú' })}
            className="relative w-[276px] max-w-[85vw] h-dvh overflow-y-auto bg-navy-950 border-r border-[#20304A] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10">
            <button type="button" onClick={() => setOpen(false)} aria-label={t('shell.cerrarMenu', { defaultValue: 'Cerrar menú' })}
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#AEBED0] hover:text-white hover:bg-[#102743]">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-4 lg:px-8 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <button ref={hamburguesa} type="button" onClick={() => setOpen(true)}
              aria-label={t('shell.abrirMenu', { defaultValue: 'Abrir menú' })} aria-expanded={open} aria-controls="menu-movil"
              className="lg:hidden -ml-2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-navy-700 hover:bg-slate-100">
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase leading-none">{t('shell.cotizaGoControl')}</p>
              <p className="text-sm font-bold text-navy-900 mt-0.5">{currentLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-success-700 font-medium"><span className="w-2 h-2 rounded-full bg-success-500" aria-hidden="true" /> {t('shell.operativo')}</span>
            <SelectorIdioma />
            <NotificacionesAdmin />
            <MenuUsuario />
          </div>
        </header>
        <main id="contenido" className="flex-1 overflow-y-auto p-4 lg:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-8"><Suspense fallback={<div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Cargando" /></div>}><Outlet /></Suspense></main>
      </div>
    </div>
  )
}
