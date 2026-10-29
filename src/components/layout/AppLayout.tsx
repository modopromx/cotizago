import { Outlet, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Suspense, useEffect, useRef, useState } from 'react'
import { iniciarTour } from '../../lib/tours'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import Logo from '../Logo'
import MenuUsuario from '../MenuUsuario'
import SelectorIdioma from '../SelectorIdioma'
import AvisosCliente from '../AvisosCliente'
import {
  LayoutDashboard, FileText, Users, Package, Coins, Blocks,
  Mail, Building2, LogOut, Menu, X, Plus, LifeBuoy, Plug, BookOpen, Gift,
} from 'lucide-react'
import clsx from 'clsx'
import { enApp } from '../../lib/enApp'

// Menú del panel según el diseño de referencia. labelKey → i18n (shell.*)
const navItems = [
  { to: '/app', labelKey: 'shell.resumen', icon: LayoutDashboard, end: true },
  { to: '/app/cotizaciones', labelKey: 'shell.cotizaciones', icon: FileText },
  { to: '/app/clientes', labelKey: 'shell.clientes', icon: Users },
  { to: '/app/productos', labelKey: 'shell.productos', icon: Package },
  { to: '/app/folios', labelKey: 'shell.comprarFolios', icon: Coins },
  { to: '/app/invita', labelKey: 'shell.invita', icon: Gift },
  { to: '/app/modulos', labelKey: 'shell.modulos', icon: Blocks },
  { to: '/app/plantillas', labelKey: 'shell.plantillas', icon: Mail },
  { to: '/app/configuracion', labelKey: 'shell.miEmpresa', icon: Building2 },
  // La pantalla existía y estaba enrutada, pero sin entrada en el menú nadie
  // podía llegar: el Soporte del superadmin esperaba tickets que ningún usuario
  // tenía forma de crear.
  { to: '/app/soporte', labelKey: 'shell.soporte', icon: LifeBuoy },
]

// clases del item de navegación (activo = turquesa + barra de acento + degradado)
const linkClasses = ({ isActive }: { isActive: boolean }) => clsx(
  'flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium transition-all',
  isActive
    ? 'text-[#42E0CE] font-bold bg-gradient-to-r from-[#123357] to-[#173961] shadow-[inset_3px_0_0_#21C8BA]'
    : 'text-[#AEBED0] hover:text-white hover:bg-[#102743] hover:translate-x-0.5'
)

export default function AppLayout() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
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

  // Onboarding: si venimos con ?tour=<clave>, lanzamos el globo guía en la
  // pantalla y limpiamos el parámetro para que no se repita al recargar.
  useEffect(() => {
    const tour = searchParams.get('tour')
    if (!tour) return
    iniciarTour(tour)
    const next = new URLSearchParams(searchParams)
    next.delete('tour')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, searchParams])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const current = navItems.find(i =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)
  )
  const currentLabel = current ? t(current.labelKey) : t('shell.panel')

  // JSX en una variable (no un componente definido en el render): así React no
  // desmonta y vuelve a montar el menú en cada actualización.
  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo a color en placa blanca, centrado */}
      <div className="flex justify-center pt-1 pb-6">
        <Logo variant="chip" className="h-10" />
      </div>

      {/* Datos del usuario */}
      <div className="px-3 pb-4 mb-2 border-b border-[#20304A]">
        <p className="text-sm font-bold text-white">{profile?.nombre ?? 'Mi cuenta'}</p>
        <p className="text-[11px] text-[#3FD4C7] mt-0.5">
          {t('shell.plan')} {(profile?.plan ?? 'gratis')[0].toUpperCase() + (profile?.plan ?? 'gratis').slice(1)} · {profile?.folios_balance ?? 0} {t('shell.folios')}
        </p>
      </div>

      {/* Navegación */}
      <nav aria-label={t('shell.panel')} className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {navItems.filter(i => !(enApp() && i.to === '/app/folios')).map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClasses}>
            <item.icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Parte baja: API y Salir */}
      <div className="pt-3 mt-2 border-t border-[#20304A] flex flex-col gap-1">
        <NavLink to="/app/api" onClick={() => setOpen(false)} className={linkClasses}>
          <Plug className="w-[18px] h-[18px] shrink-0" aria-hidden="true" /> {t('shell.api')}
        </NavLink>
        <a href="/ayuda" target="_blank" rel="noreferrer"
          className="flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <BookOpen className="w-[18px] h-[18px] shrink-0" aria-hidden="true" /> {t('shell.docs')}
        </a>
        <button type="button" onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[11px] text-[13px] font-medium text-[#AEBED0] hover:text-white hover:bg-[#102743] transition-colors">
          <LogOut className="w-[18px] h-[18px]" aria-hidden="true" /> {t('shell.salir')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh bg-fondo">
      {/* Avisos en vivo cuando el cliente abre/acepta/rechaza una cotización */}
      <AvisosCliente />
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-[276px] shrink-0 bg-navy-950 border-r border-[#20304A] px-4 py-6">
        {sidebar}
      </aside>

      {/* Sidebar móvil */}
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

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-4 lg:px-8 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <button ref={hamburguesa} type="button" onClick={() => setOpen(true)}
              aria-label={t('shell.abrirMenu', { defaultValue: 'Abrir menú' })} aria-expanded={open} aria-controls="menu-movil"
              className="lg:hidden -ml-2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-navy-700 hover:bg-slate-100">
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase leading-none">{t('shell.miCuenta')}</p>
              <p className="text-sm font-bold text-navy-900 mt-0.5">{currentLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/app/cotizaciones/nueva')} className="hidden sm:inline-flex btn-navy text-xs">
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('shell.nuevaCotizacion')}
            </button>
            <div className="flex items-center gap-2.5">
              <SelectorIdioma />
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-navy-900 leading-none">{profile?.nombre ?? t('shell.usuario')}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('shell.plan')} {(profile?.plan ?? 'gratis')}</p>
              </div>
              <MenuUsuario />
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main id="contenido" className="flex-1 overflow-y-auto p-4 lg:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-8">
          <Suspense fallback={<div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Cargando" /></div>}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  )
}
