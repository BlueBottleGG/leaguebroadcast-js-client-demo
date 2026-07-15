/**
 * Helpers for building VDO.Ninja view links used by the player camera overlay.
 *
 * Parameter reference: https://docs.vdo.ninja/advanced-settings
 * - `cover`          crop-fill the video into the iframe (viewer-side)
 * - `videobitrate`   target inbound bitrate in kbps (viewer-side)
 * - `viewheight`     asks the sender to scale down to this height for this
 *                    connection only (viewer-side, unlike `height` which is a
 *                    sender capture constraint)
 * - `noaudio`        keep the connection but drop inbound audio
 * - `cleanoutput`    hide all VDO.Ninja UI, pop-ups and spinners
 * - `buffer`         viewer-side playout delay in ms (see `?camdelay` below)
 * - `autorecover`/`retry`/`retrytimeout`  self-healing for unattended
 *                    overlays (https://docs.vdo.ninja/guides/handling-guest-disconnects-and-connection-recovery)
 * - `stun`           replaces VDO.Ninja's default STUN list with a single
 *                    server. Together with the default TURN entries the stock
 *                    list exceeds Chromium's 5-ICE-server threshold, which
 *                    triggers "Using five or more STUN/TURN servers slows
 *                    down discovery" and delays connection setup — noticeable
 *                    ×10 cameras (https://docs.vdo.ninja/advanced-settings/turn-and-stun-parameters)
 */

/** Viewer-side parameters appended to every camera view link. */
export const DEFAULT_VIEW_PARAMS: string[] = [
  'cover',
  'videobitrate=500',
  'viewheight=360',
  'noaudio',
  'cleanoutput',
  'autorecover=1',
  'retry',
  'retrytimeout=5000',
  'stun=stun:stun.l.google.com:19302',
]

/**
 * `?camturn=off` on the overlay URL adds `turn=false` to every view link,
 * skipping TURN servers entirely. Fastest possible ICE discovery — use it
 * when players and the OBS machine share a network (venue LAN) or all peers
 * can reach each other directly; without a TURN fallback, peers behind
 * symmetric NAT / restrictive firewalls will fail to connect.
 */
function extraIceParams(): string[] {
  const camturn = new URLSearchParams(window.location.search).get('camturn')
  if (camturn === 'off' || camturn === 'false') return ['turn=false']
  return []
}

/**
 * `?camdelay=<seconds>` adds a viewer-side playout delay to every camera, to
 * line the near-realtime VDO.Ninja feeds up with a delayed program feed (the
 * action→stream broadcast delay some productions run). Fractional seconds are
 * allowed (`camdelay=2.5`).
 *
 * The delay is held by VDO.Ninja's native `&buffer` — the browser's built-in
 * WebRTC playout buffer, in native code. No frames are captured or re-rendered
 * in this overlay, so it costs the streaming PC almost nothing (unlike a
 * hand-rolled canvas frame buffer). Our feeds are `noaudio`, so the usual
 * ">3s buffering hurts audio sync" caveat doesn't apply.
 *
 * Recent Chromium caps the native buffer at ~4s and treats larger values as a
 * hint. For longer, reliable delays the *players* must publish with `&chunked`
 * (a sender-side flag we can't set from a view link); this same `&buffer` then
 * drives the larger custom buffer.
 * https://docs.vdo.ninja/advanced-settings/video-parameters/buffer
 */
export const CAMERA_DELAY_MAX_MS = 300_000
/** Above this the native buffer won't hold reliably without `&chunked` publishing. */
const NATIVE_BUFFER_CAP_MS = 4_000

function delayParams(): string[] {
  const raw = new URLSearchParams(window.location.search).get('camdelay')
  if (!raw) return []
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds <= 0) return []
  const ms = Math.min(Math.round(seconds * 1000), CAMERA_DELAY_MAX_MS)
  if (ms > NATIVE_BUFFER_CAP_MS) {
    console.warn(
      `[PlayerCameras] camdelay=${seconds}s exceeds VDO.Ninja's ~4s native buffer cap; ` +
        `delays this long only hold if the players publish with &chunked. Applying buffer=${ms}.`,
    )
  }
  return [`buffer=${ms}`]
}

/** Minimal permissions a view-only (no capture) iframe needs. */
export const VIEW_IFRAME_ALLOW = 'autoplay; fullscreen'

function hasParam(url: string, param: string): boolean {
  const name = param.split('=')[0]
  return new RegExp(`[?&]${name}(=|&|$)`).test(url)
}

/**
 * Append view parameters to a VDO.Ninja link without clobbering anything the
 * operator already configured on the stream URL. Handles URLs with or without
 * an existing query string.
 */
export function buildViewUrl(rawUrl: string, params: string[] = DEFAULT_VIEW_PARAMS): string {
  const missing = [...params, ...extraIceParams(), ...delayParams()].filter(
    (p) => !hasParam(rawUrl, p),
  )
  if (missing.length === 0) return rawUrl
  const separator = rawUrl.includes('?') ? '&' : '?'
  return rawUrl + separator + missing.join('&')
}
