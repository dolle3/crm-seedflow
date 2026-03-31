import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const TYPES = ['call', 'email', 'meeting', 'note', 'deadline']

export default function Calendar() {
  const { canCreateActivities, canDeleteActivities } = useAuth()
  const { t, locale } = useLanguage()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activities, setActivities] = useState([])
  const [leads, setLeads] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'meeting', description: '', time: '09:00', lead_id: '' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' })

  useEffect(() => { fetchActivities(); fetchLeads() }, [month, year])

  async function fetchActivities() {
    if (!supabase) return
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const { data } = await supabase
      .from('activities')
      .select('*, leads(name, company)')
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .order('scheduled_at', { ascending: true })
    if (data) setActivities(data)
  }

  async function fetchLeads() {
    if (!supabase) return
    const { data } = await supabase.from('leads').select('id, name, company').order('name')
    if (data) setLeads(data)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreateActivities) return
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    const scheduled_at = `${dateStr}T${form.time}:00`
    await supabase.from('activities').insert({
      type: form.type,
      description: form.description,
      scheduled_at,
      lead_id: form.lead_id || null,
    })
    setForm({ type: 'meeting', description: '', time: '09:00', lead_id: '' })
    setShowForm(false)
    fetchActivities()
  }

  async function handleDelete(id) {
    if (!supabase || !canDeleteActivities) return
    await supabase.from('activities').delete().eq('id', id)
    fetchActivities()
  }

  function getDaysInMonth() {
    const firstDay = new Date(year, month, 1)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    const days = []
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, current: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, current: true })
    }
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false })
    }
    return days
  }

  function getActivitiesForDay(day) {
    return activities.filter(a => {
      const d = new Date(a.scheduled_at)
      return d.getDate() === day && d.getMonth() === month
    })
  }

  const selStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  const selectedActivities = activities.filter(a => a.scheduled_at?.startsWith(selStr))
  const isToday = (day) => {
    const t = new Date()
    return day === t.getDate() && month === t.getMonth() && year === t.getFullYear()
  }
  const isSelected = (day) => {
    return day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()
  }

  const typeIcons = { call: 'call', email: 'mail', meeting: 'groups', note: 'edit_note', deadline: 'priority_high' }
  const typeColors = {
    call: 'bg-primary-fixed text-primary',
    email: 'bg-secondary-container text-secondary',
    meeting: 'bg-tertiary-fixed text-tertiary',
    note: 'bg-surface-container-high text-secondary',
    deadline: 'bg-error-container text-error',
  }

  const TYPE_LABELS = {
    call: t('activities.types.call'),
    email: t('activities.types.email'),
    meeting: t('activities.types.meeting'),
    note: t('activities.types.note'),
    deadline: t('activities.types.deadline'),
  }
  const weekdays = t('calendar.weekdaysShort')

  return (
    <div className="mt-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">{t('calendar.title')}</h2>
        {canCreateActivities && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:opacity-90 transition-all"
          >
            <Icon name="add" className="text-xl" /> {t('calendar.newEvent')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Calendar */}
        <div className="md:col-span-5">
          <div className="bg-surface-container-lowest rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="font-headline font-bold text-lg capitalize">{monthName}</h3>
              <div className="flex gap-1">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-surface-container rounded-lg transition-colors">
                  <Icon name="chevron_left" />
                </button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-surface-container rounded-lg transition-colors">
                  <Icon name="chevron_right" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-3 text-center">
              {weekdays.map(d => (
                <div key={d} className="font-label text-[10px] uppercase tracking-widest text-outline">{d}</div>
              ))}
              {getDaysInMonth().map((d, i) => {
                const dayActivities = d.current ? getActivitiesForDay(d.day) : []
                const selected = d.current && isSelected(d.day)
                return (
                  <div
                    key={i}
                    onClick={() => d.current && setSelectedDate(new Date(year, month, d.day))}
                    className={`p-2 font-medium relative cursor-pointer rounded-lg transition-colors ${
                      !d.current ? 'text-outline-variant' :
                      selected ? 'bg-primary text-white font-bold shadow-md' :
                      isToday(d.day) ? 'bg-primary-fixed-dim text-on-primary-fixed font-bold' :
                      'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {d.day}
                    {d.current && dayActivities.length > 0 && !selected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayActivities.slice(0, 3).map((a, j) => (
                          <span key={j} className={`w-1 h-1 rounded-full ${a.type === 'deadline' ? 'bg-error' : a.type === 'meeting' ? 'bg-tertiary' : 'bg-primary'}`} />
                        ))}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-surface-container-low rounded-2xl p-6 mt-6">
            <p className="font-label text-[10px] uppercase tracking-widest text-secondary mb-3">{t('calendar.thisMonth')}</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-headline font-bold text-2xl text-on-surface">{activities.filter(a => a.type === 'meeting').length}</p>
                <p className="text-[10px] text-secondary uppercase">{t('calendar.meetings')}</p>
              </div>
              <div>
                <p className="font-headline font-bold text-2xl text-on-surface">{activities.filter(a => a.type === 'call').length}</p>
                <p className="text-[10px] text-secondary uppercase">{t('calendar.calls')}</p>
              </div>
              <div>
                <p className="font-headline font-bold text-2xl text-error">{activities.filter(a => a.type === 'deadline').length}</p>
                <p className="text-[10px] text-secondary uppercase">{t('calendar.deadlines')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Day Activities */}
        <div className="md:col-span-7">
          <h3 className="font-headline font-bold text-lg mb-4">
            {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>

          {/* Quick add form */}
          {showForm && canCreateActivities && (
            <div className="bg-surface-container-lowest p-5 rounded-2xl mb-4 shadow-sm">
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 capitalize">
                    {TYPES.map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
                  </select>
                  <input value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} type="time"
                    className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
                </div>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('calendar.description')} required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
                <select value={form.lead_id} onChange={e => setForm({ ...form, lead_id: e.target.value })}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20">
                  <option value="">{t('calendar.noLinkedLead')}</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
                </select>
                <div className="flex gap-3">
                  <button type="submit" className="bg-primary text-white px-5 py-2 rounded-xl font-bold text-sm">{t('calendar.add')}</button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl font-bold text-sm text-secondary">{t('common.cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {selectedActivities.length === 0 && (
              <div className="text-center py-12 bg-surface-container-lowest rounded-2xl">
                <Icon name="event_available" className="text-4xl text-outline-variant mb-2" />
                <p className="text-secondary text-sm">{t('calendar.noActivities')}</p>
                {canCreateActivities && (
                  <button onClick={() => setShowForm(true)} className="text-primary font-bold text-sm mt-2 hover:underline">
                    {t('calendar.addEvent')}
                  </button>
                )}
              </div>
            )}
            {selectedActivities.map(a => (
              <div key={a.id} className="bg-surface-container-lowest p-5 rounded-2xl flex items-start gap-4 group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[a.type] || typeColors.note}`}>
                  <Icon name={typeIcons[a.type] || 'event'} className="text-xl" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-on-surface">{a.description}</p>
                  {a.leads && <p className="text-sm text-secondary">{a.leads.name} {a.leads.company ? `• ${a.leads.company}` : ''}</p>}
                  <p className="text-xs text-outline mt-1">
                    {a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : t('activities.noTime')}
                  </p>
                </div>
                {canDeleteActivities && (
                  <button onClick={() => handleDelete(a.id)} className="text-outline hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                    <Icon name="delete" className="text-lg" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
