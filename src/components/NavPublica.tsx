// Menú de navegación para las páginas públicas (Contacto, Privacidad).
// Los enlaces de secciones apuntan al landing con ancla (/#funciones), y suma
// el enlace de Contacto. Mismo estilo que el header del landing.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import SelectorIdioma from './SelectorIdioma'
import { enApp } from '../lib/enApp'

const NAV = [
  { key: 'nav.features', href: '/#funciones' },
  { key: 'nav.how', href: '/#como-funciona' },
  { key: 'nav.pricing', href: '/#paquetes' },
]

export default function NavPublica() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Escape cierra el menú móvil.
  useEffect(() => {
    if (!open) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [open])

  // App de Android: sin Paquetes (precios) ni «Comenzar ahora» (política de
  // Google Play); solo volver al panel.
  if (enApp()) return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/app" aria-label="Cotiza Go" className="hover:opacity-80 transition-opacity"><Logo className="h-10" /></Link>
        <div className="flex items-center gap-2">
          <SelectorIdioma />
          <Link to="/app" className="btn-navy whitespace-nowrap text-xs px-3">{t('app.volver')}</Link>
        </div>
      </div>
    </header>
  )

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" aria-label="Cotiza Go — inicio" className="hover:opacity-80 transition-opacity"><Logo className="h-10" /></Link>
        <nav aria-label="Principal" className="hidden md:flex items-center gap-8">
          {NAV.map(l => (
            <Link key={l.href} to={l.href} className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t(l.key)}</Link>
          ))}
          <Link to="/contacto" className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t('footer.contact')}</Link>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <SelectorIdioma />
          <Link to="/login" className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t('nav.login')}</Link>
          <Link to="/registro" className="btn-navy">{t('nav.start')}</Link>
        </div>
        <div className="md:hidden flex items-center gap-1">
          <SelectorIdioma />
          <button type="button" className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-navy-900 hover:bg-slate-100"
            onClick={() => setOpen(o => !o)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="menu-publico-movil">
            {open ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-publico-movil" aria-label="Principal" className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {NAV.map(l => (
            <Link key={l.href} to={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{t(l.key)}</Link>
          ))}
          <Link to="/contacto" onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{t('footer.contact')}</Link>
          <Link to="/login" className="block text-sm font-medium text-navy-700">{t('nav.login')}</Link>
          <Link to="/registro" className="btn-navy w-full justify-center">{t('nav.start')}</Link>
        </nav>
      )}
    </header>
  )
}
