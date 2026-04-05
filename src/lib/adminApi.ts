const API_BASE = import.meta.env.VITE_API_URL || 'https://vdfjbl2ku2.execute-api.us-east-2.amazonaws.com'

let adminToken: string | null = sessionStorage.getItem('reelmaps-admin-token')

export function getAdminToken() { return adminToken }

export function setAdminToken(t: string | null) {
  adminToken = t
  if (t) sessionStorage.setItem('reelmaps-admin-token', t)
  else sessionStorage.removeItem('reelmaps-admin-token')
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function adminLogin(email: string, password: string): Promise<{ token: string }> {
  const data = await adminRequest<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAdminToken(data.token)
  return data
}

export function adminLogout() {
  setAdminToken(null)
}

export interface AdminDashboardData {
  stats: {
    totalUsers: number
    verifiedUsers: number
    totalSpots: number
    totalTrips: number
    totalImports: number
    activeSessions: number
  }
  recentSignups: { day: string; count: string }[]
  userGrowth: { day: string; count: string }[]
  spotsPerUser: { display_name: string; email: string; spot_count: string }[]
  topEndpoints: { method: string; endpoint: string; count: string }[]
  recentActivity: {
    method: string; endpoint: string; ip_address: string
    created_at: string; email: string; display_name: string
  }[]
  auditLog: {
    user_id: string; email: string; event: string; ip_address: string
    user_agent: string; metadata: any; created_at: string
  }[]
  multiIpSessions: {
    id: string; email: string; display_name: string; unique_ips: string
    ips: string[]; cities: string[]; first_active: string; last_active: string
  }[]
  dailyActiveUsers: { day: string; count: string }[]
  hourlyRequests: { hour: string; count: string }[]
}

export async function fetchDashboard(): Promise<AdminDashboardData> {
  return adminRequest('/api/admin/dashboard')
}

export interface AdminUser {
  id: string; email: string; display_name: string; email_verified: boolean
  is_premium: boolean; eula_accepted: boolean; eula_version: string | null
  created_at: string; updated_at: string; spot_count: string
  trip_count: string; active_sessions: string; last_active: string
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return adminRequest('/api/admin/users')
}

export interface AdminErrors {
  verificationCodes: {
    user_id: string; email: string; code: string; used: boolean
    expires_at: string; created_at: string
  }[]
  accountChanges: {
    email: string; event: string; ip_address: string
    created_at: string; metadata: any
  }[]
  eventSummary: { event: string; count: string; latest: string }[]
}

export async function fetchAdminErrors(): Promise<AdminErrors> {
  return adminRequest('/api/admin/errors')
}
