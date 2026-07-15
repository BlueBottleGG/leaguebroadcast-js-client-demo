// Champion-select action cues (pick / ban).
//
// Sounds are intentionally decoupled from where they fire: the scene calls
// `playActionSound('pick' | 'ban')` and this module owns loading, per-cue
// volume, overlap and the master switch.
//
// -------------------------------------------------------------------------
// SWAPPING SOUNDS
//   To use a different sound, drop your file into src/assets/sounds/ and
//   change the `src` import below — that is the only line that needs to change
//   (.wav, .mp3 and .ogg all work). Tune loudness with `volume`.
// -------------------------------------------------------------------------

import banSlash from '@/assets/sounds/sword.slash.mp3'
import pickThud from '@/assets/sounds/pick-thud.ogg'

export type ActionSound = 'pick' | 'ban'

interface CueConfig {
  src: string
  /** per-cue gain, 0..1 — trim so pick and ban sit at the same perceived level */
  volume: number
}

// ── DISABLE ALL SOUND ────────────────────────────────────────────────────
// Flip to `false` to turn the champion-select cues off entirely.
// (Or, without touching code, add `?nosound` to the overlay URL.)
const SOUND_ENABLED = true

// ── VOLUME ───────────────────────────────────────────────────────────────
// Overall loudness, 0..1. This is the default level for every cue.
const MASTER_VOLUME = 0.2

const CUES: Record<ActionSound, CueConfig> = {
  pick: { src: pickThud, volume: 1.0 },
  ban: { src: banSlash, volume: 0.1 },
}

const muted =
  !SOUND_ENABLED ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nosound'))

// One preloaded element per cue as the template; we clone on play so rapid
// picks/bans can overlap instead of cutting each other off.
const templates: Partial<Record<ActionSound, HTMLAudioElement>> = {}

function template(cue: ActionSound): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  let el = templates[cue]
  if (!el) {
    el = new Audio(CUES[cue].src)
    el.preload = 'auto'
    templates[cue] = el
  }
  return el
}

// Warm the audio cache so the first pick/ban isn't a late, decoded-on-demand
// hit. Safe to call more than once. Call from the scene's setup.
export function preloadActionSounds(): void {
  if (muted) return
  ;(Object.keys(CUES) as ActionSound[]).forEach((cue) => template(cue)?.load())
}

/**
 * Play a champion-select action cue. No-ops when muted or before audio is
 * unlocked by the environment — the returned promise never rejects, so callers
 * can fire-and-forget from inside a lock-in handler.
 */
export function playActionSound(cue: ActionSound): void {
  if (muted) return
  const base = template(cue)
  if (!base) return
  const sound = base.cloneNode() as HTMLAudioElement
  sound.volume = Math.max(0, Math.min(1, CUES[cue].volume * MASTER_VOLUME))
  // Autoplay policy: a browser tab may block playback until a user gesture.
  // OBS browser sources autoplay fine; in a plain dev tab the first cue may be
  // dropped — swallow that rather than surfacing an unhandled rejection.
  void sound.play().catch(() => {})
}
