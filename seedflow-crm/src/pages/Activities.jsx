import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const TYPES = ['call', 'email', 'meeting', 'note', 'deadline']

export default function Activities() {
  const { canCreateActivities, canDeleteActivities } = useAuth()
  const { t, locale } = useLanguage()
  const [activities, setActivities] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'call', description: '', scheduled_at: '', lead_id: null })
  const [leads, setLeads] = useState([])

  useEffect(() => { fetchActivities(); fetchLeads() }, [])

  async function fetchActivities() {
    const { data } = await supabase.from('activities').select('*, leads(name, company)').order('scheduled_at', { ascending: true })
    if (data) setActivities(data)
  }

  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('id, name, company').order('name')
    if (data) setLeads(data)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreateActivities) return
    await supabase.from('activities').insert({
      ...form,
      lead_id: form.lead_id || null,
    })
    setForm({ type: 'call', description: '', scheduled_at: '', lead_id: null })
    setShowForm(false)
    fetchActivities()
  }

  async function handleDelete(id) {
    if (!canDeleteActivities) return
    await supabase.from('activities').delete().eq('id', id)
    fetchActivities()
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const todayActivities = activities.filter(a => a.scheduled_at?.startsWith(todayStr))
  const upcomingActivities = activities.filter(a => a.scheduled_at > todayStr)
  const pastActivities = activities.filter(a => a.scheduled_at < todayStr)

  const typeColors = {
    call: 'bg-primary',
    email: 'bg-secondary',
    meeting: 'bg-tertiary',
    note: 'bg-outline-variant',
    deadline: 'bg-error',
  }

  const typeIcons = {
    call: 'call',
    email: 'mail',
    meeting: 'groups',
    note: 'edit_note',
    deadline: 'priority_high',
  }

  const TYPE_LABELS = {
    call: t('activities.types.call'),
    email: t('activities.types.email'),
    meeting: t('activities.types.meeting'),
    note: t('activities.types.note'),
    deadline: t('activities.types.deadline'),
  }

  function renderTimeline(items, label) {
    return (
      <div className="mb-10">
        <h3 className="font-headline font-bold text-lg mb-6 text-on-surface">{label}</h3>
        <div className="relative pl-8">
          <div className="absolute left-0 top-2 bottom-0 w-[2px] bg-outline-variant opacity-20" />
          <div className="space-y-8">
            {items.length === 0 && <p className="text-secondary text-sm">{t('activities.noActivities')}</p>}
            {items.map((a) => (
              <div key={a.id} className="relative">
                <div className={`absolute -left-[37px] top-1.5 w-4 h-4 rounded-full border-4 border-background ring-4 ring-primary/5 ${typeColors[a.type] || 'bg-outline-variant'}`} />
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="w-24 shrink-0 pt-1">
                    <span className="font-label text-sm font-bold text-on-surface">
                      {a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : t('activities.noTime')}
                    </span>
                    <span className="block text-[11px] text-outline uppercase tracking-wider font-medium capitalize">{TYPE_LABELS[a.type] || a.type}</span>
                  </div>
                  <div className="flex-grow bg-surface-container-lowest p-6 rounded-2xl hover:translate-x-1 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
                        <Icon name={typeIcons[a.type] || 'event'} className="text-primary" />
                        {a.description || t('activities.untitled')}
                      </h4>
                      {canDeleteActivities && (
                        <button onClick={() => handleDelete(a.id)} className="text-outline hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                          <Icon name="close" className="text-sm" />
                        </button>
                      )}
                    </div>
                    {a.leads && (
                      <p className="text-secondary text-sm">
                        {a.leads.name} {a.leads.company ? `• ${a.leads.company}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 max-w-5xl mx-auto">
      {/* Header */}
      <section className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface mb-2">{t('activities.title')}</h2>
          <p className="text-secondary text-lg">{t('activities.subtitle')}</p>
        </div>
        {canCreateActivities && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all hover:opacity-90 active:scale-95 shadow-sm"
          >
            <Icon name="add" className="text-xl" /> {t('activities.newEvent')}
          </button>
        )}
      </section>

      {/* Form */}
      {showForm && canCreateActivities && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl mb-8 shadow-sm">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 capitalize">
              {TYPES.map(t => <option key={t} value={t} className="capitalize">{TYPE_LABELS[t] || t}</option>)}
            </select>
            <input value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} type="datetime-local"
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('activities.description')} required
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <select value={form.lead_id || ''} onChange={e => setForm({ ...form, lead_id: e.target.value || null })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20">
              <option value="">{t('activities.noLinkedLead')}</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
            </select>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold">{t('activities.create')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl font-bold text-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Timelines */}
      {renderTimeline(todayActivities, t('activities.today'))}
      {renderTimeline(upcomingActivities, t('activities.upcoming'))}
      {renderTimeline(pastActivities, t('activities.past'))}
    </div>
  )
}
