import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const STATUSES = [
  'new_lead',
  'message_sent',
  'no_response',
  'response_received',
  'meeting_planned',
  'meeting_done',
  'proposal_sent',
  'won',
  'lost',
]

const STATUS_ICONS = {
  new_lead: 'person_add',
  message_sent: 'send',
  no_response: 'schedule',
  response_received: 'mark_email_read',
  meeting_planned: 'event',
  meeting_done: 'task_alt',
  proposal_sent: 'description',
  won: 'emoji_events',
  lost: 'cancel',
}

const STATUS_COLORS = {
  new_lead: 'bg-surface-container-high text-on-surface-variant',
  message_sent: 'bg-secondary-container text-on-secondary-container',
  no_response: 'bg-error-container text-on-error-container',
  response_received: 'bg-tertiary-container text-on-tertiary-container',
  meeting_planned: 'bg-primary-container text-on-primary-container',
  meeting_done: 'bg-primary text-on-primary',
  proposal_sent: 'bg-secondary-container text-on-secondary-container',
  won: 'bg-tertiary-container text-on-tertiary-container',
  lost: 'bg-error-container text-on-error-container',
}

const PROPOSAL_TIMER_MS = 90 * 60 * 1000

// Maps lead status → deal stage for pipeline sync
const LEAD_TO_DEAL_STAGE = {
  new_lead: 'lead',
  message_sent: 'lead',
  no_response: 'lead',
  response_received: 'qualified',
  meeting_planned: 'qualified',
  meeting_done: 'qualified',
  proposal_sent: 'proposal',
  won: 'closed_won',
  lost: 'closed_lost',
}

// Main steps (excludes 'lost' which is shown separately)
const MAIN_STATUSES = STATUSES.filter(s => s !== 'lost')

