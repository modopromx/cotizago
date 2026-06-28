import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// Landing
import LandingPage from './pages/landing/LandingPage'

// Auth
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// App (cliente)
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/app/DashboardPage'
import CotizacionesPage from './pages/app/CotizacionesPage'
import NuevaCotizacionPage from './pages/app/NuevaCotizacionPage'
import EditarCotizacionPage from './pages/app/EditarCotizacionPage'
import ClientesPage from './pages/app/ClientesPage'
import ProductosPage from './pages/app/ProductosPage'
import PlantillasPage from './pages/app/PlantillasPage'
import FoliosPage from './pages/app/FoliosPage'
import ConfiguracionPage from './pages/app/ConfiguracionPage'
import SoportePage from './pages/app/SoportePage'

// Admin
import AdminLayout from './components/layout/AdminLayout'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsuariosPage from './pages/admin/AdminUsuariosPage'
import AdminCotizacionesPage from './pages/admin/AdminCotizacionesPage'
import AdminClientesPage from './pages/admin/AdminClientesPage'
import AdminPagosPage from './pages/admin/AdminPagosPage'
import AdminPaquetesPage from './pages/admin/AdminPaquetesPage'
import AdminSoportePage from './pages/admin/AdminSoportePage'
import AdminConfigPage from './pages/admin/AdminConfigPage'
import AdminLogsPage from './pages/admin/AdminLogsPage'
import AdminEquipoPage from './pages/admin/AdminEquipoPage'
import AdminWhatsAppPage from './pages/admin/AdminWhatsAppPage'
import AdminEmailTemplatesPage from './pages/admin/AdminEmailTemplatesPage'

// Público
import CotizacionPublicaPage from './pages/public/CotizacionPublicaPage'

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

function AppRoutes() {
  const { user, isAdminUser } = useAuth()

  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<LandingPage />} />

      {/* Público - cotización */}
      <Route path="/c/:token" element={<CotizacionPublicaPage />} />

      {/* Auth */}
      <Route path="/login" element={user ? <Navigate to={isAdminUser ? '/admin' : '/app'} /> : <LoginPage />} />
      <Route path="/registro" element={user ? <Navigate to="/app" /> : <RegisterPage />} />

      {/* App cliente */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="cotizaciones" element={<CotizacionesPage />} />
        <Route path="cotizaciones/nueva" element={<NuevaCotizacionPage />} />
        <Route path="cotizaciones/:id/editar" element={<EditarCotizacionPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="plantillas" element={<PlantillasPage />} />
        <Route path="folios" element={<FoliosPage />} />
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
        <Route path="paquetes" element={<AdminPaquetesPage />} />
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
        <AppRoutes />
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
