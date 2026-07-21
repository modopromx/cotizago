import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, MessageCircle, Mail, Smartphone, RefreshCw,
  ArrowRight, Play, Check, Pencil, Send, Menu, X,
  Home, Users, Settings, TrendingUp, Plus,
} from 'lucide-react'
import Logo from '../../components/Logo'
import { usePaquetes } from '../../lib/usePaquetes'

// ─── DATOS ────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Funciones', href: '#funciones' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Paquetes', href: '#paquetes' },
]

const IDEAL_PARA = ['Freelancers', 'Servicios', 'Comercios', 'Agencias', 'Profesionales']

// La primera (PDF) se pinta como tarjeta grande con preview; el resto, normales.
const FEATURES = [
  { icon: MessageCircle, title: 'Envía por WhatsApp',
    desc: 'Comparte la cotización con tu cliente sin descargar archivos ni cambiar de aplicación.' },
  { icon: Mail, title: 'Envío por email',
    desc: 'Personaliza el mensaje y envía el PDF directamente al correo de tu prospecto.' },
  { icon: Smartphone, title: 'Funciona como app',
    desc: 'Instálala en tu celular. No necesitas descargarla desde ninguna tienda.' },
  { icon: RefreshCw, title: 'Control y seguimiento',
    desc: 'Consulta, duplica, edita o cancela cotizaciones desde un solo lugar.' },
]

const STEPS = [
  { num: '01', icon: Pencil, title: 'Captura los datos', desc: 'Selecciona tu cliente, agrega conceptos, precios e impuestos.' },
  { num: '02', icon: FileText, title: 'Genera tu PDF', desc: 'Obtén un documento profesional con tu identidad de marca.' },
  { num: '03', icon: Send, title: 'Envía y da seguimiento', desc: 'Compártelo por WhatsApp o email en un solo toque.' },
]

// ─── COMPONENTES ──────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-navy-700 hover:text-primary-500 transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-navy-700 hover:text-primary-500 transition-colors">Iniciar sesión</Link>
          <Link to="/registro" className="btn-navy">Comenzar ahora</Link>
        </div>
        <button className="md:hidden text-navy-900" onClick={() => setOpen(o => !o)} aria-label="Menú">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{l.label}</a>
          ))}
          <Link to="/login" className="block text-sm font-medium text-navy-700">Iniciar sesión</Link>
          <Link to="/registro" className="btn-navy w-full justify-center">Comenzar ahora</Link>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute -right-32 top-10 w-96 h-96 rounded-full bg-primary-100/50 blur-3xl -z-10" />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-600 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> Cotizaciones desde cualquier lugar
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-navy-900 leading-[1.1]">
            Cotiza, envía y<br /><span className="text-primary-500">vende más.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-md">
            Crea cotizaciones profesionales en PDF desde tu celular o computadora. Envíalas al instante por WhatsApp o email y convierte oportunidades en ventas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/registro" className="btn-navy px-6 py-3 text-base justify-center">
              Crear mi primera cotización <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#como-funciona" className="btn-secondary px-6 py-3 text-base justify-center">
              <Play className="w-4 h-4" /> Ver cómo funciona
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {['Sin mensualidades', 'Acceso inmediato', 'PWA instalable'].map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Check className="w-4 h-4 text-success-500" /> {t}
              </span>
            ))}
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  )
}

