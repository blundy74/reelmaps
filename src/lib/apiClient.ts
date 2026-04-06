/**
 * REST API client for ReelMaps backend.
 * Handles auth token storage and request helpers.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://vdfjbl2ku2.execute-api.us-east-2.amazonaws.com'

// ── Token management ────────────────────────────────────────────────────────

let token: string | null = localStorage.getItem('reelmaps-token')

export function getToken() { return token }

export function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('reelmaps-token', t)
  else localStorage.removeItem('reelmaps-token')
}

// ── Request helpers ─────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await res.json()

    if (!res.ok) {
      const err = new Error(data.error || `Request failed: ${res.status}`) as any
      err.suggestions = data.suggestions
      throw err
    }
    return data as T
  } catch (e: any) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Request timed out')
    throw e
  }
}

// ── Auth API ────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  emailVerified?: boolean
  isPremium?: boolean
  subscriptionRenewDate?: string | null
  eulaAccepted?: boolean
  eulaVersion?: string | null
}

interface AuthResponse {
  token: string
  user: AuthUser
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  // 12s timeout — bcrypt + DB + session (email sends async after response)
  const data = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  }, 12000)
  setToken(data.token)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  // 15s timeout — login includes bcrypt compare + session creation
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, 15000)
  setToken(data.token)
  return data
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me')
}

export function logout() {
  setToken(null)
}

export async function verifyEmail(code: string): Promise<{ verified: boolean }> {
  return request('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }, 20000)
}

export async function resendVerificationCode(): Promise<{ sent: boolean }> {
  return request('/api/auth/resend-verification', { method: 'POST' }, 20000)
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  return request('/api/auth/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, 20000)
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ reset: boolean }> {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  }, 15000)
}

export async function deactivateAccount(): Promise<{ deactivated: boolean }> {
  return request('/api/auth/deactivate', { method: 'POST' })
}

export async function cancelSubscription(): Promise<{ success: boolean }> {
  return request('/api/subscription/cancel', { method: 'POST' })
}

export async function createCheckoutSession(): Promise<{ url: string }> {
  return request('/api/subscription/checkout', { method: 'POST' })
}

export async function createPortalSession(): Promise<{ url: string }> {
  return request('/api/subscription/portal', { method: 'POST' })
}

// ── EULA API ────────────────────────────────────────────────────────────────

export interface EulaData {
  version: string | null
  title?: string
  content?: string
  createdAt?: string
}

export interface EulaStatus {
  accepted: boolean
  acceptedVersion: string | null
  currentVersion: string | null
  needsAcceptance: boolean
}

export async function getCurrentEula(): Promise<EulaData> {
  return request('/api/eula/current')
}

export async function getEulaStatus(): Promise<EulaStatus> {
  return request('/api/eula/status')
}

export async function acceptEula(): Promise<{ accepted: boolean; version: string }> {
  return request('/api/eula/accept', { method: 'POST' })
}

// ── Spots API ───────────────────────────────────────────────────────────────

export interface SavedSpot {
  id: string
  name: string
  lat: number
  lng: number
  depthFt?: number
  spotType?: string
  species?: string
  notes?: string
  icon?: string
  isPrivate?: boolean
  createdAt?: string
}

export async function getSpots(): Promise<SavedSpot[]> {
  return request<SavedSpot[]>('/api/spots')
}

export async function saveSpot(spot: Omit<SavedSpot, 'id' | 'createdAt'>): Promise<SavedSpot> {
  return request<SavedSpot>('/api/spots', { method: 'POST', body: JSON.stringify(spot) })
}

export async function updateSpot(id: string, updates: Partial<Pick<SavedSpot, 'name' | 'icon' | 'notes' | 'spotType'>>): Promise<SavedSpot> {
  return request<SavedSpot>(`/api/spots/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function deleteSpot(id: string): Promise<void> {
  await request(`/api/spots/${id}`, { method: 'DELETE' })
}

export interface ImportBatch {
  id: string
  filename: string
  fileType: string
  spotCount: number
  createdAt: string
}

export async function importSpots(filename: string, fileType: string, spots: { name?: string; lat: number; lng: number; depthFt?: number; notes?: string; icon?: string }[], icon?: string): Promise<{ batchId: string; importedCount: number }> {
  return request('/api/spots/import', { method: 'POST', body: JSON.stringify({ filename, fileType, spots, icon }) })
}

export async function getImportBatches(): Promise<ImportBatch[]> {
  return request<ImportBatch[]>('/api/spots/imports')
}

export async function deleteImportBatch(batchId: string): Promise<void> {
  await request(`/api/spots/import/${batchId}`, { method: 'DELETE' })
}

// ── Trips API ───────────────────────────────────────────────────────────────

export interface TripLog {
  id: string
  tripDate: string
  title: string
  departurePort?: string
  lat?: number
  lng?: number
  speciesCaught?: string
  catchCount?: number
  notes?: string
  rating?: number
}

export async function getTrips(): Promise<TripLog[]> {
  return request<TripLog[]>('/api/trips')
}

export async function saveTrip(trip: Omit<TripLog, 'id'>): Promise<TripLog> {
  return request<TripLog>('/api/trips', { method: 'POST', body: JSON.stringify(trip) })
}

// ── Preferences API ────────────────────────────────────────────────────────

export interface UserPreferences {
  units?: string
  defaultBasemap?: string
  defaultLayers?: string
  defaultCenterLat?: number
  defaultCenterLng?: number
  defaultZoom?: number
  theme?: string
}

export async function getPreferences(): Promise<UserPreferences> {
  return request<UserPreferences>('/api/preferences')
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await request('/api/preferences', { method: 'PUT', body: JSON.stringify(prefs) })
}
