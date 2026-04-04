import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { getToken } from './lib/apiClient'
import { useEffect, useState } from 'react'
import AdminLogin from './components/Admin/AdminLogin'
import AdminDashboard from './components/Admin/AdminDashboard'
import { getAdminToken } from './lib/adminApi'

// Lazy-load heavy components to keep homepage bundle small
import { lazy, Suspense } from 'react'
const MapApp = lazy(() => import('./MapApp'))
const HomePage = lazy(() => import('./pages/HomePage'))

function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-ocean-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading ReelMaps...</p>
      </div>
    </div>
  )
}

function useAdminRoute() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash === '#admin')
  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash === '#admin')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return { isAdmin, exitAdmin: () => { window.location.hash = '' } }
}

/** Auth-gated route: if logged in, show children; otherwise redirect to homepage */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const [checking, setChecking] = useState(true)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    // If there's a token, validate it
    if (getToken()) {
      checkAuth().finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [checkAuth])

  if (checking) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Public route: if already logged in, redirect to /app */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const [checking, setChecking] = useState(true)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    if (getToken()) {
      checkAuth().finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [checkAuth])

  if (checking) return <LoadingScreen />
  if (user) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function App() {
  const { isAdmin, exitAdmin } = useAdminRoute()
  const [adminAuthed, setAdminAuthed] = useState(() => !!getAdminToken())

  // Admin route takes precedence (hash-based, unchanged)
  if (isAdmin) {
    if (!adminAuthed) {
      return <AdminLogin onLogin={() => setAdminAuthed(true)} onBack={exitAdmin} />
    }
    return <AdminDashboard onLogout={() => { setAdminAuthed(false); exitAdmin() }} />
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={
          <PublicRoute>
            <HomePage />
          </PublicRoute>
        } />
        <Route path="/app" element={
          <ProtectedRoute>
            <MapApp />
          </ProtectedRoute>
        } />
        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
