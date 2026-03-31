import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

export default function Admin() {
  const { canManageUsers } = useAuth()
  const { t } = useLanguage()
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'sales' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    if (data) setUsers(data)
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Create user via Supabase auth - this uses the service role ideally,
    // but for client-side we use signUp then update profile
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          role: form.role,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data?.user) {
      // Upsert profile
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
      })
      if (upsertError) {
        setError(upsertError.message)
        return
      }
    }

    setSuccess(t('admin.userCreated', { email: form.email }))
    setForm({ email: '', password: '', full_name: '', role: 'sales' })
    setShowForm(false)
    fetchUsers()
  }

  async function handleUpdateRole(userId, newRole) {
    setError('')
    setSuccess('')
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) {
      setError(error.message)
      return
    }
    setSuccess(t('admin.roleUpdated'))
    fetchUsers()
  }

  async function handleDeleteUser(userId) {
    if (!confirm(t('admin.confirmDelete'))) return
    setError('')
    setSuccess('')
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) {
      setError(error.message)
      return
    }
    setSuccess(t('admin.userDeleted'))
    fetchUsers()
  }

  if (!canManageUsers) {
    return (
      <div className="py-20 text-center">
        <Icon name="lock" className="text-4xl text-error mb-4" />
        <h2 className="font-headline font-bold text-2xl text-on-surface">{t('admin.accessDeniedTitle')}</h2>
        <p className="text-secondary mt-2">{t('admin.accessDeniedBody')}</p>
      </div>
    )
  }

  const roleStyles = {
    admin: 'bg-error-container text-on-error-container',
    manager: 'bg-tertiary-container text-on-tertiary-container',
    sales: 'bg-secondary-container text-on-secondary-container',
  }

  return (
    <div className="mt-8 max-w-4xl mx-auto">
      <section className="mb-10">
        <h1 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">{t('admin.title')}</h1>
        <p className="text-secondary text-lg">{t('admin.subtitle')}</p>
      </section>

      {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}
      {success && <div className="bg-tertiary-container text-on-tertiary-container px-4 py-3 rounded-xl text-sm mb-4">{success}</div>}

      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 mb-6"
      >
        <Icon name="person_add" /> {t('admin.addUser')}
      </button>

      {showForm && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl mb-8 shadow-sm">
          <h3 className="font-bold text-lg mb-4">{t('admin.newUser')}</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder={t('admin.fullName')} required
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('admin.email')} type="email" required
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={t('admin.password')} type="password" required minLength={6}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20">
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold">{t('admin.createUser')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl font-bold text-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {users.map(u => (
          <div key={u.id} className="bg-surface-container-lowest p-6 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-lg">
                {u.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h3 className="font-bold text-on-surface">{u.full_name || t('admin.noName')}</h3>
                <p className="text-sm text-secondary">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={u.role || 'sales'}
                onChange={e => handleUpdateRole(u.id, e.target.value)}
                className={`border-none rounded-full px-3 py-1 text-xs font-bold ${roleStyles[u.role] || roleStyles.sales}`}
              >
                <option value="sales">Sales</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={() => handleDeleteUser(u.id)} className="text-error hover:bg-error-container p-2 rounded-lg transition-colors">
                <Icon name="delete" className="text-sm" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-secondary text-center py-8">{t('admin.noUsers')}</p>}
      </div>
    </div>
  )
}
