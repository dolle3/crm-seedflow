import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

const VAT_RATE = 21

export default function Proposals() {
  const { isAdmin, canEditDeals } = useAuth()
  const { t, locale } = useLanguage()
  const [proposals, setProposals] = useState([])
  const [editId, setEditId] = useState(null)
  const [editItems, setEditItems] = useState([])
  const [editNotes, setEditNotes] = useState('')
  const [editValidityDays, setEditValidityDays] = useState(14)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProposals() }, [])

  async function fetchProposals() {
    const { data } = await supabase
      .from('proposals')
      .select('*, leads(id, name, company, email, phone, status)')
      .order('created_at', { ascending: false })
    if (data) setProposals(data)
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  }

  function startEdit(proposal) {
    setEditId(proposal.id)
    setEditItems(proposal.items || [{ description: '', amount: '' }])
    setEditNotes(proposal.notes || '')
    setEditValidityDays(proposal.validity_days || 14)
  }

  function cancelEdit() {
    setEditId(null)
    setEditItems([])
    setEditNotes('')
  }

  function updateItem(index, field, value) {
    setEditItems(editItems.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setEditItems([...editItems, { description: '', amount: '' }])
  }

  function removeItem(index) {
    if (editItems.length <= 1) return
    setEditItems(editItems.filter((_, i) => i !== index))
  }

  async function handleSave(proposalId) {
    setSaving(true)
    const cleanItems = editItems
      .filter(i => i.description?.trim())
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) || 0 }))

    const subtotal = cleanItems.reduce((sum, i) => sum + i.amount, 0)
    const vatAmount = subtotal * (VAT_RATE / 100)
    const total = subtotal + vatAmount
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + editValidityDays)

    await supabase.from('proposals').update({
      items: cleanItems,
      subtotal,
      vat_rate: VAT_RATE,
      vat_amount: vatAmount,
      total,
      notes: editNotes,
      validity_days: editValidityDays,
      valid_until: validUntil.toISOString(),
    }).eq('id', proposalId)

    // Also update linked deal value
    const proposal = proposals.find(p => p.id === proposalId)
    if (proposal?.lead_id) {
      await supabase.from('deals').update({ value: total }).eq('lead_id', proposal.lead_id)
    }

    setEditId(null)
    setSaving(false)
    fetchProposals()
  }

  async function handleDelete(proposalId) {
    if (!confirm(t('proposals.confirmDelete'))) return
    await supabase.from('proposals').delete().eq('id', proposalId)
    fetchProposals()
  }

  const now = new Date()

  return (
    <div className="mt-8 pb-8">
      <section className="mb-10">
        <h1 className="text-5xl font-extrabold text-on-surface tracking-tight mb-2">{t('proposals.title')}</h1>
        <p className="text-secondary text-lg max-w-lg">{t('proposals.subtitle')}</p>
      </section>

      {proposals.length === 0 && (
        <div className="text-center py-20 text-secondary">
          <Icon name="description" className="text-5xl mb-4 block mx-auto opacity-30" />
          <p>{t('proposals.noProposals')}</p>
        </div>
      )}

      <div className="space-y-4">
        {proposals.map(p => {
          const isEditing = editId === p.id
          const isExpired = p.valid_until && new Date(p.valid_until) < now
          const leadStatus = p.leads?.status

          return (
            <div key={p.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-lg shrink-0">
                      {p.leads?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <Link
                        to={`/leads/${p.lead_id}`}
                        className="font-bold text-lg text-on-surface hover:text-primary transition-colors"
                      >
                        {p.leads?.name || t('proposals.unknownLead')}
                      </Link>
                      <p className="text-secondary text-sm">{p.leads?.company || ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-headline font-bold text-xl text-on-surface">{formatCurrency(p.total || 0)}</p>
                      <p className="text-[10px] uppercase tracking-widest text-secondary">
                        {new Date(p.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Status badge */}
                    {leadStatus === 'won' ? (
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-tertiary-container text-on-tertiary-container">
                        {t('proposals.statusWon')}
                      </span>
                    ) : leadStatus === 'lost' ? (
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error-container text-on-error-container">
                        {t('proposals.statusLost')}
                      </span>
                    ) : isExpired ? (
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error-container/50 text-on-error-container">
                        {t('proposals.statusExpired')}
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-container text-on-primary-container">
                        {t('proposals.statusOpen')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items summary (when not editing) */}
                {!isEditing && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10">
                    <div className="space-y-1.5">
                      {(p.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">{item.description}</span>
                          <span className="text-on-surface font-mono">{formatCurrency(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm text-secondary mt-2 pt-2 border-t border-outline-variant/10">
                      <span>{t('proposals.subtotalLabel')}</span>
                      <span className="font-mono">{formatCurrency(p.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-secondary">
                      <span>{t('proposals.vatLabel')} ({p.vat_rate || 21}%)</span>
                      <span className="font-mono">{formatCurrency(p.vat_amount || 0)}</span>
                    </div>
                    {p.notes && (
                      <p className="text-sm text-secondary mt-3 italic">{p.notes}</p>
                    )}
                    {p.valid_until && (
                      <p className="text-[10px] text-secondary mt-2">
                        {t('proposals.validUntilLabel')}: {new Date(p.valid_until).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-4">
                      {canEditDeals && (
                        <button
                          onClick={() => startEdit(p)}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
                        >
                          <Icon name="edit" className="text-sm" /> {t('proposals.edit')}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-4 py-2 rounded-xl text-sm font-bold bg-error-container/30 text-error hover:bg-error-container/50 transition-colors flex items-center gap-1.5"
                        >
                          <Icon name="delete" className="text-sm" /> {t('proposals.delete')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-3">
                    {editItems.map((item, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <input
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          placeholder={t('proposals.itemPlaceholder')}
                          className="flex-1 bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-on-surface"
                        />
                        <div className="relative w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">€</span>
                          <input
                            value={item.amount}
                            onChange={e => updateItem(i, 'amount', e.target.value)}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-4 py-3 focus:ring-2 focus:ring-primary/20 text-on-surface text-right"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(i)}
                          disabled={editItems.length <= 1}
                          className="p-3 text-error hover:bg-error-container/30 rounded-xl transition-colors disabled:opacity-20"
                        >
                          <Icon name="close" className="text-base" />
                        </button>
                      </div>
                    ))}

                    <button onClick={addItem} className="text-primary font-bold text-sm flex items-center gap-1.5 hover:underline">
                      <Icon name="add_circle" className="text-base" /> {t('proposals.addItem')}
                    </button>

                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder={t('proposals.notesPlaceholder')}
                      className="w-full bg-surface-container-low border-none rounded-xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none text-sm"
                    />

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-secondary">{t('proposals.validityLabel')}:</span>
                      <input
                        type="number"
                        value={editValidityDays}
                        onChange={e => setEditValidityDays(parseInt(e.target.value) || 14)}
                        min="1"
                        max="90"
                        className="w-20 bg-surface-container-low border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 text-center text-on-surface"
                      />
                      <span className="text-sm text-secondary">{t('proposals.daysLabel')}</span>
                    </div>

                    {/* Calculated totals */}
                    <div className="pt-3 border-t border-outline-variant/20">
                      {(() => {
                        const sub = editItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
                        const vat = sub * (VAT_RATE / 100)
                        return (
                          <>
                            <div className="flex justify-between text-sm text-secondary">
                              <span>{t('proposals.subtotalLabel')}</span>
                              <span className="font-mono">{formatCurrency(sub)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-secondary">
                              <span>{t('proposals.vatLabel')} ({VAT_RATE}%)</span>
                              <span className="font-mono">{formatCurrency(vat)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-on-surface mt-1">
                              <span>{t('proposals.totalLabel')}</span>
                              <span className="font-mono">{formatCurrency(sub + vat)}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleSave(p.id)}
                        disabled={saving}
                        className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Icon name="check" className="text-sm" /> {t('proposals.save')}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-secondary hover:bg-surface-container-high transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
