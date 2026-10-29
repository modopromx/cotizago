import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AvisoActualizacion from './components/AvisoActualizacion'

// La portada se carga de inmediato; todo lo demás bajo demanda (React.lazy),
// para que la landing no descargue el panel, el PDF, las gráficas ni Stripe.
// Landing
import LandingPage from './pages/landing/LandingPage'

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const RecuperarPage = lazy(() => import('./pages/auth/RecuperarPage'))
const NuevaContrasenaPage = lazy(() => import('./pages/auth/NuevaContrasenaPage'))

// App (cliente)
const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const DashboardPage = lazy(() => import('./pages/app/DashboardPage'))
const CotizacionesPage = lazy(() => import('./pages/app/CotizacionesPage'))
const NuevaCotizacionPage = lazy(() => import('./pages/app/NuevaCotizacionPage'))
const EditarCotizacionPage = lazy(() => import('./pages/app/EditarCotizacionPage'))
const ClientesPage = lazy(() => import('./pages/app/ClientesPage'))
const ProductosPage = lazy(() => import('./pages/app/ProductosPage'))
const ModulosPage = lazy(() => import('./pages/app/ModulosPage'))
const PlantillasPage = lazy(() => import('./pages/app/PlantillasPage'))
const FoliosPage = lazy(() => import('./pages/app/FoliosPage'))
const InvitaPage = lazy(() => import('./pages/app/InvitaPage'))
const FacturasPage = lazy(() => import('./pages/app/FacturasPage'))
const ApiKeysPage = lazy(() => import('./pages/app/ApiKeysPage'))
const ConfiguracionPage = lazy(() => import('./pages/app/ConfiguracionPage'))
const SoportePage = lazy(() => import('./pages/app/SoportePage'))

// Admin
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminUsuariosPage = lazy(() => import('./pages/admin/AdminUsuariosPage'))
const AdminCotizacionesPage = lazy(() => import('./pages/admin/AdminCotizacionesPage'))
const AdminClientesPage = lazy(() => import('./pages/admin/AdminClientesPage'))
const AdminPagosPage = lazy(() => import('./pages/admin/AdminPagosPage'))
const AdminPaquetesPage = lazy(() => import('./pages/admin/AdminPaquetesPage'))
const AdminModulosPage = lazy(() => import('./pages/admin/AdminModulosPage'))
const AdminSoportePage = lazy(() => import('./pages/admin/AdminSoportePage'))
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'))
const AdminFacturacionPage = lazy(() => import('./pages/admin/AdminFacturacionPage'))
const AdminReferidosPage = lazy(() => import('./pages/admin/AdminReferidosPage'))
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'))
const AdminEquipoPage = lazy(() => import('./pages/admin/AdminEquipoPage'))
const AdminWhatsAppPage = lazy(() => import('./pages/admin/AdminWhatsAppPage'))
const AdminEmailTemplatesPage = lazy(() => import('./pages/admin/AdminEmailTemplatesPage'))

// Público
const CotizacionPublicaPage = lazy(() => import('./pages/public/CotizacionPublicaPage'))
const ContactoPage = lazy(() => import('./pages/public/ContactoPage'))
const PrivacidadPage = lazy(() => import('./pages/public/PrivacidadPage'))
const TerminosPage = lazy(() => import('./pages/public/TerminosPage'))
const ApiDocsPage = lazy(() => import('./pages/public/ApiDocsPage'))
const FacturarPage = lazy(() => import('./pages/public/FacturarPage'))
const DocumentacionPage = lazy(() => import('./pages/public/DocumentacionPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdminUser } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdminUser) return <Navigate to="/app" replace />
  return <>{children}</>
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

/** Red de seguridad de la recuperación de contraseña: si Supabase manda el enlace
 *  del correo a la portada (pasa cuando la URL no está en su lista de redirecciones
 *  permitidas), el evento PASSWORD_RECOVERY igual lleva a /nueva-contrasena. */
function RedirigirRecuperacion() {
  const navigate = useNavigate()
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === 'PASSWORD_RECOVERY' && window.location.pathname !== '/nueva-contrasena') navigate('/nueva-contrasena')
    })
    return () => subscription.unsubscribe()
  }, [navigate])
  return null
}

/** Con sesión, /registro?plan=X lleva directo a pagar ese paquete (antes iba al
 *  panel y el paquete elegido en la portada se perdía). */
function RegistroConSesion() {
  const plan = new URLSearchParams(window.location.search).get('plan')
  return <Navigate to={plan ? `/app/folios?paquete=${encodeURIComponent(plan)}` : '/app'} replace />
}

function AppRoutes() {
  const { user, isAdminUser } = useAuth()

  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<LandingPage />} />

      {/* Público - cotización */}
      <Route path="/c/:token" element={<CotizacionPublicaPage />} />

      {/* Público - contacto y privacidad */}
      <Route path="/contacto" element={<ContactoPage />} />
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/api" element={<ApiDocsPage />} />
      <Route path="/ayuda" element={<DocumentacionPage />} />
      <Route path="/facturar" element={<FacturarPage />} />

      {/* Auth */}
      <Route path="/login" element={user ? <Navigate to={isAdminUser ? '/admin' : '/app'} /> : <LoginPage />} />
      <Route path="/registro" element={user ? <RegistroConSesion /> : <RegisterPage />} />
      <Route path="/recuperar" element={<RecuperarPage />} />
      {/* Sin redirección por sesión: el enlace del correo ABRE una sesión temporal. */}
      <Route path="/nueva-contrasena" element={<NuevaContrasenaPage />} />

      {/* App cliente */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="cotizaciones" element={<CotizacionesPage />} />
        <Route path="cotizaciones/nueva" element={<NuevaCotizacionPage />} />
        <Route path="cotizaciones/:id/editar" element={<EditarCotizacionPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="modulos" element={<ModulosPage />} />
        <Route path="plantillas" element={<PlantillasPage />} />
        <Route path="folios" element={<FoliosPage />} />
        <Route path="invita" element={<InvitaPage />} />
        <Route path="facturas" element={<FacturasPage />} />
        <Route path="api" element={<ApiKeysPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="soporte" element={<SoportePage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="usuarios" element={<AdminUsuariosPage />} />
        <Route path="cotizaciones" element={<AdminCotizacionesPage />} />
        <Route path="clientes" element={<AdminClientesPage />} />
        <Route path="pagos" element={<AdminPagosPage />} />
        <Route path="referidos" element={<AdminReferidosPage />} />
        <Route path="facturacion" element={<AdminFacturacionPage />} />
        <Route path="paquetes" element={<AdminPaquetesPage />} />
        <Route path="modulos" element={<AdminModulosPage />} />
        <Route path="soporte" element={<AdminSoportePage />} />
        <Route path="equipo" element={<AdminEquipoPage />} />
        <Route path="whatsapp" element={<AdminWhatsAppPage />} />
        <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
        <Route path="config" element={<AdminConfigPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RedirigirRecuperacion />
        <Suspense fallback={<Spinner />}>
          <AppRoutes />
        </Suspense>
        <AvisoActualizacion />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '14px', borderRadius: '10px' },
            success: { iconTheme: { primary: '#1e7363', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
