import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from './Icon'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { t, language, toggleLanguage } = useLanguage()
  const navigate = useNavigate()

  const navItems = [
    { to: '/', icon: 'dashboard', label: t('nav.dashboard') },
    { to: '/pipeline', icon: 'view_kanban', label: t('nav.pipeline') },
    { to: '/leads', icon: 'group', label: t('nav.leads') },
    { to: '/proposals', icon: 'description', label: t('nav.proposals') },
    { to: '/calendar', icon: 'calendar_month', label: t('nav.calendar') },
    { to: '/activities', icon: 'pending_actions', label: t('nav.activities') },
  ]

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* TopAppBar */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-4 w-full bg-background">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-sm">
            {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h1 className="font-headline font-black italic text-2xl tracking-tight text-primary-container">
            {t('common.appName')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="px-3 py-1 text-xs font-bold rounded-full bg-surface-container-high text-on-surface"
          >
            {language === 'nl' ? 'EN' : 'NL'}
          </button>
          <span className="text-sm text-secondary hidden md:inline capitalize">
            {t(`common.role.${profile?.role || 'user'}`)}
          </span>
          {profile?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-outline"
            >
              <Icon name="admin_panel_settings" />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-outline"
          >
            <Icon name="logout" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pb-8">
        <Outlet />
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/70 backdrop-blur-xl z-50 rounded-t-3xl shadow-[0_-8px_32px_rgba(25,28,29,0.06)] border-t border-outline-variant/15">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-4 py-2 transition-all ${
                isActive
                  ? 'bg-primary-container text-white rounded-xl scale-105'
                  : 'text-outline hover:text-primary'
              }`
            }
          >
            <Icon name={item.icon} />
            <span className="font-label font-medium text-[10px] uppercase tracking-widest mt-1">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
