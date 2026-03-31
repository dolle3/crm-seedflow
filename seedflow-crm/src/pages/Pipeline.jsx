import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const STATUS_DOT = {
  new_lead: 'bg-outline-variant',
  message_sent: 'bg-secondary',
  no_response: 'bg-error',
  response_received: 'bg-tertiary',
  meeting_planned: 'bg-primary-fixed-dim',
  meeting_done: 'bg-primary',
  proposal_sent: 'bg-primary',
  won: 'bg-tertiary-fixed-dim',
  lost: 'bg-error',
}

const STATUS_CARD = {
  new_lead: '',
  message_sent: '',
  no_response: '',
  response_received: '',
  meeting_planned: '',
  meeting_done: '',
  proposal_sent: 'bg-primary text-on-primary shadow-lg shadow-primary/10',
  won: 'bg-tertiary-container text-on-tertiary-container',
  lost: 'bg-error-container/30 border border-error/10',
}

export default function Pipeline() {
  const { canEditLeads } = useAuth()
  const { t, locale } = useLanguage()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [proposals, setProposals] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    if (!supabase) return
    const [leadsRes, proposalsRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('proposals').select('lead_id, total').order('created_at', { ascending: false }),
    ])
    if (leadsRes.data) setLeads(leadsRes.data)
    if (proposalsRes?.data) setProposals(proposalsRes.data)
  }

  async function moveStatus(leadId, newStatus) {
    if (!canEditLeads) return

    if (newStatus === 'proposal_sent') {
      navigate(`/leads/${leadId}/offerte`)
      return
    }

    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)

    // Record closing date separately (column may not exist yet)
    if (newStatus === 'won' || newStatus === 'lost') {
      await supabase.from('leads').update({ closed_at: new Date().toISOString() }).eq('id', leadId).then(() => {})
    }

    // Sync linked deal
    const LEAD_TO_DEAL = {
      new_lead: 'lead', message_sent: 'lead', no_response: 'lead',
      response_received: 'qualified', meeting_planned: 'qualified', meeting_done: 'qualified',
      proposal_sent: 'proposal', won: 'closed_won', lost: 'closed_lost',
    }
    const dealStage = LEAD_TO_DEAL[newStatus]
    if (dealStage) {
      await supabase.from('deals').update({ stage: dealStage }).eq('lead_id', leadId)
    }

    fetchData()
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  }

  // Build proposal lookup by lead_id
  const proposalByLead = {}
  proposals.forEach(p => {
    if (!proposalByLead[p.lead_id]) proposalByLead[p.lead_id] = p
  })

  const statusLabels = Object.fromEntries(STATUSES.map(s => [s, t(`leads.statuses.${s}`)]))

  // Metrics
  const totalLeads = leads.length
  const activeLeads = leads.filter(l => l.status !== 'won' && l.status !== 'lost').length
  const wonLeads = leads.filter(l => l.status === 'won').length
  const proposalValue = leads
    .filter(l => l.status === 'proposal_sent')
    .reduce((sum, l) => sum + (proposalByLead[l.id]?.total || 0), 0)

  return (
    <div className="pb-8">
      {/* Header */}
      <section className="py-8">
        <div className="flex justify-between items-end">
          <div>
            <p className="font-label text-secondary text-[10px] uppercase tracking-[0.2em] mb-1">
              {t('pipeline.titleEyebrow')}
            </p>
            <h2 className="font-headline font-bold text-3xl text-on-surface tracking-tight">
              {t('pipeline.title')}
            </h2>
          </div>
          <Link
            to="/leads"
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/10 hover:opacity-90 transition-all"
          >
            <Icon name="person_add" className="text-xl" /> {t('pipeline.newLead')}
          </Link>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-5 rounded-2xl">
          <p className="font-label text-secondary text-[10px] uppercase tracking-widest">{t('pipeline.totalLeads')}</p>
          <p className="font-headline font-bold text-2xl text-on-surface mt-2">{totalLeads}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl">
          <p className="font-label text-secondary text-[10px] uppercase tracking-widest">{t('pipeline.activeLeads')}</p>
          <p className="font-headline font-bold text-2xl text-primary mt-2">{activeLeads}</p>
        </div>
        <div className="bg-tertiary-container p-5 rounded-2xl">
          <p className="font-label text-on-tertiary-container/70 text-[10px] uppercase tracking-widest">{t('pipeline.wonLeads')}</p>
          <p className="font-headline font-bold text-2xl text-on-tertiary-container mt-2">{wonLeads}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl">
          <p className="font-label text-secondary text-[10px] uppercase tracking-widest">{t('pipeline.openProposalValue')}</p>
          <p className="font-headline font-bold text-2xl text-on-surface mt-2">{formatCurrency(proposalValue)}</p>
        </div>
      </section>

      {/* Kanban Board */}
      <div className="flex overflow-x-auto no-scrollbar gap-5 snap-x snap-mandatory pb-4">
        {STATUSES.map((status) => {
          const columnLeads = leads.filter(l => l.status === status)
          const isSpecial = STATUS_CARD[status]

          return (
            <div key={status} className="min-w-[270px] w-[80vw] md:w-72 snap-center flex flex-col gap-3 shrink-0">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
                <Icon name={STATUS_ICONS[status]} className="text-base text-on-surface-variant" />
                <h3 className="font-headline font-bold text-sm text-on-surface">{statusLabels[status]}</h3>
                <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold ml-auto">
                  {columnLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3">
                {columnLeads.map((lead) => {
                  const proposal = proposalByLead[lead.id]

                  return (
                    <div
                      key={lead.id}
                      className={`p-4 rounded-2xl transition-all ${
                        isSpecial || 'bg-surface-container-lowest'
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        {proposal && (
                          <span className={`font-headline font-bold text-sm ${
                            status === 'proposal_sent' ? 'text-primary-fixed' : 'text-on-surface-variant'
                          }`}>
                            {formatCurrency(proposal.total || 0)}
                          </span>
                        )}
                      </div>

                      {/* Name & company */}
                      <Link to={`/leads/${lead.id}`}>
                        <h4 className={`font-bold text-sm leading-tight hover:underline ${
                          status === 'proposal_sent' ? 'text-on-primary' :
                          status === 'won' ? 'text-on-tertiary-container' :
                          'text-on-surface'
                        }`}>
                          {lead.name}
                        </h4>
                      </Link>
                      <p className={`text-xs mt-0.5 ${
                        status === 'proposal_sent' ? 'text-on-primary/70' :
                        status === 'won' ? 'text-on-tertiary-container/70' :
                        'text-secondary'
                      }`}>
                        {lead.company || t('pipeline.noCompany')}
                      </p>

                      {/* Contact info */}
                      {lead.email && (
                        <p className={`text-[10px] mt-2 truncate ${
                          status === 'proposal_sent' ? 'text-on-primary/60' :
                          status === 'won' ? 'text-on-tertiary-container/60' :
                          'text-outline'
                        }`}>
                          {lead.email}
                        </p>
                      )}

                      {/* Date */}
                      <p className={`text-[10px] mt-1 ${
                        status === 'proposal_sent' ? 'text-on-primary/50' :
                        status === 'won' ? 'text-on-tertiary-container/50' :
                        'text-outline'
                      }`}>
                        {lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
                          : ''}
                      </p>

                      {/* Quick move buttons */}
                      {canEditLeads && (
                        <div className="mt-3 pt-2 border-t border-outline-variant/10 flex gap-1 flex-wrap">
                          {/* Per-status action buttons */}
                          {(() => {
                            const btn = (key, label, style) => (
                              <button
                                key={key}
                                onClick={() => moveStatus(lead.id, key)}
                                className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${style}`}
                              >
                                {label}
                              </button>
                            )
                            const next = (key) => btn(key, `→ ${statusLabels[key]}`, status === 'proposal_sent' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-primary/10 text-primary hover:bg-primary/20')
                            const prev = (key) => btn(key, `← ${statusLabels[key]}`, status === 'proposal_sent' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest')
                            const won = btn('won', statusLabels.won, 'bg-tertiary-container/30 text-tertiary hover:bg-tertiary-container/50')
                            const lost = btn('lost', statusLabels.lost, 'bg-error-container/30 text-error hover:bg-error-container/50')
                            const reopen = btn('new_lead', `← ${t('pipeline.reopen')}`, 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest')

                            switch (status) {
                              case 'new_lead':
                                return [next('message_sent'), won, lost]
                              case 'message_sent':
                                return [next('no_response'), next('response_received'), lost]
                              case 'no_response':
                                return [prev('message_sent'), next('response_received'), lost]
                              case 'response_received':
                                return [next('meeting_planned'), won, lost]
                              case 'meeting_planned':
                                return [next('meeting_done'), lost]
                              case 'meeting_done':
                                return [next('proposal_sent'), won, lost]
                              case 'proposal_sent':
                                return [next('won'), lost]
                              case 'won':
                                return [reopen]
                              case 'lost':
                                return [reopen]
                              default:
                                return []
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
                {columnLeads.length === 0 && (
                  <div className="text-center py-8 text-outline text-xs">{t('pipeline.noLeads')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
