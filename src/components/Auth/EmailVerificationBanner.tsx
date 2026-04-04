/**
 * EmailVerificationBanner — shows when user is logged in but email not verified.
 * Inline 6-digit code input with resend + dismiss.
 */

import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

export default function EmailVerificationBanner() {
  const { user, verifyEmail, resendCode, loading, error } = useAuthStore()
  const [showInput, setShowInput] = useState(false)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [verified, setVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Don't show if no user or already verified
  if (!user || user.emailVerified || verified) return null

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)

    // Auto-advance to next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits filled
    if (value && index === 5 && next.every(d => d)) {
      submitCode(next.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const next = pasted.split('')
      setDigits(next)
      inputsRef.current[5]?.focus()
      submitCode(pasted)
    }
  }

  const submitCode = async (code: string) => {
    const ok = await verifyEmail(code)
    if (ok) {
      setVerified(true)
    } else {
      setDigits(['', '', '', '', '', ''])
      inputsRef.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    const ok = await resendCode()
    if (ok) setResendCooldown(60)
  }

  if (verified) {
    return (
      <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-center animate-fade-in">
        <span className="text-xs text-emerald-400 font-medium">Email verified! Welcome to ReelMaps.</span>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 z-40">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-xs text-amber-300">
          Please verify your email. Check your inbox for a 6-digit code.
        </span>

        {!showInput ? (
          <button
            onClick={() => { setShowInput(true); setTimeout(() => inputsRef.current[0]?.focus(), 50) }}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Enter Code
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* 6-digit input */}
            <div className="flex gap-1" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputsRef.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={cn(
                    'w-7 h-8 text-center text-sm font-mono font-bold rounded bg-ocean-800 border text-slate-200 focus:outline-none focus:border-cyan-500',
                    error ? 'border-red-500/50' : 'border-ocean-600',
                  )}
                />
              ))}
            </div>

            {loading && (
              <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            )}

            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
            >
              {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
            </button>
          </div>
        )}

        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    </div>
  )
}
