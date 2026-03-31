import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const VAT_RATE = 21

export default function ProposalBuilder() {
  const { canEditLeads } = useAuth()
  const { t, locale } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()

  const [lead, setLead] = useState(null)
  const [items, setItems] = useState([{ description: '', amount: '' }])
  const [notes, setNotes] = useState('')
  const [validityDays, setValidityDays] = useState(14)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchLead()
  }, [id])

  async function fetchLead() {
    const { data } = await supabase.from('leads').select('*').eq('id', id).single()
    if (data) setLead(data)
  }

  function addItem() {
    setItems([...items, { description: '', amount: '' }])
  }

  function removeItem(index) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index, field, value) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const vatAmount = subtotal * (VAT_RATE / 100)
  const total = subtotal + vatAmount

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + validityDays)

  function formatCurrency(amount) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
  }

  async function handleSend() {
    if (!canEditLeads || items.every(i => !i.description.trim())) return
    setSaving(true)

    const cleanItems = items
      .filter(i => i.description.trim())
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) || 0 }))

    // Save proposal to database
    await supabase.from('proposals').insert({
      lead_id: id,
      items: cleanItems,
      subtotal,
      vat_rate: VAT_RATE,
      vat_amount: vatAmount,
      total,
      notes,
      validity_days: validityDays,
      valid_until: validUntil.toISOString(),
    })

    // Update lead status to proposal_sent and start timer
    await supabase.from('leads').update({
      status: 'proposal_sent',
      proposal_timer_started_at: new Date().toISOString(),
    }).eq('id', id)

    // Sync to pipeline: update linked deal to proposal stage with proposal value
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('lead_id', id)
      .limit(1)
      .single()

    if (existingDeal) {
      await supabase.from('deals').update({
        stage: 'proposal',
        value: total,
      }).eq('id', existingDeal.id)
    } else {
      // Auto-create deal if none exists
      await supabase.from('deals').insert({
        title: `Offerte — ${lead.company || lead.name}`,
        lead_id: id,
        company: lead.company || '',
        contact_name: lead.name,
        contact_email: lead.email || '',
        contact_phone: lead.phone || '',
        value: total,
        stage: 'proposal',
        probability: 50,
      })
    }

    // Log activity
    await supabase.from('activities').insert({
      type: 'note',
      description: `Offerte gestuurd naar ${lead.name} (${lead.company || ''}) — ${formatCurrency(total)}`,
      scheduled_at: new Date().toISOString(),
      lead_id: id,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => navigate(`/leads/${id}`), 1500)
  }

  if (!lead) return <div className="py-20 text-center text-secondary">{t('common.loading')}</div>

  return (
    <div className="pt-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <button
        onClick={() => navigate(`/leads/${id}`)}
        className="text-primary font-bold text-sm hover:underline flex items-center gap-1 mb-6"
      >
        <Icon name="arrow_back" className="text-sm" /> {t('proposal.backToLead')}
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-secondary mb-2">
            {t('proposal.eyebrow')}
          </p>
          <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            {t('proposal.title')}
          </h2>
        </div>
        <div className="text-right text-sm text-secondary">
          <p>{new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* From (your company) */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <p className="font-label text-[10px] uppercase tracking-widest text-secondary mb-3">
            {t('proposal.from')}
          </p>
          <p className="font-bold text-on-surface text-lg">Seedflow</p>
          <p className="text-secondary text-sm mt-1">{t('proposal.yourDetails')}</p>
        </div>

        {/* To (client) — pre-filled */}
        <div className="bg-primary text-on-primary p-6 rounded-2xl shadow-xl shadow-primary/10 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-3xl" />
          <p className="font-label text-[10px] uppercase tracking-widest opacity-60 mb-3">
            {t('proposal.to')}
          </p>
          <p className="font-bold text-lg">{lead.name}</p>
          {lead.company && <p className="text-sm opacity-80">{lead.company}</p>}
          <div className="mt-3 space-y-1 text-sm opacity-80">
            {lead.email && (
              <div className="flex items-center gap-2">
                <Icon name="mail" className="text-xs" /> {lead.email}
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Icon name="call" className="text-xs" /> {lead.phone}
              </div>
            )}
            {lead.location && (
              <div className="flex items-center gap-2">
                <Icon name="location_on" className="text-xs" /> {lead.location}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm mb-6">
        <h3 className="font-headline font-bold text-lg mb-5 flex items-center gap-2">
          <Icon name="receipt_long" className="text-primary" /> {t('proposal.items')}
        </h3>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  value={item.description}
                  onChange={e => updateItem(i, 'description', e.target.value)}
                  placeholder={t('proposal.itemPlaceholder')}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-on-surface"
                />
              </div>
              <div className="w-36">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">€</span>
                  <input
                    value={item.amount}
                    onChange={e => updateItem(i, 'amount', e.target.value)}
                    placeholder="0,00"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-4 py-3 focus:ring-2 focus:ring-primary/20 text-on-surface text-right"
                  />
                </div>
              </div>
              <button
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
                className="p-3 text-error hover:bg-error-container/30 rounded-xl transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-4 flex items-center gap-2 text-primary font-bold text-sm hover:underline"
        >
          <Icon name="add_circle" className="text-base" /> {t('proposal.addItem')}
        </button>

        {/* Totals */}
        <div className="mt-6 pt-5 border-t border-outline-variant/20">
          <div className="flex justify-between text-sm text-secondary mb-2">
            <span>{t('proposal.subtotal')}</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-secondary mb-3">
            <span>{t('proposal.vat')} ({VAT_RATE}%)</span>
            <span className="font-mono">{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-on-surface pt-3 border-t border-outline-variant/20">
            <span>{t('proposal.total')}</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Extra options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Notes */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <h3 className="font-headline font-bold text-sm mb-3 flex items-center gap-2">
            <Icon name="edit_note" className="text-primary text-base" /> {t('proposal.notesLabel')}
          </h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('proposal.notesPlaceholder')}
            className="w-full bg-surface-container-low border-none rounded-xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none text-sm"
          />
        </div>

        {/* Validity */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <h3 className="font-headline font-bold text-sm mb-3 flex items-center gap-2">
            <Icon name="event" className="text-primary text-base" /> {t('proposal.validity')}
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              value={validityDays}
              onChange={e => setValidityDays(parseInt(e.target.value) || 14)}
              min="1"
              max="90"
              className="w-20 bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-center text-on-surface"
            />
            <span className="text-secondary text-sm">{t('proposal.days')}</span>
          </div>
          <p className="text-secondary text-xs">
            {t('proposal.validUntil')}: <span className="font-semibold text-on-surface">
              {validUntil.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </p>
        </div>
      </div>

      {/* Send button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/leads/${id}`)}
          className="px-6 py-3 rounded-xl font-bold text-secondary hover:bg-surface-container-high transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSend}
          disabled={saving || saved || items.every(i => !i.description.trim())}
          className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${
            saved
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-primary text-on-primary hover:shadow-primary/20'
          } disabled:opacity-50`}
        >
          <Icon name={saved ? 'check_circle' : 'send'} className="text-base" />
          {saving ? t('proposal.sending') : saved ? t('proposal.sent') : t('proposal.send')}
        </button>
      </div>
    </div>
  )
}
