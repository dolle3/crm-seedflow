import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'
import Papa from 'papaparse'
const STATUS_OPTIONS = [
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
const STATUS_STYLES = {
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

export default function Leads() {
  const { canCreateLeads, canEditLeads, canDeleteLeads, canCreateDeals } = useAuth()
  const { t, locale } = useLanguage()
  const [leads, setLeads] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', location: '', status: 'new_lead' })
  const [editId, setEditId] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const csvRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { fetchLeads() }, [])

  const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map(s => [s, t(`leads.statuses.${s}`)]))

  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (data) setLeads(data)
  }

  async function handleSave(e) {
    e.preventDefault()
    if ((editId && !canEditLeads) || (!editId && !canCreateLeads)) return
    if (editId) {
      await supabase.from('leads').update(form).eq('id', editId)
    } else {
      await supabase.from('leads').insert(form)
    }
    setForm({ name: '', company: '', email: '', phone: '', location: '', status: 'new_lead' })
    setEditId(null)
    setShowForm(false)
    fetchLeads()
  }

  function startEdit(lead) {
    if (!canEditLeads) return
    setForm({ name: lead.name, company: lead.company, email: lead.email || '', phone: lead.phone || '', location: lead.location || '', status: lead.status })
    setEditId(lead.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!canDeleteLeads) return
    if (!confirm(t('leads.confirmDelete'))) return
    await supabase.from('leads').delete().eq('id', id)
    fetchLeads()
  }

  function handleCsvImport(e) {
    if (!canCreateLeads) {
      e.target.value = ''
      return
    }
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map(row => ({
          name: row.name || row.Name || '',
          company: row.company || row.Company || '',
          email: row.email || row.Email || '',
          phone: row.phone || row.Phone || '',
          location: row.location || row.Location || '',
          status: row.status || row.Status || 'new_lead',
        })).filter(r => r.name)

        if (rows.length > 0) {
          const { error } = await supabase.from('leads').insert(rows)
          if (error) {
            alert(t('leads.importError', { message: error.message }))
          } else {
            alert(t('leads.importSuccess', { count: rows.length }))
            fetchLeads()
          }
        }
        e.target.value = ''
      },
    })
  }

  const filtered = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.name?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q)
    }
    return true
  })

  async function handleCreateDeal(lead) {
    if (!canCreateDeals) return
    const { data } = await supabase.from('deals').insert({
      title: `Deal - ${lead.company || lead.name}`,
      lead_id: lead.id,
      company: lead.company || '',
      contact_name: lead.name,
      contact_email: lead.email || '',
      contact_phone: lead.phone || '',
      value: 0,
      stage: 'lead',
      probability: 20,
    }).select().single()
    if (data) navigate(`/deals/${data.id}`)
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <section className="mb-10">
        <h1 className="text-5xl font-extrabold text-on-surface tracking-tight mb-2">{t('leads.title')}</h1>
        <p className="text-secondary text-lg max-w-lg">
          {t('leads.subtitle')}
        </p>
      </section>

      {/* Search & Actions */}
      <div className="bg-surface-container-low rounded-2xl p-4 mb-8 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
            placeholder={t('leads.search')}
          />
        </div>
        {canCreateLeads && (
          <div className="flex gap-2">
            <input type="file" accept=".csv" ref={csvRef} className="hidden" onChange={handleCsvImport} />
            <button
              onClick={() => csvRef.current?.click()}
              className="px-5 py-3 bg-surface-container-highest text-primary font-medium rounded-xl hover:opacity-80 transition-all flex items-center gap-2"
            >
              <Icon name="upload_file" className="text-sm" />
              {t('leads.importCsv')}
            </button>
            <button
              onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', company: '', email: '', phone: '', location: '', status: 'new_lead' }) }}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
            >
              <Icon name="person_add" />
              {t('leads.newLead')}
            </button>
          </div>
        )}
      </div>

      {/* Filter Chips + View Toggle */}
      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium shrink-0 transition-colors ${
            filter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'
          }`}
        >
          {t('leads.allLeads')}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium shrink-0 transition-colors ${
              filter === s ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 bg-surface-container-high rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            <Icon name="grid_view" className="text-base" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            <Icon name="list" className="text-base" />
          </button>
        </div>
      </div>

      {/* New/Edit Lead Form */}
      {showForm && ((editId && canEditLeads) || (!editId && canCreateLeads)) && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl mb-8 shadow-sm">
          <h3 className="font-bold text-lg mb-4">{editId ? t('leads.editLead') : t('leads.createLead')}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('leads.fullName')} required
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder={t('leads.company')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('leads.email')} type="email"
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder={t('leads.phone')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={t('leads.location')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold">
                {editId ? t('leads.updateLead') : t('leads.createLeadButton')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                className="px-6 py-3 rounded-xl font-bold text-secondary hover:bg-surface-container-high">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leads — Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 && (
            <p className="text-secondary text-sm py-12 text-center col-span-full">{t('leads.noLeads')}</p>
          )}
          {filtered.map((lead) => (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="bg-surface-container-lowest p-6 rounded-2xl hover:bg-surface-container-low transition-all duration-300 cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-full border-2 border-primary-fixed-dim bg-surface-container-high flex items-center justify-center font-bold text-primary text-lg">
                  {lead.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[lead.status] || 'bg-surface-container-high text-on-surface-variant'}`}>
                  {STATUS_LABELS[lead.status] || lead.status}
                </span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{lead.name}</h3>
              <p className="text-secondary text-sm font-medium mb-4">{lead.company || t('leads.noCompany')}</p>
              {lead.email && (
                <div className="flex items-center gap-3 text-outline text-sm mb-2">
                  <Icon name="mail" className="text-base" /> {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3 text-outline text-sm mb-2">
                  <Icon name="call" className="text-base" /> {lead.phone}
                </div>
              )}
              {lead.location && (
                <div className="flex items-center gap-3 text-outline text-sm mb-2">
                  <Icon name="location_on" className="text-base" /> {lead.location}
                </div>
              )}
              <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center mt-4">
                <span className="text-[10px] text-outline font-bold uppercase tracking-widest">
                  {lead.created_at ? new Date(lead.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : ''}
                </span>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {canCreateDeals && (
                    <button onClick={() => handleCreateDeal(lead)} className="text-tertiary hover:underline font-bold text-sm flex items-center gap-1">
                      <Icon name="add_circle" className="text-sm" /> {t('leads.newDeal')}
                    </button>
                  )}
                  {canEditLeads && (
                    <button onClick={() => startEdit(lead)} className="text-primary hover:underline font-bold text-sm">{t('leads.edit')}</button>
                  )}
                  {canDeleteLeads && (
                    <button onClick={() => handleDelete(lead.id)} className="text-error hover:underline font-bold text-sm">{t('leads.delete')}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leads — List View */}
      {viewMode === 'list' && (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          {filtered.length === 0 && (
            <p className="text-secondary text-sm py-12 text-center">{t('leads.noLeads')}</p>
          )}
          {filtered.map((lead, i) => (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className={`flex items-center gap-4 px-6 py-4 hover:bg-surface-container-low transition-colors group cursor-pointer ${i !== 0 ? 'border-t border-outline-variant/10' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-high border border-primary-fixed-dim flex items-center justify-center font-bold text-primary shrink-0">
                {lead.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface text-sm truncate">{lead.name}</p>
                <p className="text-secondary text-xs truncate">{lead.company || t('leads.noCompany')}</p>
              </div>
              <div className="hidden md:flex items-center gap-1 text-outline text-xs w-44 truncate">
                {lead.email && <><Icon name="mail" className="text-sm shrink-0" /><span className="truncate">{lead.email}</span></>}
              </div>
              <div className="hidden lg:flex items-center gap-1 text-outline text-xs w-32 truncate">
                {lead.phone && <><Icon name="call" className="text-sm shrink-0" /><span>{lead.phone}</span></>}
              </div>
              <div className="hidden lg:flex items-center gap-1 text-outline text-xs w-28 truncate">
                {lead.location && <><Icon name="location_on" className="text-sm shrink-0" /><span className="truncate">{lead.location}</span></>}
              </div>
              <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLES[lead.status] || 'bg-surface-container-high text-on-surface-variant'}`}>
                {STATUS_LABELS[lead.status] || lead.status}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                {canCreateDeals && (
                  <button onClick={() => handleCreateDeal(lead)} className="text-tertiary font-bold text-xs flex items-center gap-1 hover:underline">
                    <Icon name="add_circle" className="text-sm" /> {t('leads.newDeal')}
                  </button>
                )}
                {canEditLeads && (
                  <button onClick={() => startEdit(lead)} className="text-primary font-bold text-xs hover:underline">{t('leads.edit')}</button>
                )}
                {canDeleteLeads && (
                  <button onClick={() => handleDelete(lead.id)} className="text-error font-bold text-xs hover:underline">{t('leads.delete')}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
