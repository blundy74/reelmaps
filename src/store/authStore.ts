import { create } from 'zustand'
import type { AuthUser } from '../lib/apiClient'
import {
  login as apiLogin, register as apiRegister, getMe, logout as apiLogout, getToken,
  verifyEmail as apiVerifyEmail, resendVerificationCode as apiResendCode,
} from '../lib/apiClient'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  suggestions: string[]
  showAuthModal: boolean
  authMode: 'login' | 'register'

  setShowAuthModal: (show: boolean) => void
  setAuthMode: (mode: 'login' | 'register') => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  verifyEmail: (code: string) => Promise<boolean>
  resendCode: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: false,
  error: null,
  suggestions: [],
  showAuthModal: false,
  authMode: 'login',

  setShowAuthModal: (show) => set({ showAuthModal: show, error: null, suggestions: [] }),
  setAuthMode: (mode) => set({ authMode: mode, error: null, suggestions: [] }),

  login: async (email, password) => {
    set({ loading: true, error: null, suggestions: [] })
    try {
      const data = await apiLogin(email, password)
      set({ user: data.user, loading: false, showAuthModal: false })
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true, error: null, suggestions: [] })
    try {
      const data = await apiRegister(email, password, displayName)
      set({ user: data.user, loading: false, showAuthModal: false })
    } catch (err: any) {
      if (err.suggestions?.length) {
        set({ loading: false, error: err.message, suggestions: err.suggestions })
      } else {
        set({ loading: false, error: err.message })
      }
    }
  },

  logout: () => {
    apiLogout()
    set({ user: null })
  },

  checkAuth: async () => {
    if (!getToken()) return
    try {
      const user = await getMe()
      set({ user })
    } catch {
      apiLogout()
    }
  },

  verifyEmail: async (code) => {
    set({ loading: true, error: null })
    try {
      await apiVerifyEmail(code)
      // Update user state to reflect verified status
      const user = get().user
      if (user) set({ user: { ...user, emailVerified: true } })
      set({ loading: false })
      return true
    } catch (err: any) {
      set({ loading: false, error: err.message })
      return false
    }
  },

  resendCode: async () => {
    set({ error: null })
    try {
      await apiResendCode()
      return true
    } catch (err: any) {
      set({ error: err.message })
      return false
    }
  },
}))
