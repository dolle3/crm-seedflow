import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

export default function DealDetail() {
  const { canEditDeals, canDeleteDeals } = useAuth()
  const { t, locale } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => { fetchDeal(); fetchNotes() }, [id])

  async function fetchDeal() {
    const { data } = await supabase.from('deals').select('*').eq('id', id).single()
    if (data) { setDeal(data); setForm(data) }
  }

  async function fetchNotes() {
    const { data } = await supabase.from('deal_notes').select('*').eq('deal_id', id).order('created_at', { ascending: false })
    if (data) setNotes(data)
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!canEditDeals) return
    await supabase.from('deals').update({
      title: form.title,
      company: form.company,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      probability: parseInt(form.probability) || 50,
      expected_close: form.expected_close || null,
    }).eq('id', id)
    setEditing(false)
    fetchDeal()
  }

  async function handleMoveStage(newStage) {
    if (!canEditDeals) return
    await supabase.from('deals').update({ stage: newStage }).eq('id', id)
    fetchDeal()
  }

  async function handleAddNote() {
    if (!noteText.trim() || !canEditDeals) return
    await supabase.from('deal_notes').insert({ deal_id: id, content: noteText })
    setNoteText('')
    fetchNotes()
  }

  const STAGE_LABELS = {
    lead: t('dealDetail.stages.lead'),
    qualified: t('dealDetail.stages.qualified'),
    proposal: t('dealDetail.stages.proposal'),
    negotiation: t('dealDetail.stages.negotiation'),
    closed_won: t('dealDetail.stages.closed_won'),
    closed_lost: t('dealDetail.stages.closed_lost'),
  }

  async function handleDelete() {
    if (!canDeleteDeals) return
    if (!confirm(t('dealDetail.confirmDelete'))) return
    await supabase.from('deal_notes').delete().eq('deal_id', id)
    await supabase.from('deals').delete().eq('id', id)
    navigate('/pipeline')
  }

  if (!deal) return <div className="py-20 text-center text-secondary">{t('common.loading')}</div>

  function formatCurrency(n) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <nav className="flex gap-2 mb-4 items-center">
            <button onClick={() => navigate('/pipeline')} className="text-primary font-bold text-sm hover:underline flex items-center gap-1">
              <Icon name="arrow_back" className="text-sm" /> {t('nav.pipeline')}
            </button>
            <span className="text-outline">/</span>
            <span className="bg-tertiary-container text-on-tertiary-container px-3 py-1 rounded-full font-label text-xs font-semibold">
              {STAGE_LABELS[deal.stage] || deal.stage}
            </span>
          </nav>
          {!editing ? (
            <>
              <h2 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-2">{deal.title}</h2>
              <p className="text-on-surface-variant text-lg">
                {t('dealDetail.lead')}: <span className="font-semibold text-primary">{deal.company || t('dealDetail.unknown')}</span>
              </p>
            </>
          ) : (
            <h2 className="font-headline text-3xl font-bold text-on-surface mb-2">{t('dealDetail.editing')}</h2>
          )}
        </div>
        <div className="flex gap-3">
          {!editing && (canEditDeals || canDeleteDeals) && (
            <>
              {canEditDeals && (
                <button onClick={() => setEditing(true)} className="px-6 py-3 bg-surface-container-highest text-primary font-bold rounded-xl hover:bg-surface-container-high transition-all">
                  {t('common.edit')}
                </button>
              )}
              {canDeleteDeals && (
                <button onClick={handleDelete} className="px-6 py-3 bg-error-container text-on-error-container font-bold rounded-xl transition-all">
                  {t('common.delete')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && canEditDeals ? (
        <form onSubmit={handleUpdate} className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('dealDetail.dealTitle')} required
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} placeholder={t('dealDetail.company')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder={t('dealDetail.contactName')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder={t('dealDetail.contactEmail')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder={t('dealDetail.contactPhone')}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <input value={form.value || ''} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={t('dealDetail.value')} type="number"
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
            <select value={form.stage || 'lead'} onChange={e => setForm({ ...form, stage: e.target.value })}
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20">
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <input value={form.expected_close || ''} onChange={e => setForm({ ...form, expected_close: e.target.value })} type="date"
              className="bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-3 mt-6">
            <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold">{t('dealDetail.saveChanges')}</button>
            <button type="button" onClick={() => { setEditing(false); setForm(deal) }} className="px-6 py-3 rounded-xl font-bold text-secondary">{t('common.cancel')}</button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main */}
          <div className="md:col-span-8 space-y-6">
            {/* Metrics */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-surface-container-low p-8 rounded-3xl">
              <div className="space-y-1">
                <p className="font-label text-xs uppercase tracking-widest text-secondary">{t('dealDetail.dealValue')}</p>
                <p className="font-headline text-3xl font-bold text-on-surface">{formatCurrency(deal.value || 0)}</p>
              </div>
              <div className="space-y-1 border-l border-outline-variant/20 pl-6">
                <p className="font-label text-xs uppercase tracking-widest text-secondary">{t('dealDetail.closingDate')}</p>
                <p className="font-headline text-3xl font-bold text-on-surface">
                  {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : t('dealDetail.closingDateUnknown')}
                </p>
              </div>
              <div className="space-y-1 border-l border-outline-variant/20 pl-6 col-span-2 md:col-span-1">
                <p className="font-label text-xs uppercase tracking-widest text-secondary">{t('dealDetail.probability')}</p>
                <div className="flex items-center gap-3">
                  <p className="font-headline text-3xl font-bold text-on-surface">{deal.probability || 0}%</p>
                  <div className="h-2 w-24 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${deal.probability || 0}%` }} />
                  </div>
                </div>
              </div>
            </section>

            {canEditDeals && (
              <div className="flex gap-2 flex-wrap">
                {STAGES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleMoveStage(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      deal.stage === s
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    {STAGE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}

            {canEditDeals && (
              <section className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
                <h3 className="font-headline text-xl font-bold mb-4 flex items-center gap-2">
                  <Icon name="edit_note" className="text-primary" /> {t('dealDetail.addNote')}
                </h3>
                <div className="relative">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all min-h-[120px]"
                    placeholder={t('dealDetail.notePlaceholder')}
                  />
                  <div className="flex justify-end mt-2">
                    <button onClick={handleAddNote} className="bg-primary text-white px-4 py-2 rounded-xl font-label text-sm font-bold shadow-md">
                      {t('dealDetail.postNote')}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Notes Timeline */}
            <section className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm">
              <h3 className="font-headline text-xl font-bold mb-8">{t('dealDetail.notesTimeline')}</h3>
              <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-outline-variant/20">
                {notes.length === 0 && <p className="text-secondary text-sm pl-10">{t('dealDetail.noNotes')}</p>}
                {notes.map((note) => (
                  <div key={note.id} className="relative pl-10">
                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary border-4 border-primary-fixed-dim ring-4 ring-primary/5" />
                    <p className="text-sm text-on-surface">{note.content}</p>
                    <p className="font-label text-[10px] uppercase text-secondary mt-1">
                      {new Date(note.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="md:col-span-4 space-y-6">
            {/* Contact Card */}
            <div className="bg-primary text-on-primary p-8 rounded-3xl shadow-xl shadow-primary/10 overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
              <h4 className="font-label text-xs uppercase tracking-widest text-on-primary-container mb-6">{t('dealDetail.contactPerson')}</h4>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                  {deal.contact_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-headline text-xl font-bold">{deal.contact_name || t('dealDetail.noContact')}</p>
                  <p className="text-sm text-on-primary-container">{deal.company || ''}</p>
                </div>
              </div>
              <div className="space-y-3">
                {deal.contact_email && (
                  <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                    <Icon name="mail" className="text-sm" />
                    <span className="text-sm truncate">{deal.contact_email}</span>
                  </div>
                )}
                {deal.contact_phone && (
                  <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                    <Icon name="call" className="text-sm" />
                    <span className="text-sm">{deal.contact_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Deal Meta */}
            <div className="bg-surface-container-low p-8 rounded-3xl">
              <h4 className="font-headline text-sm font-bold text-on-surface mb-6">{t('dealDetail.internalDetails')}</h4>
              <div className="space-y-6">
                <div>
                  <p className="font-label text-[10px] uppercase text-secondary">{t('common.stage')}</p>
                  <p className="font-body text-sm font-semibold">{STAGE_LABELS[deal.stage] || deal.stage}</p>
                </div>
                <div>
                  <p className="font-label text-[10px] uppercase text-secondary">{t('dealDetail.created')}</p>
                  <p className="font-body text-sm font-semibold">
                    {new Date(deal.created_at).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
