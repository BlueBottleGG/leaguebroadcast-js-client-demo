/**
 * Registry of all overlay elements, used by the router views:
 *   /ingame/element/<slug>  — renders one element at its real overlay position
 *   /ingame/elements        — index page listing every element and its debug params
 *
 * Positioning comes from the shared overlay-layout.css classes, so an element
 * page looks exactly like the element does on the ingame overlay (/ingame).
 * This also makes each element usable as its own OBS browser source.
 */
import type { Component } from 'vue'
import { Team } from '@bluebottle_gg/league-broadcast-client'

import Scoreboard from '@/components/Scoreboard/Scoreboard.vue'
import PlayerScoreboard from '@/components/PlayerScoreboard/PlayerScoreboard.vue'
import ObjectiveTimers from '@/components/ObjectiveTimer/ObjectiveTimers.vue'
import MinimapFrame from '@/components/Minimap/MinimapFrame.vue'
import LFrame from '@/components/LFrame/LFrame.vue'
import ObjectivePowerPlayContainer from '@/components/ObjectivePowerPlay/ObjectivePowerPlayContainer.vue'
import SkinDisplay from '@/components/SidePanel/SkinDisplay.vue'
import RuneDisplay from '@/components/SidePanel/RuneDisplay.vue'
import SideInfoPage from '@/components/SideInfoPage/SideInfoPage.vue'
import SmiteReaction from '@/components/SmiteReaction/SmiteReaction.vue'
import KillFeed from '@/components/KillFeed/KillFeed.vue'
import Announcer from '@/components/Announcer/Announcer.vue'
import ChampionSelectScene from '@/components/ChampionSelect/ChampionSelectScene.vue'
import PostGameScene from '@/components/PostGame/PostGameScene.vue'
import PlayerCameras from '@/components/PlayerCameras/PlayerCameras.vue'
import GoldGraph from '@/components/GoldGraph/GoldGraph.vue'
import CompactTeamfight from '@/components/Teamfight/CompactTeamfight.vue'
import TeamfightPanels from '@/components/Teamfight/TeamfightPanels.vue'
import ConnectionStatus from '@/components/Debug/ConnectionStatus.vue'
import EventLog from '@/components/Debug/EventLog.vue'

/** One rendered component of an element (some elements are made of several). */
export interface ElementPart {
  component: Component
  props?: Record<string, unknown>
  class?: string
}

export interface ElementDef {
  slug: string
  title: string
  parts: ElementPart[]
  /** Query params the element understands (dev builds only), for the index page. */
  demoParams?: string[]
}

export const elements: ElementDef[] = [
  {
    slug: 'champion-select',
    title: 'Champion Select (pregame scene)',
    parts: [{ component: ChampionSelectScene, class: 'overlay-champion-select' }],
  },
  {
    slug: 'postgame',
    title: 'Post Game (recap scene)',
    parts: [{ component: PostGameScene, class: 'overlay-postgame' }],
    demoParams: [
      'pgload — call client.showPostGame() on mount',
      'pggame=<id> — call client.showPostGame(id) on mount',
      'pgscreen=overview|player|player-stats|matchup|series|fearless|combined|fearless-tree — initial screen',
      'pgplayer=<0-9> — player index for the player / player-stats screens',
      'pgscreen=combined&pgcomponent=postgame-game|postgame-player|postgame-player-stats|matchup-full|matchup-current|fearless-bans — caster-driven combined screen (mock mode)',
      'pgscreen=fearless-tree — fearless draft bracket screen',
    ],
  },
  {
    slug: 'scoreboard',
    title: 'Scoreboard',
    parts: [{ component: Scoreboard, class: 'overlay-scoreboard' }],
  },
  {
    slug: 'player-scoreboard',
    title: 'Player Scoreboard',
    parts: [{ component: PlayerScoreboard, class: 'overlay-playerscoreboard' }],
  },
  {
    slug: 'objective-timers',
    title: 'Objective Timers',
    parts: [{ component: ObjectiveTimers, class: 'overlay-objective-timers' }],
  },
  {
    slug: 'minimap',
    title: 'Minimap Frame',
    parts: [{ component: MinimapFrame, class: 'overlay-minimap' }],
  },
  {
    slug: 'lframe',
    title: 'L-Frame / Sponsors',
    parts: [{ component: LFrame, class: 'overlay-lframe' }],
    demoParams: ['championinfo=cutout — force the transparent cutout instead of champion details'],
  },
  {
    slug: 'power-play',
    title: 'Objective Power Play',
    parts: [{ component: ObjectivePowerPlayContainer }],
  },
  {
    slug: 'skin-display',
    title: 'Skin Display',
    parts: [
      { component: SkinDisplay, props: { team: Team.Order }, class: 'overlay-skindisplay' },
      {
        component: SkinDisplay,
        props: { team: Team.Chaos, mirror: true },
        class: 'overlay-skindisplay',
      },
    ],
  },
  {
    slug: 'rune-display',
    title: 'Rune Display',
    parts: [
      { component: RuneDisplay, props: { team: Team.Order }, class: 'overlay-skindisplay' },
      {
        component: RuneDisplay,
        props: { team: Team.Chaos, mirror: true },
        class: 'overlay-skindisplay',
      },
    ],
  },
  {
    slug: 'side-info',
    title: 'Side Info Page',
    parts: [{ component: SideInfoPage, class: 'overlay-side-info' }],
  },
  {
    slug: 'smite-reaction',
    title: 'Smite Reaction',
    parts: [{ component: SmiteReaction, class: 'overlay-smitereaction' }],
  },
  {
    slug: 'kill-feed',
    title: 'Kill Feed',
    parts: [{ component: KillFeed, class: 'overlay-killfeed' }],
  },
  {
    slug: 'announcer',
    title: 'Announcer',
    parts: [{ component: Announcer, class: 'overlay-announcer' }],
    demoParams: ['gromp — enable the special first-Gromp-kill announcement'],
  },
  {
    slug: 'player-cameras',
    title: 'Player Cameras',
    parts: [{ component: PlayerCameras, class: 'overlay-playercameras' }],
    demoParams: [
      'camtest=<prefix> — dummy vdo.ninja streams instead of the real roster',
      'camcount=<n>, camserver=<url> — options for camtest',
      'camicon=<url> — fallback portrait for dummy players (full http URL)',
      'camturn=<mode> — TURN relay override',
      'camdelay=<seconds> — viewer-side playout delay to sync cameras with a delayed program feed',
    ],
  },
  {
    slug: 'gold-graph',
    title: 'Gold Graph',
    parts: [{ component: GoldGraph, class: 'overlay-bottom' }],
  },
  {
    slug: 'teamfight',
    title: 'Compact Teamfight',
    parts: [{ component: CompactTeamfight, class: 'overlay-teamfight' }],
  },
  {
    slug: 'teamfight-panels',
    title: 'Teamfight Damage Panels',
    parts: [{ component: TeamfightPanels, class: 'overlay-teamfight-panels' }],
  },
  {
    slug: 'debug',
    title: 'Debug (connection + event log)',
    parts: [
      { component: ConnectionStatus, class: 'overlay-debug-connection' },
      { component: EventLog, class: 'overlay-debug-eventlog' },
    ],
  },
]

export function getElement(slug: string): ElementDef | undefined {
  return elements.find((e) => e.slug === slug)
}
