import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, supabaseConfigured } = useAuth()
  const { t, language, toggleLanguage } = useLanguage()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-headline font-black italic text-4xl tracking-tight text-primary-container mb-2">
            {t('common.appName')}
          </h1>
          <p className="text-secondary text-lg">{t('login.title')}</p>
          <button onClick={toggleLanguage} className="mt-4 px-3 py-1 text-xs font-bold rounded-full bg-surface-container-high text-on-surface">
            {language === 'nl' ? 'EN' : 'NL'}
          </button>
        </div>

        {!supabaseConfigured && (
          <div className="bg-error-container text-on-error-container px-4 py-4 rounded-2xl text-sm mb-6">
            <p className="font-bold mb-1">{t('login.supabaseMissingTitle')}</p>
            <p>{t('login.supabaseMissingBody')}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm space-y-6">
          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="font-label text-xs uppercase tracking-widest text-secondary block mb-2">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </div>

          <div>
            <label className="font-label text-xs uppercase tracking-widest text-secondary block mb-2">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