export default function LeadDetail() {
  const { canEditLeads, canDeleteLeads, canCreateActivities } = useAuth()
  const { t, locale } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()

  const [lead, setLead] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [lostReasonSaved, setLostReasonSaved] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    type: 'zoom',
    url: '',
  })

  useEffect(() => {
    fetchLead()
    fetchNotes()
  }, [id])

  // Countdown timer for proposal
  useEffect(() => {
    if (!lead?.proposal_timer_started_at) {
      setTimeLeft(null)
      return
    }
    function tick() {
      const elapsed = Date.now() - new Date(lead.proposal_timer_started_at).getTime()
      setTimeLeft(PROPOSAL_TIMER_MS - elapsed)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [lead?.proposal_timer_started_at])

  async function fetchLead() {
    const { data } = await supabase.from('leads').select('*').eq('id', id).single()
    if (data) {
      setLead(data)
      setLostReason(data.lost_reason || '')
      setLostReasonSaved(false)

      // Ensure linked deal stays in sync (fixes pre-existing data)
      const dealStage = LEAD_TO_DEAL_STAGE[data.status]
      if (dealStage) {
        await supabase.from('deals').update({ stage: dealStage }).eq('lead_id', id).neq('stage', dealStage)
      }
    }
  }

  async function fetchNotes() {
    const { data } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
  }

  async function handleStatusChange(newStatus) {
    if (!canEditLeads) return

    if (newStatus === 'meeting_planned') {
      setShowMeetingForm(true)
      return
    }

    if (newStatus === 'proposal_sent') {
      navigate(`/leads/${id}/offerte`)
      return
    }

    const updates = { status: newStatus }

    // Start 1.5h proposal timer when moving from meeting_done → proposal_sent
    if (newStatus === 'proposal_sent' && lead.status === 'meeting_done') {
      updates.proposal_timer_started_at = new Date().toISOString()
    }

    await supabase.from('leads').update(updates).eq('id', id)

    // Record closing date when lead is won or lost (separate update, column may not exist yet)
    if (newStatus === 'won' || newStatus === 'lost') {
      await supabase.from('leads').update({ closed_at: new Date().toISOString() }).eq('id', id).then(() => {})
    } else if (lead.closed_at) {
      await supabase.from('leads').update({ closed_at: null }).eq('id', id).then(() => {})
    }

    // Sync to pipeline: update linked deal stage
    const dealStage = LEAD_TO_DEAL_STAGE[newStatus]
    if (dealStage) {
      await supabase.from('deals').update({ stage: dealStage }).eq('lead_id', id)
    }

    fetchLead()
  }

  async function handleMeetingSubmit(e) {
    e.preventDefault()
    if (!canCreateActivities) return

    const scheduled_at = `${meetingForm.date}T${meetingForm.time}:00`
    const desc =
      meetingForm.type === 'zoom'
        ? `Zoom meeting met ${lead.name}${meetingForm.url ? ` — ${meetingForm.url}` : ''}`
        : `Afspraak met ${lead.name}`

    await supabase.from('activities').insert({
      type: 'meeting',
      description: desc,
      scheduled_at,
      lead_id: id,
    })
    await supabase.from('leads').update({ status: 'meeting_planned' }).eq('id', id)
    await supabase.from('deals').update({ stage: 'qualified' }).eq('lead_id', id)

    setShowMeetingForm(false)
    setMeetingForm({ date: new Date().toISOString().split('T')[0], time: '10:00', type: 'zoom', url: '' })
    fetchLead()
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    await supabase.from('lead_notes').insert({ lead_id: id, content: noteText })
    setNoteText('')
    fetchNotes()
  }

  async function handleSaveLostReason() {
    await supabase.from('leads').update({ lost_reason: lostReason }).eq('id', id)
    setLostReasonSaved(true)
    setTimeout(() => setLostReasonSaved(false), 2000)
  }

  async function handleDelete() {
    if (!canDeleteLeads) return
    if (!confirm(t('leads.confirmDelete'))) return
    await supabase.from('lead_notes').delete().eq('lead_id', id)
    await supabase.from('leads').delete().eq('id', id)
    navigate('/leads')
  }

  function formatTimer(ms) {
    if (ms <= 0) return { text: t('leads.detail.timerExpiredLabel'), overdue: true }
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    const text =
      h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`
    return { text, overdue: false }
  }

  if (!lead) return <div className="py-20 text-center text-secondary">{t('common.loading')}</div>

  const STATUS_LABELS = Object.fromEntries(STATUSES.map(s => [s, t(`leads.statuses.${s}`)]))
  const statusIndex = STATUSES.indexOf(lead.status)
  const timer = timeLeft !== null ? formatTimer(timeLeft) : null

  return (
    <div className="pt-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => navigate('/leads')}
            className="text-primary font-bold text-sm hover:underline flex items-center gap-1 mb-3"
          >
            <Icon name="arrow_back" className="text-sm" /> {t('leads.detail.backToLeads')}
          </button>
          <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-1">{lead.name}</h2>
          <p className="text-secondary text-lg">{lead.company || t('leads.noCompany')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[lead.status] || 'bg-surface-container-high text-on-surface-variant'}`}
          >
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
          {canDeleteLeads && (
            <button
              onClick={handleDelete}
              className="p-2 bg-error-container text-on-error-container rounded-xl hover:opacity-80 transition-opacity"
            >
              <Icon name="delete" className="text-base" />
            </button>
          )}
        </div>
      </div>

      {/* Proposal Timer */}
      {lead.status === 'proposal_sent' && timer && (
        <div
          className={`mb-6 p-6 rounded-2xl flex items-center gap-5 ${
            timer.overdue
              ? 'bg-error-container text-on-error-container'
              : 'bg-tertiary-container text-on-tertiary-container'
          }`}
        >
          <Icon name="timer" className="text-4xl shrink-0" />
          <div>
            <p className="font-label text-xs uppercase tracking-widest opacity-70 mb-1">
              {t('leads.detail.proposalTimer')}
            </p>
            <p className="font-headline text-4xl font-black tabular-nums">{timer.text}</p>
            <p className="text-sm opacity-70 mt-1">
              {timer.overdue ? t('leads.detail.timerExpired') : t('leads.detail.timerRemaining')}
            </p>
          </div>
        </div>
      )}

      {/* Status stepper */}
      {canEditLeads && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl mb-6 shadow-sm">
          <p className="font-label text-[10px] uppercase tracking-widest text-secondary mb-5">
            {t('leads.detail.progress')}
          </p>

          {/* Main flow steps */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex items-center min-w-max">
              {MAIN_STATUSES.map((s, i) => {
                const sIndex = STATUSES.indexOf(s)
                const isActive = s === lead.status
                const isDone = !isActive && statusIndex > sIndex && lead.status !== 'lost'
                const isLast = i === MAIN_STATUSES.length - 1

                return (
                  <div key={s} className="flex items-center">
                    <button
                      onClick={() => handleStatusChange(s)}
                      title={STATUS_LABELS[s]}
                      className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all text-center w-[88px] ${
                        isActive
                          ? 'bg-primary text-on-primary shadow-md'
                          : isDone
                          ? 'text-primary opacity-70 hover:opacity-100 hover:bg-primary-container/30'
                          : 'text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <Icon name={STATUS_ICONS[s]} className="text-xl" filled={isActive || isDone} />
                      <span className="text-[9px] font-bold leading-tight">{STATUS_LABELS[s]}</span>
                    </button>
                    {!isLast && (
                      <div
                        className={`w-5 h-[2px] shrink-0 ${isDone || isActive ? 'bg-primary' : 'bg-outline-variant/30'}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lost button (separate, below the main flow) */}
          <div className="mt-5 pt-4 border-t border-outline-variant/10">
            <button
              onClick={() => handleStatusChange('lost')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                lead.status === 'lost'
                  ? 'bg-error text-on-error'
                  : 'bg-error-container/40 text-on-error-container hover:bg-error-container'
              }`}
            >
              <Icon name="cancel" className="text-sm" filled={lead.status === 'lost'} />
              {STATUS_LABELS.lost}
            </button>
          </div>
        </div>
      )}

      {/* Meeting Scheduler (shown when clicking "Gesprek gepland") */}
      {showMeetingForm && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl mb-6 shadow-sm border border-primary/20">
          <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
            <Icon name="event" className="text-primary" /> {t('leads.detail.scheduleMeeting')}
          </h3>
          <form onSubmit={handleMeetingSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={meetingForm.type}
                onChange={e => setMeetingForm({ ...meetingForm, type: e.target.value })}
                className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
              >
                <option value="zoom">{t('leads.detail.meetingZoom')}</option>
                <option value="inperson">{t('leads.detail.meetingInPerson')}</option>
              </select>
              <input
                value={meetingForm.date}
                onChange={e => setMeetingForm({ ...meetingForm, date: e.target.value })}
                type="date"
                required
                className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={meetingForm.time}
                onChange={e => setMeetingForm({ ...meetingForm, time: e.target.value })}
                type="time"
                className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
              />
              {meetingForm.type === 'zoom' && (
                <input
                  value={meetingForm.url}
                  onChange={e => setMeetingForm({ ...meetingForm, url: e.target.value })}
                  placeholder={t('leads.detail.meetingUrl')}
                  className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20"
                />
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold">
                {t('leads.detail.meetingSubmit')}
              </button>
              <button
                type="button"
                onClick={() => setShowMeetingForm(false)}
                className="px-6 py-3 rounded-xl font-bold text-secondary"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main column */}
        <div className="md:col-span-8 space-y-6">
          {/* Lost reason section */}
          {lead.status === 'lost' && (
            <div className="bg-error-container/20 border border-error/20 p-6 rounded-2xl">
              <h3 className="font-headline font-bold text-lg mb-3 flex items-center gap-2 text-on-error-container">
                <Icon name="feedback" className="text-error" /> {t('leads.detail.lostReason')}
              </h3>
              {lead.closed_at && (
                <p className="text-sm text-on-error-container/70 mb-3 flex items-center gap-1.5">
                  <Icon name="event" className="text-sm" />
                  {t('leads.detail.closedAt')}: {new Date(lead.closed_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <textarea
                value={lostReason}
                onChange={e => { setLostReason(e.target.value); setLostReasonSaved(false) }}
                placeholder={t('leads.detail.lostReasonPlaceholder')}
                className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-on-surface min-h-[100px] focus:ring-2 focus:ring-error/20 resize-none"
              />
              <button
                onClick={handleSaveLostReason}
                className={`mt-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  lostReasonSaved
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'bg-error text-on-error'
                }`}
              >
                {lostReasonSaved ? '✓ Opgeslagen' : t('leads.detail.save')}
              </button>
            </div>
          )}

          {/* Add note */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
            <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
              <Icon name="edit_note" className="text-primary" /> {t('leads.detail.addNote')}
            </h3>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder={t('leads.detail.notePlaceholder')}
              className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all min-h-[120px] resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="bg-primary text-white px-4 py-2 rounded-xl font-label text-sm font-bold shadow-md disabled:opacity-40"
              >
                {t('leads.detail.postNote')}
              </button>
            </div>
          </div>

          {/* Notes timeline */}
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm">
            <h3 className="font-headline font-bold text-lg mb-6">{t('leads.detail.notes')}</h3>
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-outline-variant/20">
              {notes.length === 0 && (
                <p className="text-secondary text-sm pl-10">{t('leads.detail.noNotes')}</p>
              )}
              {notes.map(note => (
                <div key={note.id} className="relative pl-10">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary border-4 border-primary-fixed-dim ring-4 ring-primary/5" />
                  <p className="text-sm text-on-surface whitespace-pre-wrap">{note.content}</p>
                  <p className="font-label text-[10px] uppercase text-secondary mt-1">
                    {new Date(note.created_at).toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="md:col-span-4 space-y-6">
          {/* Contact card */}
          <div className="bg-primary text-on-primary p-6 rounded-3xl shadow-xl shadow-primary/10 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-3xl" />
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold mb-4">
              {lead.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <p className="font-headline text-xl font-bold">{lead.name}</p>
            <p className="text-sm opacity-70 mb-4">{lead.company || t('leads.noCompany')}</p>
            <div className="space-y-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl text-sm hover:bg-white/20 transition-colors"
                >
                  <Icon name="mail" className="text-sm shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl text-sm hover:bg-white/20 transition-colors"
                >
                  <Icon name="call" className="text-sm shrink-0" />
                  <span>{lead.phone}</span>
                </a>
              )}
              {lead.location && (
                <div className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl text-sm">
                  <Icon name="location_on" className="text-sm shrink-0" />
                  <span>{lead.location}</span>
                </div>
              )}
              {lead.website_url && (
                <a
                  href={lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl text-sm hover:bg-white/20 transition-colors"
                >
                  <Icon name="language" className="text-sm shrink-0" />
                  <span className="truncate">{lead.website_url}</span>
                </a>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <h4 className="font-headline text-sm font-bold mb-5">{t('leads.detail.details')}</h4>
            <div className="space-y-5 text-sm">
              <div>
                <p className="font-label text-[10px] uppercase text-secondary mb-1">{t('common.stage')}</p>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[lead.status] || ''}`}
                >
                  {STATUS_LABELS[lead.status] || lead.status}
                </span>
              </div>
              <div>
                <p className="font-label text-[10px] uppercase text-secondary mb-1">{t('leads.detail.created')}</p>
                <p className="font-semibold">
                  {new Date(lead.created_at).toLocaleDateString(locale, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {lead.closed_at && (
                <div>
                  <p className="font-label text-[10px] uppercase text-secondary mb-1">
                    {t('leads.detail.closedAtLabel')}
                  </p>
                  <p className="font-semibold">
                    {new Date(lead.closed_at).toLocaleDateString(locale, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {lead.lost_reason && (
                <div>
                  <p className="font-label text-[10px] uppercase text-secondary mb-1">
                    {t('leads.detail.lostReasonLabel')}
                  </p>
                  <p className="text-on-surface-variant text-xs leading-relaxed">{lead.lost_reason}</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
