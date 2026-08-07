# League Broadcast Demo

A Vue 3 broadcast overlay built with [`@bluebottle_gg/league-broadcast-client`](https://github.com/BlueBottleGG/leaguebroadcast-js-client). It connects to a running **LeagueBroadcast** server and renders broadcast-ready graphics on a transparent 1920×1080 canvas — designed to be layered over game footage in OBS, vMix, or any streaming tool.

Use this as a starting point for building your own broadcast overlays — add components, swap out styles, and extend to your heart's content.

## LeagueBroadcast tiers

Not all graphics are available in every LeagueBroadcast tier. The table below shows which tier each component requires.

| Tier | What's unlocked |
|---|---|
| **Free** | Scoreboard, Player Scoreboard, Objective Timers, Side Info Page, Minimap Frame, L-Frame |
| **Basic** | Everything above, plus: Gold Graph, Kill Feed, Announcer, Skin / Rune Display, Smite Reaction, Player Cameras, Compact Teamfight, Teamfight Recap / Damage |

> **Example:** The Gold Graph component requires **Basic tier** or higher. If you are on the Free tier it will not receive any data from the server.

## What's included

### Free tier

| Component | Description |
|---|---|
| **Scoreboard** | Two-row broadcast bar (top center): team logos, names, kills, gold, towers, grubs, dragons, game timer, and a gold-difference progress bar |
| **Player Scoreboard** | Per-player row showing champion, level, KDA, items, spells, and live item-buy / level-up notifications |
| **Objective Timers** | Baron and dragon respawn countdowns with the appropriate objective icon |
| **Minimap Frame** | Decorative border ring around the minimap area (blue → red gradient) |
| **Side Info Page** | Ranked side panel for gold, XP, CS, damage, role quests, and tower plates |
| **L-Frame** | Left-side panel showing game info, champion details with an automatic transparent-cutout fallback, inhibitor timers, and a sponsor rotation strip |

> **Champion detail and Free tier:** Champion details are enabled by default. When
> `championDetail` data is unavailable (including on the Free tier), the L-frame automatically
> shows the classic transparent cutout instead. Add `?championinfo=cutout` to force the cutout even
> when champion-detail data is available. Active inhibitor timers take precedence over both.

### Basic tier

| Component | Description |
|---|---|
| **Gold Graph** | SVG gold-difference chart (bottom center) with blue/red filled regions |
| **Kill Feed** | Animated kill-feed showing up to 5 recent kills with champion icons |
| **Announcer** | Queued first-kill, multikill, objective, structure, and neutral-monster announcements |
| **Skin Display** | Side panels displaying each team's current champion skins by role |
| **Smite Reaction** | Reaction-time graphic triggered on smite events |
| **Player Cameras** | Camera name-bar strip for both teams, highlighted during teamfights |
| **Compact Teamfight** | Teamfight damage-dealt overview with per-player bars |
| **Teamfight Recap** | Latest-teamfight per-player damage graph with display names and physical / magic / true damage splits, shown automatically when the backend publishes `teamfightTimeline` data |
| **Teamfight Damage Dealt** | Post-teamfight per-player damage bars with each bar split by damage type (physical / magic / true) |

### Match-phase scenes and tooling

| Component | Description |
|---|---|
| **Champion Select** | Full pregame draft scene with picks, bans, coaches, fearless bans, sounds, and match metadata |
| **Post Game** | Multi-screen recap for match summary, players, matchups, series state, gold, damage, and fearless draft |
| **Element Pages** | One route per overlay element, rendered at its production position for OBS or focused development |

Post-game content normally appears one of two ways: the caster picks a screen from the
LeagueBroadcast app, which drives `PostGameCombined.vue` via the backend's
`active-component-changed` broadcast; or, for local development, the `?pggame=<id>` (load a
specific game) and `?pgload` (load the current game) query params on the postgame route/element
trigger the same load without a caster session. A few caster-activatable component ids have no
component in this demo and render nothing if selected: `postgame-game-stats`,
`postgame-game-damage`, `postgame-game-gold`, `season-leaderboard`, `season-spotlight`.

### Debug utilities

| Component | Description |
|---|---|
| **ConnectionStatus** | WebSocket + game-state indicator |
| **EventLog** | Live scrolling feed of raw game events |

> The debug utilities have their own page: open `#/ingame/element/debug` during development to get connection diagnostics.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A running [LeagueBroadcast](https://github.com/BlueBottleGG/LeagueBroadcast) server (default port `58869`)

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). The overlay will automatically try to connect to `localhost:58869`.

## Routes & element pages

| Route | What it shows |
|---|---|
| `#/` | Combined ingame, champion-select, and post-game broadcast source |
| `#/ingame` | Ingame overlay only |
| `#/pregame` | Champion-select scene only |
| `#/postgame` | Post-game scene only |
| `#/ingame/element/<name>` | A single element at its exact production position |
| `#/ingame/elements` | Index of all element pages and their debug query params |

Element pages and the full overlay share the same positioning CSS ([src/views/overlay-layout.css](src/views/overlay-layout.css)) and element registry ([src/views/elements.ts](src/views/elements.ts)), so what you see on an element page is exactly what the full overlay renders.

Debug query params work on any route:

- `?bg=game` — neutral game-like gradient for layout testing. Also `bg=pregame`, `bg=dark`, any CSS color, or `bg=none` to force transparent. Default is transparent for OBS; mock games select a suitable debug gradient automatically (override with any `bg=` value).
- `?gromp` — enable the special first-Gromp-kill announcer notification (hidden by default).
- Element-specific params, e.g. `?camtest=demo` (dummy player cameras) and `?pgscreen=combined` (post-game screen) — the `/elements` index lists them all per element. Scene data itself comes from the backend: run it in its mocking mode to drive the champ-select / post-game / in-game overlays without a live match.

### Changing the server address

Edit `src/client.ts` and update `defaultClientConfig`:

```ts
export const defaultClientConfig: LeagueBroadcastClientConfig = {
  host: "192.168.0.1", // your server IP
  port: 58869,
  autoConnect: false,
};
```

## Project structure

```
src/
├── main.ts                          # App bootstrap & client setup
├── client.ts                        # Client instance & injection key
├── App.vue                          # Global styles + router outlet
├── views/
│   ├── OverlayView.vue              # Ingame overlay (#/ingame)
│   ├── PostgameView.vue             # Standalone post-game scene
│   ├── ElementView.vue              # Single element page (#/ingame/element/<name>)
│   ├── ElementIndexView.vue         # Element index (#/ingame/elements)
│   ├── elements.ts                  # Element registry (slug → components + demo params)
│   └── overlay-layout.css           # Shared 1920×1080 element positioning
├── composables/
│   ├── useIngame.ts                 # Vue composables wrapping the client's reactive API
│   └── useNotificationQueue.ts      # Generic timed notification queue
├── stores/
│   └── eventLogStore.ts             # Pinia store for the debug event log
├── router/
│   └── index.ts                     # Vue Router setup
├── transitions/
│   ├── FadeTransition.vue           # Reusable fade in/out wrapper
│   └── SlideTransition.vue          # Reusable slide in/out wrapper
├── assets/
│   ├── baron/                       # Baron, Herald, and Grub icons
│   ├── dragon/                      # Dragon-type icons (air, fire, water, …)
│   └── lane/                        # Role/lane placeholder icons
└── components/
    ├── Debug/
    │   ├── ConnectionStatus.vue     # WebSocket + game-state indicator
    │   ├── DebugBackground.vue      # ?bg= debug background (gameplay clip / color)
    │   └── EventLog.vue             # Live game event feed
    ├── Scoreboard/                  # [Free] Top-center broadcast bar
    │   ├── Scoreboard.vue
    │   ├── TeamRow.vue
    │   ├── TeamObjectiveRow.vue
    │   ├── MatchScore.vue
    │   └── TextWithIcon.vue
    ├── PlayerScoreboard/            # [Free] Per-player item/KDA rows
    │   ├── PlayerScoreboard.vue
    │   ├── PlayerInfo.vue
    │   ├── PlayerItems.vue
    │   ├── ItemWithCooldown.vue
    │   ├── SpellWithCooldown.vue
    │   ├── GoldDiff.vue
    │   ├── ProgressBar.vue
    │   ├── RoleQuestSlot.vue
    │   ├── ItemBuyNotification.vue
    │   └── LevelUpNotification.vue
    ├── ObjectiveTimer/              # [Free] Baron / dragon respawn timers
    │   ├── ObjectiveTimer.vue
    │   └── ObjectiveTimers.vue      # Baron + dragon pair wired to game state
    ├── Minimap/                     # [Free] Decorative minimap border
    │   └── MinimapFrame.vue
    ├── LFrame/                      # [Free] Left-side game-info / sponsor panel
    │   ├── LFrame.vue
    │   ├── GameInfo.vue
    │   └── SponsorRotation.vue
    ├── GoldGraph/                   # [Basic] Gold-difference SVG chart
    │   └── GoldGraph.vue
    ├── KillFeed/                    # [Basic] Animated kill-feed
    │   ├── KillFeed.vue
    │   └── KillFeedEntry.vue
    ├── SidePanel/                   # [Basic] Champion skin display panels
    │   └── SkinDisplay.vue
    ├── SmiteReaction/               # [Basic] Smite reaction-time graphic
    │   └── SmiteReaction.vue
    ├── PlayerCameras/               # [Basic] Rotating player cameras (VDO.Ninja)
    │   ├── PlayerCameras.vue
    │   ├── PlayerCamera.vue
    │   ├── VdoNinjaFrame.vue        # Self-healing VDO.Ninja view iframe
    │   └── vdoNinja.ts              # View-link URL builder
    └── Teamfight/                   # [Basic] Teamfight damage overview + recap graphs
        ├── CompactTeamfight.vue
        ├── DamageGraphPanel.vue     # Shared post-fight graph presentation
        ├── TeamfightPanels.vue      # Backend-triggered graph column
        ├── TeamfightDamageDealt.vue
        ├── TeamfightPlayerEntry.vue
        └── TeamfightRecap.vue
```

## Key patterns

### Accessing the client

The `LeagueBroadcastClient` instance is provided at the app root via Vue's `provide`/`inject`. Use `useClient()` to grab it in any component:

```ts
import { useClient } from "@/client";
const client = useClient();
```

### Reactive selectors

The `useIngameSelector` composable bridges the library's framework-agnostic reactive store with Vue refs. Only re-renders when your selected value changes:

```ts
import { useIngameSelector } from "@/composables/useIngame";

// Only updates when kills change, not on every state push
const blueKills = useIngameSelector(
  (s) => s.gameData.scoreboard?.teams[0]?.kills ?? 0
);
```

### Listening to events

```ts
const client = useClient();

client.onIngameEvents({
  onObjectiveEvent: (e) => console.log("Objective:", e.type),
  onKillFeedEvent: (e) => console.log("Kill:", e.killer, "→", e.victim),
});
```

## Testing player cameras (VDO.Ninja)

You can test the camera strip without asking anyone to start a real stream: append
`?camtest=<prefix>&camcount=10` to the overlay URL to rewire every player's `videoStreamUrl` to
dummy VDO.Ninja streams and force the camera strip visible. Works with a live/mock game (player
names come from the roster) and also without a backend (synthesizes a CAM 1–10 roster).

### OBS browser source checklist

Per [VDO.Ninja's OBS guidance](https://docs.vdo.ninja/common-errors-and-known-issues/nothing-shows-up-in-obs-or-it-is-choppy):

- **Uncheck** "Shutdown source when not visible" and "Refresh browser when scene becomes active" — both cause full WebRTC renegotiation (black screens) on every scene switch.
- OBS Settings → Advanced → toggle "Enable Browser Source Hardware Acceleration" if you see black or choppy video (enabled is usually right; on some GPUs disabling fixes it at the cost of CPU).
- Set the browser source to 1920×1080 with 30 FPS custom frame rate.
- The overlay's camera frames self-heal: they watch VDO.Ninja's `view-connection` events and auto-reload a feed that fails or disconnects (soft API reload first, then full iframe reset with backoff), on top of VDO.Ninja's own `&autorecover`/`&retry` parameters.

### Slow camera connections / "five or more STUN/TURN servers" warning

VDO.Ninja's stock ICE config (several STUN servers + geo-selected TURN servers) exceeds Chromium's 5-server threshold, which slows candidate discovery — multiplied across 10 camera connections. The overlay counters this by pinning a single STUN server (`&stun=stun:stun.l.google.com:19302`) on every view link.

If players and the OBS machine are on the same network (venue LAN) or can otherwise reach each other directly, add **`?camturn=off`** to the overlay URL — it appends `&turn=false` so connections skip TURN relays entirely, giving the fastest possible discovery. Don't use it when remote players sit behind strict NATs/firewalls: TURN is the fallback that makes those connections work at all. For recurring remote productions, a [self-hosted TURN server](https://docs.vdo.ninja/advanced-settings/turn-and-stun-parameters/turn) configured directly on the players' stream URLs beats the shared public ones.

### Camera delay (syncing cameras with a delayed program feed)

VDO.Ninja camera feeds arrive near-realtime, but many productions run a broadcast
delay between game action and the outgoing stream. That leaves the player cameras
running *ahead* of the action on screen. Add **`?camdelay=<seconds>`** to the overlay
URL (fractional seconds allowed, e.g. `?camdelay=2.5`) to hold every camera back by
that much so it lines up with the delayed program feed.

The delay is handled by VDO.Ninja's native `&buffer` — the browser's built-in WebRTC
playout buffer, in native code. The overlay does **not** capture or re-render any video
frames, so this costs the streaming PC almost nothing (a hand-rolled JS frame buffer
would be the expensive alternative). The camera feeds are already `noaudio`, so the
usual "buffering over ~3s hurts audio sync" caveat doesn't apply here.

> **Limit:** recent Chromium caps the native buffer at **~4 seconds** and treats larger
> values as a hint. For longer, reliable delays the *players* must publish with
> [`&chunked`](https://docs.vdo.ninja/advanced-settings/settings-parameters/and-chunked)
> on their stream URLs (a sender-side flag the overlay can't add to a view link); the same
> `&camdelay` then drives the larger custom buffer. The overlay logs a console warning when
> `camdelay` is set above 4s.

## Building for production

```bash
npm run build
```

Output lands in `dist/`. Serve it with any static file server.

## License

MIT
