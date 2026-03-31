import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Icon from '../components/Icon'

export default function Dashboard() {
  const { profile, canManageTasks } = useAuth()
  const { t, locale } = useLanguage()
  const [stats, setStats] = useState({ totalRevenue: 0, conversionRate: 0, dealCount: 0, leadCount: 0 })
  const [deals, setDeals] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [upcomingActivities, setUpcomingActivities] = useState([])
  const [recentProposals, setRecentProposals] = useState([])

  useEffect(() => { fetchDashboardData() }, [])

  async function fetchDashboardData() {
    if (!supabase) return
    const now = new Date().toISOString()
    const [dealsRes, tasksRes, activitiesRes, upcomingRes, leadsRes, proposalsRes] = await Promise.all([
      supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('tasks').select('*').eq('completed', false).order('due_date', { ascending: true }).limit(5),
      supabase.from('activities').select('*, leads(name, company)').order('created_at', { ascending: false }).limit(5),
      supabase.from('activities').select('*, leads(name, company)').gte('scheduled_at', now).order('scheduled_at', { ascending: true }).limit(3),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('proposals').select('*, leads(name, company)').order('created_at', { ascending: false }).limit(5),
    ])

    if (dealsRes.data) {
      setDeals(dealsRes.data)
      const total = dealsRes.data.reduce((sum, d) => sum + (d.value || 0), 0)
      const closed = dealsRes.data.filter(d => d.stage === 'closed_won').length
      setStats(prev => ({
        ...prev,
        totalRevenue: total,
        conversionRate: dealsRes.data.length > 0 ? Math.round((closed / dealsRes.data.length) * 100) : 0,
        dealCount: dealsRes.data.length,
        leadCount: leadsRes?.count || 0,
      }))
    }
    if (tasksRes.data) setTasks(tasksRes.data)
    if (activitiesRes.data) setActivities(activitiesRes.data)
    if (upcomingRes.data) setUpcomingActivities(upcomingRes.data)
    if (proposalsRes?.data) setRecentProposals(proposalsRes.data)
  }

  async function toggleTask(task) {
    if (!supabase || !canManageTasks) return
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchDashboardData()
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'daar'

  return (
    <div className="space-y-12 pt-8">
      {/* Hero */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="font-label text-primary font-bold tracking-widest text-[10px] uppercase">
            {t('dashboard.welcomeBack', { name: firstName })}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-on-surface-variant max-w-lg">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/leads" className="px-6 py-3 bg-surface-container-highest text-primary font-bold rounded-xl hover:bg-surface-container-high transition-all flex items-center gap-2">
            <Icon name="person_add" className="text-xl" /> {t('dashboard.newLead')}
          </Link>
          <Link to="/pipeline" className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg shadow-primary/10 hover:opacity-90 transition-all flex items-center gap-2">
            <Icon name="add" className="text-xl" /> {t('dashboard.newDeal')}
          </Link>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-surface-container-lowest rounded-2xl p-8 flex flex-col justify-between min-h-[200px]">
          <div className="flex justify-between items-start">
            <span className="font-label text-secondary font-medium text-xs tracking-widest uppercase">{t('dashboard.totalPipelineValue')}</span>
          </div>
          <div className="mt-4">
            <span className="text-5xl font-headline font-bold text-on-surface">{formatCurrency(stats.totalRevenue)}</span>
            <p className="text-on-surface-variant text-sm mt-2">{t('dashboard.allActiveDeals')}</p>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col justify-between">
          <span className="font-label text-secondary font-medium text-xs tracking-widest uppercase">{t('dashboard.conversion')}</span>
          <div>
            <span className="text-4xl font-headline font-bold text-primary">{stats.conversionRate}%</span>
            <div className="w-full bg-outline-variant/20 h-1.5 rounded-full mt-4">
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(stats.conversionRate, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col justify-between">
          <span className="font-label text-secondary font-medium text-xs tracking-widest uppercase">{t('dashboard.leads')}</span>
          <div>
            <span className="text-4xl font-headline font-bold text-secondary">{stats.leadCount}</span>
            <p className="text-on-surface-variant text-xs mt-2">{t('dashboard.activeDealsCount', { count: stats.dealCount })}</p>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      {upcomingActivities.length > 0 && (
        <section className="bg-tertiary-container p-6 rounded-2xl">
          <h3 className="font-headline font-bold text-on-tertiary-container mb-4 flex items-center gap-2">
            <Icon name="event_upcoming" /> {t('dashboard.upcoming')}
          </h3>
          <div className="space-y-3">
            {upcomingActivities.map(a => (
              <div key={a.id} className="flex items-center gap-4 bg-white/10 p-3 rounded-xl">
                <Icon name={a.type === 'call' ? 'call' : a.type === 'meeting' ? 'groups' : a.type === 'deadline' ? 'priority_high' : 'mail'} className="text-on-tertiary-container" />
                <div className="flex-1">
                  <p className="font-bold text-sm text-on-tertiary-container">{a.description}</p>
                  {a.leads && <p className="text-xs text-on-tertiary-container/70">{a.leads.name}</p>}
                </div>
                <span className="text-xs text-on-tertiary-container/70">
                  {a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Proposals */}
      {recentProposals.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">{t('dashboard.recentProposals')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProposals.map(p => (
              <Link
                key={p.id}
                to={`/leads/${p.lead_id}`}
                className="bg-surface-container-lowest p-5 rounded-2xl hover:bg-surface-container-low transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="description" className="text-primary text-lg" />
                    <span className="font-bold text-on-surface group-hover:text-primary transition-colors">
                      {p.leads?.name || t('dashboard.unknownLead')}
                    </span>
                  </div>
                  <span className="font-headline font-bold text-on-surface">{formatCurrency(p.total || 0)}</span>
                </div>
                <p className="text-sm text-secondary">{p.leads?.company || ''}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
                  <span className="text-[10px] text-outline font-bold uppercase tracking-widest">
                    {new Date(p.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-secondary">
                    {(p.items?.length || 0)} {t('dashboard.proposalItems')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Deals + Tasks */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-on-surface">{t('dashboard.activeDeals')}</h2>
            <Link to="/pipeline" className="text-primary font-bold text-sm hover:underline">{t('dashboard.viewPipeline')}</Link>
          </div>
          <div className="space-y-4">
            {deals.length === 0 && (
              <p className="text-secondary text-sm py-8 text-center">{t('dashboard.noDeals')}</p>
            )}
            {deals.map((deal) => (
              <Link key={deal.id} to={`/deals/${deal.id}`}
                className="group bg-surface-container-lowest p-6 rounded-2xl flex items-center justify-between hover:bg-surface-container-low transition-all block">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-primary font-black text-sm">
                    {deal.company?.substring(0, 2).toUpperCase() || 'DL'}
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface">{deal.title}</h3>
                    <p className="text-sm text-on-surface-variant">{deal.company} &bull; {deal.stage?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-headline font-bold text-on-surface">{formatCurrency(deal.value || 0)}</span>
                  <span className="text-[10px] uppercase tracking-tighter text-outline">
                    {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : t('common.noDate')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {/* Tasks */}
          <div className="bg-primary text-on-primary p-8 rounded-2xl shadow-2xl shadow-primary/20">
            <h3 className="text-xl font-bold mb-6">{t('dashboard.tasks')}</h3>
            <div className="space-y-6">
              {tasks.length === 0 && <p className="text-sm opacity-70">{t('dashboard.noOpenTasks')}</p>}
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-4 ${canManageTasks ? 'cursor-pointer' : 'cursor-default opacity-75'}`}
                  onClick={canManageTasks ? () => toggleTask(task) : undefined}
                >
                  <div className="mt-1">
                    <Icon name={task.completed ? 'check_circle' : 'radio_button_unchecked'} filled={task.completed} className="text-sm" />
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${task.completed ? 'line-through opacity-60' : ''}`}>{task.title}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : t('dashboard.noTaskDate')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-container-low p-8 rounded-2xl">
            <h3 className="text-lg font-bold text-on-surface mb-6">{t('dashboard.recentActivity')}</h3>
            <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-outline-variant/30" />
              {activities.length === 0 && <p className="text-secondary text-sm pl-8">{t('dashboard.noActivities')}</p>}
              {activities.map((a) => (
                <div key={a.id} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary border-4 border-surface-container-low" />
                  <p className="text-sm font-bold capitalize">{a.type}</p>
                  <p className="text-xs text-on-surface-variant">{a.description}</p>
                  <span className="text-[10px] text-outline uppercase block mt-1">
                    {new Date(a.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