function HeroMockup() {
  const navIcons = [Home, FileText, Users, Settings]
  return (
    <div className="relative">
      <div className="card p-0 shadow-card-hover flex overflow-hidden">
        {/* riel de navegación lateral */}
        <div className="w-12 bg-navy-900 flex flex-col items-center py-4 gap-5 shrink-0">
          <span className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center text-white text-[10px] font-bold">CG</span>
          {navIcons.map((Ic, i) => (
            <Ic key={i} className={`w-4 h-4 ${i === 0 ? 'text-white' : 'text-navy-300'}`} />
          ))}
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-400">Panel principal</p>
              <p className="font-bold text-navy-900">Hola, Alan 👋</p>
            </div>
            <span className="inline-flex items-center gap-1 bg-navy-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">
              <Plus className="w-3 h-3" /> Nueva cotización
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-fondo rounded-lg p-2.5">
              <p className="text-[10px] text-slate-400">Folios disponibles</p>
              <p className="text-xl font-extrabold text-navy-900">43</p>
              <p className="text-[10px] text-slate-400">de 50 folios</p>
            </div>
            <div className="bg-fondo rounded-lg p-2.5">
              <p className="text-[10px] text-slate-400">Cotizado este mes</p>
              <p className="text-xl font-extrabold text-primary-600">$86,450</p>
              <p className="text-[10px] text-success-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> 12.5%</p>
            </div>
            <div className="bg-fondo rounded-lg p-2.5">
              <p className="text-[10px] text-slate-400">Cotizaciones</p>
              <p className="text-xl font-extrabold text-navy-900">27</p>
              <p className="text-[10px] text-slate-400">8 aceptadas</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cotizaciones recientes</p>
          <div className="mt-2 space-y-1.5">
            {[['CTZ-0027', 'Grupo Nova', '$12,800'], ['CTZ-0026', 'Café Central', '$4,250'], ['CTZ-0025', 'Punto Digital', '$8,900']].map(r => (
              <div key={r[0]} className="flex items-center justify-between bg-fondo rounded-lg px-3 py-2 text-sm">
                <span className="font-mono text-[11px] text-slate-500">{r[0]} · {r[1]}</span>
                <span className="font-semibold text-navy-900">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* tarjeta flotante: cotización lista para WhatsApp */}
      <div className="absolute -right-4 -bottom-8 w-52 card p-4 shadow-card-hover hidden sm:block">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cotización</p>
        <p className="font-mono text-xs text-slate-500">#CTZ-0027</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">Total</span>
          <span className="font-extrabold text-navy-900">$12,800</span>
        </div>
        <button className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-success-500 text-white text-xs font-semibold rounded-lg py-2">
          <MessageCircle className="w-3.5 h-3.5" /> Enviar por WhatsApp
        </button>
      </div>

      {/* chip: cotización enviada */}
      <div className="absolute -left-4 top-8 bg-white rounded-xl shadow-card-hover border border-slate-100 px-3 py-2 flex items-center gap-2 hidden sm:flex">
        <span className="w-7 h-7 rounded-full bg-success-100 text-success-600 flex items-center justify-center"><Check className="w-4 h-4" /></span>
        <div>
          <p className="text-[11px] font-semibold text-navy-900">Cotización enviada</p>
          <p className="text-[10px] text-slate-400">WhatsApp · Ahora</p>
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  // La cinta solo desplaza los rubros; el título "IDEAL PARA" queda fijo encima.
  // Se repite la tira dentro de un track del doble de ancho: al recorrer -50%
  // en loop, el corte es invisible.
  const Tira = () => (
    <>
      {IDEAL_PARA.map((t, i) => (
        <span key={t + i} className="mx-6 inline-flex items-center gap-2 text-sm font-medium text-navy-700 shrink-0">
          <span className="text-primary-400">✦</span> {t}
        </span>
      ))}
    </>
  )
  return (
    <div className="border-y border-slate-100 bg-white py-6">
      <p className="text-center text-xs font-semibold tracking-widest text-slate-400 uppercase mb-4">Ideal para</p>
      <div className="overflow-hidden marquee-mask">
        <div className="flex w-max animate-marquee whitespace-nowrap">
          {/* dos mitades idénticas: el track mide 200%, la animación recorre -50% */}
          <div className="flex items-center shrink-0"><Tira /><Tira /><Tira /></div>
          <div className="flex items-center shrink-0" aria-hidden="true"><Tira /><Tira /><Tira /></div>
        </div>
      </div>
    </div>
  )
}

function AppComingSoon() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-600 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> Próximamente
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-navy-900 leading-tight">
          Cotiza Go también estará en tu bolsillo.
        </h2>
        <p className="mt-4 text-slate-600 max-w-md">
          Muy pronto podrás descargar la aplicación nativa y crear cotizaciones desde cualquier lugar, con una experiencia optimizada para tu celular.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <StoreBadge store="App Store" icon={<AppleIcon />} />
          <StoreBadge store="Google Play" icon={<PlayStoreIcon />} />
        </div>
        <p className="mt-4 text-xs text-slate-400">Mientras tanto, puedes instalar Cotiza Go como PWA desde tu navegador.</p>
      </div>
      <div className="relative flex justify-center py-10">
        {/* Anillos concéntricos ("ondas") detrás del teléfono */}
        <span className="orbit-ring pulse-1 w-[300px] h-[300px] hidden sm:block" />
        <span className="orbit-ring pulse-2 w-[400px] h-[400px] hidden sm:block" />
        <span className="orbit-ring pulse-3 w-[500px] h-[500px] hidden sm:block" />
        {/* Teléfono — réplica exacta del diseño original: 218x430, borde 7px,
            inclinado 3° con animación de flotación, tarjeta de folios en degradado. */}
        <div className="relative z-10 w-[218px] h-[430px] rounded-[34px] border-[7px] border-navy-900 pt-[30px] px-[15px] pb-[50px] animate-phone-float"
             style={{ background: '#f7fafb', boxShadow: '0 35px 65px rgba(5,38,61,0.25)' }}>
          {/* notch */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-[10px] bg-navy-900" />
          <img src="/cotiza-go-logo.png" alt="Cotiza Go" className="w-[90px]" />
          {/* saludo */}
          <div className="mt-[21px] mb-3">
            <small className="block text-[7px] tracking-wide" style={{ color: '#8b9aa2' }}>BUEN DÍA</small>
            <b className="block mt-0.5 text-base text-navy-900">Hola, Alan 👋</b>
          </div>
          {/* tarjeta de folios — degradado navy→turquesa, texto blanco, barra de progreso */}
          <div className="rounded-[14px] p-4 text-white" style={{ background: 'linear-gradient(135deg, #06243e, #07838e)' }}>
            <small className="block text-[7px] tracking-wide" style={{ color: '#93d9d8' }}>FOLIOS DISPONIBLES</small>
            <strong className="block my-1.5 text-[28px] font-extrabold leading-none">43</strong>
            <span className="block h-1 rounded" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <b className="block h-full rounded" style={{ width: '86%', background: '#39d8cf' }} />
            </span>
            <span className="block mt-1.5 text-[7px]" style={{ color: '#c3dfe2' }}>7 de 50 utilizados</span>
          </div>
          {/* botón nueva cotización */}
          <div className="mt-[13px] rounded-[11px] bg-white border p-[13px] text-xs shadow-sm" style={{ borderColor: '#dce7eb', color: '#07959b' }}>
            ＋ <b className="ml-1.5 text-[10px]" style={{ color: '#23465a' }}>Nueva cotización</b>
          </div>
          {/* barra de navegación inferior */}
          <div className="absolute bottom-2.5 left-3.5 right-3.5 rounded-xl bg-white flex justify-around p-2.5" style={{ color: '#91a1aa' }}>
            <Home className="w-4 h-4" style={{ color: '#08a6aa' }} /><FileText className="w-4 h-4" /><Users className="w-4 h-4" /><Settings className="w-4 h-4" />
          </div>
        </div>
        {/* chips flotantes de tiendas */}
        <span className="absolute left-2 top-8 z-20 bg-white rounded-xl shadow-card-hover border border-slate-100 px-4 py-2.5 text-center hidden sm:block">
          <span className="block text-sm font-bold text-navy-900">iOS</span>
          <span className="block text-[10px] text-slate-400">Próximamente</span>
        </span>
        <span className="absolute right-2 bottom-16 z-20 bg-white rounded-xl shadow-card-hover border border-slate-100 px-4 py-2.5 text-center hidden sm:block">
          <span className="block text-sm font-bold text-navy-900">Android</span>
          <span className="block text-[10px] text-slate-400">Próximamente</span>
        </span>
      </div>
    </section>
  )
}

function StoreBadge({ store, icon }: { store: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 bg-navy-900 text-white rounded-xl px-5 py-2.5 cursor-default select-none hover:bg-navy-800 transition-colors">
      {icon}
      <span className="text-left leading-tight">
        <span className="block text-[10px] text-slate-300">Próximamente en</span>
        <span className="block text-base font-semibold -mt-0.5">{store}</span>
      </span>
    </span>
  )
}

// Logo oficial de Apple (silueta monocromática blanca)
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.53c-.02-2.02 1.65-2.99 1.73-3.04-.94-1.38-2.4-1.57-2.92-1.59-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.3 2-1.41 2.44-.36 6.05 1.01 8.03.67.97 1.47 2.06 2.52 2.02 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-.99 2.44-1.96.77-1.12 1.09-2.21 1.11-2.27-.02-.01-2.13-.82-2.15-3.24zM15.09 6.6c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.14z"/>
    </svg>
  )
}

