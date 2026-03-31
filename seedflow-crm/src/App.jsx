import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useLanguage } from './context/LanguageContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Pipeline from './pages/Pipeline'
import DealDetail from './pages/DealDetail'
import LeadDetail from './pages/LeadDetail'
import ProposalBuilder from './pages/ProposalBuilder'
import Proposals from './pages/Proposals'
import Activities from './pages/Activities'
import Calendar from './pages/Calendar'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-headline font-black italic text-3xl text-primary-container mb-2">{t('common.appName')}</h1>
          <p className="text-secondary">{t('common.loading')}</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="leads/:id/offerte" element={<ProposalBuilder />} />
            <Route path="proposals" element={<Proposals />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="deals/:id" element={<DealDetail />} />
            <Route path="activities" element={<Activities />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
