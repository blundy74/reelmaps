/**
 * Procedural thunder sounds via Web Audio API.
 *
 * Generates thunder using filtered noise + low-frequency rumble.
 * No audio files needed — everything is synthesized on the fly.
 * Distance-attenuated and delayed to simulate speed of sound.
 *
 * Must be called after a user gesture (browser autoplay policy).
 */

let ctx: AudioContext | null = null
let lastPlayTime = 0
const MIN_INTERVAL_MS = 800 // don't stack too many sounds

function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

/**
 * Generate a buffer of white noise.
 */
function createNoiseBuffer(audioCtx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = audioCtx.sampleRate
  const length = Math.floor(sampleRate * durationSec)
  const buffer = audioCtx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1)
  }
  return buffer
}

/**
 * Play a procedural thunder clap.
 *
 * @param distanceKm — distance from the map center to the strike.
 *   Affects volume (attenuated) and delay (speed of sound ≈ 0.343 km/s).
 */
export function playThunder(distanceKm: number): void {
  const now = Date.now()
  if (now - lastPlayTime < MIN_INTERVAL_MS) return
  lastPlayTime = now

  try {
    const audioCtx = getAudioContext()
    const t = audioCtx.currentTime

    // Delay based on speed of sound (~343 m/s = 0.343 km/s)
    // Cap at 8 seconds so distant strikes don't feel weird
    const delaySec = Math.min(distanceKm / 0.343, 8)

    // Volume: 1.0 at 0 km, fading to 0.05 at 100 km
    const volume = Math.max(0.05, 1.0 - distanceKm / 100)

    // Duration: nearby = short crack + rumble, distant = just rumble
    const duration = distanceKm < 15 ? 1.8 : distanceKm < 40 ? 2.5 : 3.5

    // ── Noise source (the "crack" and "rumble") ──────────────────────
    const noiseBuffer = createNoiseBuffer(audioCtx, duration)
    const noiseSource = audioCtx.createBufferSource()
    noiseSource.buffer = noiseBuffer

    // Bandpass filter: nearby = higher frequency crack, distant = low rumble
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = distanceKm < 15 ? 300 : distanceKm < 40 ? 150 : 80
    filter.Q.value = 0.5

    // Envelope: sharp attack, long decay
    const envelope = audioCtx.createGain()
    const start = t + delaySec
    envelope.gain.setValueAtTime(0, start)

    if (distanceKm < 15) {
      // Near: sharp crack then rumble
      envelope.gain.linearRampToValueAtTime(volume * 0.9, start + 0.02)
      envelope.gain.exponentialRampToValueAtTime(volume * 0.3, start + 0.15)
      envelope.gain.exponentialRampToValueAtTime(volume * 0.15, start + 0.6)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration)
    } else {
      // Far: gradual rumble
      envelope.gain.linearRampToValueAtTime(volume * 0.4, start + 0.3)
      envelope.gain.exponentialRampToValueAtTime(volume * 0.15, start + 1.0)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration)
    }

    // ── Low-frequency sub-bass oscillator ────────────────────────────
    const subOsc = audioCtx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = 30 + Math.random() * 20
    const subGain = audioCtx.createGain()
    subGain.gain.setValueAtTime(0, start)
    subGain.gain.linearRampToValueAtTime(volume * 0.15, start + 0.1)
    subGain.gain.exponentialRampToValueAtTime(0.001, start + duration * 0.8)

    // ── Connect graph ────────────────────────────────────────────────
    noiseSource.connect(filter)
    filter.connect(envelope)
    envelope.connect(audioCtx.destination)

    subOsc.connect(subGain)
    subGain.connect(audioCtx.destination)

    // ── Play ─────────────────────────────────────────────────────────
    noiseSource.start(start)
    noiseSource.stop(start + duration + 0.1)
    subOsc.start(start)
    subOsc.stop(start + duration + 0.1)
  } catch {
    // AudioContext may not be available
  }
}