// Logo oficial de Google Play (triángulo a 4 colores)
function PlayStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
      <path fill="#00D26E" d="M4 3 4 12 13.2 12z" />
      <path fill="#00A0FF" d="M4 12 4 21 13.2 12z" />
      <path fill="#FFCE00" d="M4 3 13.2 12 20.4 12z" />
      <path fill="#FF3B30" d="M4 21 13.2 12 20.4 12z" />
    </svg>
  )
}

function Features() {
  return (
    <section id="funciones" className="max-w-6xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Todo lo que necesitas</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">Cotizar nunca fue tan fácil</h2>
        <p className="mt-4 text-slate-600">Olvídate de formatos complicados. Cotiza Go te ayuda a verte profesional y responder antes que tu competencia.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-5 md:grid-rows-2">
        {/* Tarjeta grande: PDF profesional, ocupa 2 filas con preview embebido */}
        <div className="card p-6 md:row-span-2 flex flex-col hover:shadow-card-hover transition-shadow group">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
            <FileText className="w-5 h-5" />
          </span>
          <h3 className="mt-4 font-semibold text-navy-900">PDF profesional en segundos</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">Agrega tu logotipo, productos, impuestos, descuentos y condiciones. Nosotros hacemos que se vea impecable.</p>
          <div className="mt-6 flex-1 flex items-end">
            <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cotización</span>
                <span className="font-mono text-[11px] text-slate-400">#0048</span>
              </div>
              <p className="mt-3 font-semibold text-navy-900 text-sm">Tu Empresa</p>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 bg-slate-100 rounded w-full" />
                <div className="h-2 bg-slate-100 rounded w-4/5" />
                <div className="h-2 bg-slate-100 rounded w-3/5" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total</span>
                <span className="font-extrabold text-navy-900">$18,450.00</span>
              </div>
            </div>
          </div>
        </div>
        {FEATURES.map(f => (
          <div key={f.title} className="card p-6 hover:shadow-card-hover transition-shadow group">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
              <f.icon className="w-5 h-5" />
            </span>
            <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section id="como-funciona" className="bg-fondo">
      <div className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Rápido y simple</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">De cero a cotización en 3 pasos</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative text-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-card text-primary-500">
                <s.icon className="w-6 h-6" />
              </span>
              <p className="mt-4 text-xs font-bold text-primary-500">{s.num}</p>
              <h3 className="mt-1 font-semibold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-6 -right-4 w-5 h-5 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const { paquetes } = usePaquetes()
  return (
    <section id="paquetes" className="max-w-6xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Paga solo por lo que usas</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">Elige tu paquete de folios</h2>
        <p className="mt-4 text-slate-600">Sin rentas mensuales ni contratos. Tus folios no caducan.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-6 items-start">
        {paquetes.map(p => (
          <div key={p.id}
            className={`card p-7 relative ${p.popular ? 'ring-2 ring-primary-500 shadow-card-hover md:-mt-4 md:pb-11' : ''}`}>
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">Más elegido</span>
            )}
            <h3 className="font-bold text-navy-900 text-lg">{p.nombre}</h3>
            <p className="text-sm text-slate-500">{p.descripcion}</p>
            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-primary-600">{p.folios}</span>
              <span className="text-slate-500 mb-1">folios</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">${p.precio} <span className="text-sm font-medium text-slate-400">{p.moneda ?? 'MXN'}</span></p>
            <Link to={`/registro?plan=${(p.nombre ?? '').toLowerCase()}`}
              className={`mt-5 w-full justify-center ${p.popular ? 'btn-primary' : 'btn-secondary'}`}>
              Elegir paquete
            </Link>
            <ul className="mt-6 space-y-2.5">
              {(p.beneficios ?? []).map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-success-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-400">🔒 Pago seguro · Activación inmediata · Folios acumulables</p>
    </section>
  )
}

function CtaBand() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-24">
      <div className="rounded-3xl px-8 py-14 sm:px-14 bg-gradient-to-br from-navy-900 to-primary-600 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary-200 uppercase">Empieza hoy</p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white max-w-lg">Una cotización rápida puede ser tu próxima venta.</h2>
          <p className="mt-3 text-primary-100/80">Crea tu cuenta, elige tus folios y empieza a cotizar profesionalmente.</p>
        </div>
        <Link to="/registro" className="shrink-0 inline-flex items-center gap-2 bg-white text-navy-900 font-semibold px-6 py-3 rounded-xl hover:bg-primary-50 transition-colors">
          Crear mi cuenta gratis <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    { title: 'Producto', links: ['Funciones', 'Paquetes', 'Iniciar sesión'] },
    { title: 'Soporte', links: ['Centro de ayuda', 'Contacto', 'Privacidad'] },
  ]
  return (
    <footer className="bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-slate-500 max-w-xs">Cotizaciones profesionales, estés donde estés.</p>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <p className="font-semibold text-navy-900 text-sm">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(l => <li key={l} className="text-sm text-slate-500 hover:text-primary-500 cursor-pointer">{l}</li>)}
            </ul>
          </div>
        ))}
        <div>
          <p className="font-semibold text-navy-900 text-sm">Cotiza sin complicaciones</p>
          <p className="mt-3 text-sm text-slate-500 max-w-xs">Disponible desde cualquier dispositivo.</p>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <p className="max-w-6xl mx-auto px-4 py-5 text-xs text-slate-400">© 2026 Cotiza Go. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <Nav />
      <Hero />
      <Marquee />
      <Features />
      <Steps />
      <AppComingSoon />
      <Pricing />
      <CtaBand />
      <Footer />
    </div>
  )
}
