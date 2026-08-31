import * as THREE from 'three'
import TopIcon from '@/assets/lane/top-placeholder-cropped.svg?url'
import JungleIcon from '@/assets/lane/jgl-placeholder-cropped.svg?url'
import MidIcon from '@/assets/lane/mid-placeholder-cropped.svg?url'
import BotIcon from '@/assets/lane/bot-placeholder-cropped.svg?url'
import SupportIcon from '@/assets/lane/sup-placeholder-cropped.svg?url'
import studioFloorTextureUrl from './assets/pregame_floor_albedo.png'

// Stage hover policy.
export const MODEL_PRELOAD_DEBOUNCE_MS = 150
export const ACTOR_SWAP_DURATION_SECONDS = 0.55

// Physical pick-card presentation.
export const PICK_CARD_WIDTH = 1.34
export const PICK_CARD_HEIGHT = 2.52
export const PICK_CARD_BORDER_RADIUS = 0.15
export const PICK_CARD_BORDER_TUBE_RADIUS = 0.018
export const PICK_CARD_TARGET_Y = 1.9
export const PICK_CARD_ENTRANCE_DURATION_SECONDS = 0.62
export const PICK_CARD_EXIT_DURATION_SECONDS = 0.22
export const PICK_CARD_CONTENT_RESPONSE = 17
export const PICK_CARD_SPOTLIGHT_RESPONSE = 12

export const BLUE = new THREE.Color(0x2d9cff)
export const RED = new THREE.Color(0xff365f)

// Floor identity layout.
export const TEAM_LOGO_X = 6.35
export const TEAM_LOGO_Z = 0.15
export const TEAM_NAME_Z = -2.55
export const TEAM_NAME_WIDTH = 8.2
export const TEAM_NAME_HEIGHT = 1.52
export const TEAM_SCORE_X = 3.05
export const TEAM_SCORE_Z = 0.08
export const TEAM_SCORE_SIZE = 3

export const PICK_LANES = ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'] as const
export const PICK_LANE_ICONS = [TopIcon, JungleIcon, MidIcon, BotIcon, SupportIcon] as const
export const DEFAULT_LANE_ICON = MidIcon
export const STUDIO_FLOOR_TEXTURE_URL = studioFloorTextureUrl

// Draft action animations.
export const CHAKRAM_SPIN_DURATION_SECONDS = 1.15
export const CHAKRAM_SPIN_RAMP_RATIO = 0.27
export const CHAKRAM_SPIN_TURNS = 3
export const BAN_WALL_LOCK_DURATION_SECONDS = 0.72
export const BAN_WALL_NAME_WIDTH = 1.96
export const BAN_WALL_NAME_HEIGHT = 0.52
export const BAN_WALL_NAME_Y = 3.48

// Broadcast camera choreography.
export const CAMERA_FINAL_FOV = 36
export const CAMERA_BASE_POSITION = new THREE.Vector3(0, 5.4, 22)
export const CAMERA_BASE_TARGET = new THREE.Vector3(0, 1.9, -2.8)
export const CAMERA_INTRO_POSITION = new THREE.Vector3(0, 21.5, 4.7)
export const CAMERA_INTRO_CONTROL_POSITION = new THREE.Vector3(0, 13.2, 13.8)
export const CAMERA_INTRO_TARGET = new THREE.Vector3(0, 0, -1.2)
export const CAMERA_INTRO_FOV = 40
export const CAMERA_INTRO_HOLD_SECONDS = 3.62
export const CAMERA_INTRO_MOVE_SECONDS = 1.75
export const CAMERA_EXIT_POSITION = new THREE.Vector3(0, 9.2, 37)
export const CAMERA_EXIT_TARGET = new THREE.Vector3(0, 6.4, -12.22)
export const CAMERA_EXIT_FOV = 3
export const CAMERA_EXIT_DURATION_SECONDS = 1.14
export const CAMERA_SWAY_PHASES = Array.from({ length: 11 }, () => Math.random() * Math.PI * 2)
export const CAMERA_SWAY_STRENGTH = 4.75
export const CAMERA_ACTION_TARGET_OFFSET = 0.52
export const CAMERA_ACTION_TARGET_TRANSITION_SECONDS = 3.4

/** Fixed light count keeps Three.js shader programs stable during lock-ins. */
export const CHAMPION_STAGE_LIGHTING = {
  ambient: { sky: 0x718097, ground: 0x010203, intensity: 0.16 },
  key: {
    color: 0xf7f8fb,
    intensity: 900,
    distance: 44,
    angle: Math.PI / 5.1,
    penumbra: 0.78,
    decay: 1.7,
    position: [-5.5, 13, 10] as const,
    target: [0, 1.25, -2.8] as const,
    shadowMapSize: 2048,
    shadowNear: 2,
    shadowFar: 42,
    shadowBias: -0.0005,
  },
  fill: {
    color: 0xaebbd0,
    intensity: 165,
    distance: 36,
    angle: Math.PI / 4.2,
    penumbra: 0.9,
    decay: 1.9,
    position: [10, 7.5, 8] as const,
    target: [-2.5, 2, -3] as const,
  },
  actorFill: {
    blueColor: 0xdcecff,
    redColor: 0xffe4ea,
    intensity: 190,
    distance: 30,
    angle: Math.PI / 4.15,
    penumbra: 0.92,
    decay: 1.8,
    x: 6.3,
    y: 7.4,
    z: 7.5,
    targetY: 2.1,
    targetZ: -2.5,
  },
  teamRim: {
    intensity: 210,
    distance: 32,
    angle: Math.PI / 6,
    penumbra: 0.82,
    decay: 1.65,
    x: 10.5,
    y: 8.5,
    z: -5.5,
    targetXRatio: 0.52,
    targetY: 1.8,
    targetZ: -2.3,
  },
  wallWash: {
    color: 0xe7ebf2,
    intensity: 105,
    distance: 34,
    angle: Math.PI / 6,
    penumbra: 0.94,
    decay: 1.9,
    position: [0, 10, 7] as const,
    target: [0, 4, -12] as const,
  },
} as const
