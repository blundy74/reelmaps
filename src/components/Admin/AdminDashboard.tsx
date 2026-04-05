import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { fetchDashboard, fetchAdminUsers, fetchAdminErrors, adminLogout } from '../../lib/adminApi'
import type { AdminDashboardData, AdminUser, AdminErrors } from '../../lib/adminApi'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safely convert any value to a displayable string */
function str(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function fmtHour(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#06b6d4', POST: '#10b981', PATCH: '#f59e0b', DELETE: '#ef4444', PUT: '#8b5cf6',
}

const EVENT_COLORS: Record<string, string> = {
  registered: '#06b6d4', verified: '#10b981', deactivated: '#ef4444', reactivated: '#f59e0b',
}

const PIE_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color = 'cyan' }: {
  label: string; value: number | string; icon: React.ReactNode; color?: string
}) {
  const borderColor = color === 'cyan' ? 'border-cyan-500/30' : color === 'green' ? 'border-emerald-500/30' : color === 'amber' ? 'border-amber-500/30' : color === 'red' ? 'border-red-500/30' : 'border-purple-500/30'
  const bgColor = color === 'cyan' ? 'bg-cyan-500/10' : color === 'green' ? 'bg-emerald-500/10' : color === 'amber' ? 'bg-amber-500/10' : color === 'red' ? 'bg-red-500/10' : 'bg-purple-500/10'
  const textColor = color === 'cyan' ? 'text-cyan-400' : color === 'green' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : color === 'red' ? 'text-red-400' : 'text-purple-400'

  return (
    <div className={`bg-ocean-900 border ${borderColor} rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
          <span className={textColor}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-100">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-ocean-900 border border-ocean-700 rounded-xl overflow-hidden ${className}`}>
      <div className="px-5 py-3 border-b border-ocean-700">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ocean-800 border border-ocean-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-slate-200 font-medium">
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'users' | 'activity' | 'security' | 'system'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'activity', label: 'Activity' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System' },
]

// ── Main Dashboard ───────────────────────────────────────────────────────────

interface Props {
  onLogout: () => void
}

export default function AdminDashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [errors, setErrors] = useState<AdminErrors | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashData, userData, errorData] = await Promise.all([
        fetchDashboard(),
        fetchAdminUsers(),
        fetchAdminErrors(),
      ])
      setData(dashData)
      setUsers(userData)
      setErrors(errorData)
      setLastRefresh(Date.now())
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('403')) {
        adminLogout()
        onLogout()
      }
    } finally {
      setLoading(false)
    }
  }, [onLogout])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-ocean-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Prepare chart data
  const cumulativeGrowth = data.userGrowth.reduce<{ day: string; users: number }[]>((acc, row) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].users : 0
    acc.push({ day: fmtDate(row.day), users: prev + parseInt(row.count) })
    return acc
  }, [])

  const dailyActive = data.dailyActiveUsers.map(r => ({ day: fmtDate(r.day), users: parseInt(r.count) }))
  const hourlyReqs = data.hourlyRequests.map(r => ({ hour: fmtHour(r.hour), requests: parseInt(r.count) }))
  const spotsChart = data.spotsPerUser.map(r => ({
    name: r.display_name || r.email.split('@')[0],
    spots: parseInt(r.spot_count),
  }))

  const endpointPie = data.topEndpoints.slice(0, 8).map(r => ({
    name: `${r.method} ${r.endpoint}`,
    value: parseInt(r.count),
  }))

  return (
    <div className="h-screen bg-ocean-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 z-40 bg-ocean-900/95 backdrop-blur border-b border-ocean-700">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-200">ReelMaps Admin</h1>
              <p className="text-[10px] text-slate-600">Last refresh: {new Date(lastRefresh).toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-cyan-400 hover:bg-ocean-800 border border-ocean-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => { adminLogout(); onLogout() }}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-ocean-800 border border-ocean-700 transition-all"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                  tab === t.id
                    ? 'bg-ocean-800 text-cyan-400 border-t border-x border-cyan-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {tab === 'overview' && <OverviewTab data={data} cumulativeGrowth={cumulativeGrowth} dailyActive={dailyActive} hourlyReqs={hourlyReqs} spotsChart={spotsChart} endpointPie={endpointPie} />}
        {tab === 'users' && <UsersTab users={users} />}
        {tab === 'activity' && <ActivityTab data={data} />}
        {tab === 'security' && <SecurityTab data={data} />}
        {tab === 'system' && <SystemTab data={data} errors={errors} />}
      </div>
      </main>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data, cumulativeGrowth, dailyActive, hourlyReqs, spotsChart, endpointPie }: {
  data: AdminDashboardData
  cumulativeGrowth: { day: string; users: number }[]
  dailyActive: { day: string; users: number }[]
  hourlyReqs: { hour: string; requests: number }[]
  spotsChart: { name: string; spots: number }[]
  endpointPie: { name: string; value: number }[]
}) {
  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Users" value={data.stats.totalUsers} color="cyan" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        } />
        <StatCard label="Verified" value={data.stats.verifiedUsers} color="green" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        } />
        <StatCard label="Active Sessions" value={data.stats.activeSessions} color="amber" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.172a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.01" /></svg>
        } />
        <StatCard label="Total Spots" value={data.stats.totalSpots} color="cyan" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        } />
        <StatCard label="Trip Logs" value={data.stats.totalTrips} color="green" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        } />
        <StatCard label="File Imports" value={data.stats.totalImports} color="purple" icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        } />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <Section title="User Growth (Cumulative)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulativeGrowth}>
              <defs>
                <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#122540" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="users" stroke="#06b6d4" fill="url(#gradCyan)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        {/* Daily Active Users */}
        <Section title="Daily Active Users (14 days)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyActive}>
              <CartesianGrid strokeDasharray="3 3" stroke="#122540" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="users" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Hourly Requests */}
        <Section title="Hourly Request Volume (24h)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyReqs}>
              <defs>
                <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#122540" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="requests" stroke="#f59e0b" fill="url(#gradAmber)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        {/* Spots per User */}
        <Section title="Spots per User (Top 10)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spotsChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#122540" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="spots" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Top Endpoints pie */}
      {endpointPie.length > 0 && (
        <Section title="Top API Endpoints (24h)">
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="40%" height={200}>
              <PieChart>
                <Pie data={endpointPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {endpointPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {endpointPie.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-400 truncate flex-1">{e.name}</span>
                  <span className="text-slate-300 font-mono">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  )
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users }: { users: AdminUser[] | null }) {
  if (!users) return <p className="text-slate-500 text-sm">Loading...</p>

  return (
    <Section title={`Registered Users (${users.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-ocean-700">
              <th className="pb-2 pr-4">User</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4 text-center">Verified</th>
              <th className="pb-2 pr-4 text-center">Premium</th>
              <th className="pb-2 pr-4 text-center">EULA</th>
              <th className="pb-2 pr-4 text-right">Spots</th>
              <th className="pb-2 pr-4 text-right">Trips</th>
              <th className="pb-2 pr-4 text-right">Sessions</th>
              <th className="pb-2 pr-4">Last Active</th>
              <th className="pb-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-ocean-800 hover:bg-ocean-800/50">
                <td className="py-2.5 pr-4 text-slate-200 font-medium">{u.display_name || '—'}</td>
                <td className="py-2.5 pr-4 text-slate-400 font-mono">{u.email}</td>
                <td className="py-2.5 pr-4 text-center">
                  {u.email_verified ? (
                    <span className="text-emerald-400">&#10003;</span>
                  ) : (
                    <span className="text-slate-600">&#10007;</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-center">
                  {u.is_premium ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">PRO</span>
                  ) : (
                    <span className="text-slate-600">&#10007;</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-center">
                  {u.eula_accepted ? (
                    <span className="text-emerald-400 text-[10px]" title={u.eula_version || ''}>v{u.eula_version}</span>
                  ) : (
                    <span className="text-slate-600">&#10007;</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-300">{parseInt(u.spot_count).toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right text-slate-300">{u.trip_count}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className={parseInt(u.active_sessions) > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                    {u.active_sessions}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-slate-500">{u.last_active ? timeAgo(u.last_active) : '—'}</td>
                <td className="py-2.5 text-slate-500">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: AdminDashboardData }) {
  return (
    <>
      <Section title="Recent API Activity (Last 50 Requests)">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ocean-900">
              <tr className="text-left text-slate-500 border-b border-ocean-700">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2 pr-4">Endpoint</th>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.map((a, i) => (
                <tr key={i} className="border-b border-ocean-800/50 hover:bg-ocean-800/30">
                  <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                  <td className="py-2 pr-4">
                    <span className="font-mono font-bold" style={{ color: METHOD_COLORS[a.method] || '#94a3b8' }}>
                      {a.method}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-300 font-mono">{a.endpoint}</td>
                  <td className="py-2 pr-4 text-slate-400">{a.display_name || a.email?.split('@')[0]}</td>
                  <td className="py-2 text-slate-500 font-mono">{str(a.ip_address)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Audit Trail (Account Events)">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ocean-900">
              <tr className="text-left text-slate-500 border-b border-ocean-700">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Event</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">IP</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLog.map((a, i) => (
                <tr key={i} className="border-b border-ocean-800/50 hover:bg-ocean-800/30">
                  <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: (EVENT_COLORS[a.event] || '#64748b') + '20', color: EVENT_COLORS[a.event] || '#64748b' }}>
                      {a.event}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-400 font-mono">{a.email}</td>
                  <td className="py-2 pr-4 text-slate-500 font-mono">{a.ip_address || '—'}</td>
                  <td className="py-2 text-slate-600 truncate max-w-[200px]">
                    {a.metadata ? str(a.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

// ── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ data }: { data: AdminDashboardData }) {
  return (
    <>
      {/* Multi-IP Sessions (Credential Sharing Detection) */}
      <Section title="Multi-IP Concurrent Sessions (Credential Sharing Detection)" className={data.multiIpSessions.length > 0 ? 'border-amber-500/30' : ''}>
        {data.multiIpSessions.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm text-emerald-400 font-medium">All Clear</p>
            <p className="text-xs text-slate-500 mt-1">No users with multiple active IPs in the last 24 hours</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.multiIpSessions.map((s, i) => (
              <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-semibold text-amber-300">{s.display_name || s.email}</span>
                    <span className="text-xs text-slate-500 font-mono">{s.email}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                    {s.unique_ips} IPs
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Array.isArray(s.ips) ? s.ips : []).map((ip, j) => (
                    <div key={j} className="flex items-center gap-2 bg-ocean-800/50 rounded-lg px-3 py-2">
                      <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                      </svg>
                      <span className="text-xs text-slate-300 font-mono">{str(ip)}</span>
                      {s.cities[j] && str(s.cities[j]) !== 'Unknown' && (
                        <span className="text-[10px] text-slate-500">({str(s.cities[j])})</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                  <span>First active: {fmtDateTime(s.first_active)}</span>
                  <span>Last active: {fmtDateTime(s.last_active)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

// ── System Tab ───────────────────────────────────────────────────────────────

function SystemTab({ data, errors }: { data: AdminDashboardData; errors: AdminErrors | null }) {
  return (
    <>
      {/* Event Summary */}
      {errors && (
        <Section title="Account Event Summary">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {errors.eventSummary.map((e, i) => (
              <div key={i} className="bg-ocean-800/50 rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-slate-200">{parseInt(e.count).toLocaleString()}</p>
                <p className="text-[10px] mt-1 font-semibold uppercase tracking-wider"
                  style={{ color: EVENT_COLORS[e.event] || '#64748b' }}>
                  {e.event}
                </p>
                <p className="text-[10px] text-slate-600 mt-1">Last: {timeAgo(e.latest)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Verification Codes */}
      {errors && errors.verificationCodes.length > 0 && (
        <Section title="Recent Verification Codes">
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-ocean-900">
                <tr className="text-left text-slate-500 border-b border-ocean-700">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Used</th>
                  <th className="pb-2">Expires</th>
                </tr>
              </thead>
              <tbody>
                {errors.verificationCodes.map((v, i) => (
                  <tr key={i} className="border-b border-ocean-800/50">
                    <td className="py-2 pr-4 text-slate-500">{fmtDateTime(v.created_at)}</td>
                    <td className="py-2 pr-4 text-slate-400 font-mono">{v.email || v.user_id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-slate-300 font-mono">{v.code}</td>
                    <td className="py-2 pr-4">
                      {v.used ? <span className="text-emerald-400">&#10003;</span> : <span className="text-slate-600">pending</span>}
                    </td>
                    <td className="py-2 text-slate-500">{fmtDateTime(v.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Account Changes */}
      {errors && errors.accountChanges.length > 0 && (
        <Section title="Account Deactivations / Reactivations">
          <div className="space-y-2">
            {errors.accountChanges.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-ocean-800/30 rounded-lg px-4 py-2.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: (EVENT_COLORS[a.event] || '#64748b') + '20', color: EVENT_COLORS[a.event] || '#64748b' }}>
                  {a.event}
                </span>
                <span className="text-xs text-slate-400 font-mono">{a.email}</span>
                <span className="text-xs text-slate-600 ml-auto">{fmtDateTime(a.created_at)}</span>
                {a.ip_address && <span className="text-[10px] text-slate-600 font-mono">{str(a.ip_address)}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
