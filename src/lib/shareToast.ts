export const SHARE_TOAST_MS = 3200

let toastEl: HTMLDivElement | null = null
let toastTimer = 0

/** Module-level toast so a ShareButton remount cannot kill it at ~1s. */
export function showShareToast(pos: { top: number; left: number }, ms: number = SHARE_TOAST_MS): void {
  if (typeof document === 'undefined') return
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.setAttribute('role', 'status')
    toastEl.textContent = 'Link copied'
    toastEl.style.cssText = [
      'position:fixed',
      'z-index:2147483646',
      'padding:6px 10px',
      'border-radius:6px',
      'background:#0891b2',
      'color:#fff',
      'font-size:11px',
      'font-weight:500',
      'white-space:nowrap',
      'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
      'pointer-events:none',
      'transform:translateX(-50%)',
    ].join(';')
    document.body.appendChild(toastEl)
  }
  toastEl.style.top = `${pos.top}px`
  toastEl.style.left = `${pos.left}px`
  toastEl.style.display = 'block'
  toastEl.style.opacity = '1'
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.display = 'none'
  }, ms)
}
