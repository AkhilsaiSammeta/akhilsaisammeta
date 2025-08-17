import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ResetPage from './pages/auth/ResetPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import './App.css'
import { useEffect, useState } from 'react'
import { onUser } from './lib/firebase'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="center">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}

function Layout({ children }) {
  const { user, signOut, configError } = useAuth()
  const [me, setMe] = useState(null)
  useEffect(() => {
    if (!user) { setMe(null); return }
    const unsub = onUser(user.uid, setMe)
    return () => unsub && unsub()
  }, [user])
  const toggleTheme = () => {
    const root = document.documentElement
    const light = root.getAttribute('data-theme') === 'light'
    root.setAttribute('data-theme', light ? 'dark' : 'light')
  }
  return (
    <div>
      <header className="topbar">
  <Link to="/" className="brand">Expense Tracker</Link>
        <nav style={{display:'flex', gap:'.75rem', alignItems:'center'}}>
          {me?.name && <span className="muted">Hi, <strong>{me.name}</strong></span>}
          <button className="btn btn-secondary" onClick={toggleTheme} title="Toggle theme">Theme</button>
      {user ? (
            <>
        <Link to="/" className="btn btn-ghost">Dashboard</Link>
        <Link to="/profile" className="btn btn-ghost">Profile</Link>
              <button className="btn btn-danger" onClick={() => signOut()}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">Login</Link>
              <Link to="/signup" className="btn btn-primary">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      {configError && (
        <div className="auth-card glass" style={{borderColor:'var(--danger)'}}>
          <strong>Firebase not configured.</strong>
          <div className="muted">Create a <code>.env</code> with keys from <code>.env.example</code>, then restart dev server.</div>
        </div>
      )}
      <main className="container">{children}</main>
    </div>
  )}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout>
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              </Layout>
            }
          />
          <Route path="/login" element={<Layout><LoginPage /></Layout>} />
          <Route path="/signup" element={<Layout><SignupPage /></Layout>} />
          <Route path="/reset" element={<Layout><ResetPage /></Layout>} />
          <Route path="/profile" element={<Layout><PrivateRoute><ProfilePage /></PrivateRoute></Layout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
