# League Broadcast Demo

A Vue 3 broadcast overlay built with [`@bluebottle_gg/league-broadcast-client`](https://github.com/BlueBottleGG/leaguebroadcast-js-client). It connects to a running **LeagueBroadcast** server and renders broadcast-ready graphics on a transparent 1920×1080 canvas — designed to be layered over game footage in OBS, vMix, or any streaming tool.

Use this as a starting point for building your own broadcast overlays — add components, swap out styles, and extend to your heart's content.

## LeagueBroadcast tiers

Not all graphics are available in every LeagueBroadcast tier. The table below shows which tier each component requires.

| Tier | What's unlocked |
|---|---|
| **Free** | Scoreboard, Player Scoreboard, Objective Timers, Minimap Frame, L-Frame |
| **Basic** | Everything above, plus: Gold Graph, Kill Feed, Skin Display, Smite Reaction, Player Cameras, Compact Teamfight |

> **Example:** The Gold Graph component requires **Basic tier** or higher. If you are on the Free tier it will not receive any data from the server.

## What's included

### Free tier

| Component | Description |
|---|---|
| **Scoreboard** | Two-row broadcast bar (top center): team logos, names, kills, gold, towers, grubs, dragons, game timer, and a gold-difference progress bar |
| **Player Scoreboard** | Per-player row showing champion, level, KDA, items, spells, and live item-buy / level-up notifications |
| **Objective Timers** | Baron and dragon respawn countdowns with the appropriate objective icon |
| **Minimap Frame** | Decorative border ring around the minimap area (blue → red gradient) |
| **L-Frame** | Left-side panel showing game info and a sponsor rotation strip |

### Basic tier

| Component | Description |
|---|---|
| **Gold Graph** | SVG gold-difference chart (bottom center) with blue/red filled regions |
| **Kill Feed** | Animated kill-feed showing up to 5 recent kills with champion icons |
| **Skin Display** | Side panels displaying each team's current champion skins by role |
| **Smite Reaction** | Reaction-time graphic triggered on smite events |
| **Player Cameras** | Camera name-bar strip for both teams, highlighted during teamfights |
| **Compact Teamfight** | Teamfight damage-dealt overview with per-player bars |

### Debug utilities

| Component | Description |
|---|---|
| **ConnectionStatus** | WebSocket + game-state indicator |
| **EventLog** | Live scrolling feed of raw game events |

> The debug panel in `App.vue` is commented out by default. Uncomment it during development to get connection diagnostics.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A running [LeagueBroadcast](https://github.com/BlueBottleGG/LeagueBroadcast) server (default port `58869`)

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). The overlay will automatically try to connect to `localhost:58869`.

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
├── App.vue                          # Transparent 1920×1080 overlay canvas
├── composables/
│   ├── useIngame.ts                 # Vue composables wrapping the client's reactive API
│   └── useNotificationQueue.ts      # Generic timed notification queue
├── stores/
│   └── eventLogStore.ts             # Pinia store for the debug event log
├── router/
│   └── index.ts                     # Vue Router setup (routes added as needed)
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
    │   └── ObjectiveTimer.vue
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
    ├── PlayerCameras/               # [Basic] Camera name-bar strip
    │   ├── PlayerCameras.vue
    │   └── PlayerCamera.vue
    └── Teamfight/                   # [Basic] Teamfight damage overview
        ├── CompactTeamfight.vue
        └── TeamfightPlayerEntry.vue
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

## Building for production

```bash
npm run build
```

Output lands in `dist/`. Serve it with any static file server.

## License

MIT
