<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import * as THREE from 'three'
import { useClient } from '@/client'
import { resolveBackendAssetUrl } from '@/utils/backendAssets'
import {
  CHAMPION_MODEL_WORLD_SCALE,
  CHAMPION_MODEL_YAW,
  createChampionModelRuntime,
  disposeChampionModelInstance,
  playChampionModelAnimation,
  type ChampionModelInstance,
  type ChampionModelRuntime,
} from '../model/championModelRuntime'
import {
  collectStageActors,
  collectStageBanWalls,
  collectStagePickCards,
  collectStageTeamIdentities,
  planStageActorReconciliation,
  resolveStageCameraActiveSide,
  stageActorSignature,
  stageBanWallSignature,
  stagePickCardSignature,
  stageTeamIdentitySignature,
  type StageBanWallDescriptor,
  type StageChampionActor,
  type StagePickCardDescriptor,
  type StageSide,
  type StageTeamIdentityDescriptor,
} from './championStageState'
import {
  ACTOR_SWAP_DURATION_SECONDS,
  BAN_WALL_LOCK_DURATION_SECONDS,
  BAN_WALL_NAME_HEIGHT,
  BAN_WALL_NAME_WIDTH,
  BAN_WALL_NAME_Y,
  BLUE,
  CAMERA_FINAL_FOV,
  CHAKRAM_SPIN_DURATION_SECONDS,
  CHAKRAM_SPIN_RAMP_RATIO,
  CHAKRAM_SPIN_TURNS,
  DEFAULT_LANE_ICON,
  MODEL_PRELOAD_DEBOUNCE_MS,
  PICK_CARD_BORDER_RADIUS,
  PICK_CARD_BORDER_TUBE_RADIUS,
  PICK_CARD_CONTENT_RESPONSE,
  PICK_CARD_ENTRANCE_DURATION_SECONDS,
  PICK_CARD_EXIT_DURATION_SECONDS,
  PICK_CARD_HEIGHT,
  PICK_CARD_SPOTLIGHT_RESPONSE,
  PICK_CARD_TARGET_Y,
  PICK_CARD_WIDTH,
  PICK_LANE_ICONS,
  PICK_LANES,
  RED,
  TEAM_LOGO_X,
  TEAM_LOGO_Z,
  TEAM_NAME_HEIGHT,
  TEAM_NAME_WIDTH,
  TEAM_NAME_Z,
  TEAM_SCORE_SIZE,
  TEAM_SCORE_X,
  TEAM_SCORE_Z,
} from './championStageConfig'
import {
  type ActiveBan,
  type ActivePickLane,
  type ActorRuntime,
  type BanWallRuntime,
  type PickCardRuntime,
  type TeamIdentityTextRuntime,
  type TeamLogoRuntime,
} from './championStageRuntime'
import { addChampionStageLighting, createChampionStageStudio } from './championStageStudio'
import { ChampionStageCameraController } from './championStageCamera'

const props = defineProps<{
  activeSide?: StageSide | null
  blueBans?: championSelectTeam['bans']
  blueTeam?: championSelectTeam
  draftActive?: boolean
  eventLogoUrl?: string | null
  eventName?: string | null
  redBans?: championSelectTeam['bans']
  redTeam?: championSelectTeam
}>()

const container = ref<HTMLDivElement>()
const client = useClient()
const apiBase = client.getApiUrl().replace(/\/$/, '')
const actorDescriptors = computed(() => collectStageActors(props.blueTeam, props.redTeam))
const actorSignature = computed(() =>
  actorDescriptors.value.map(stageActorSignature).sort().join('|'),
)
const pickCardDescriptors = computed(() => collectStagePickCards(props.blueTeam, props.redTeam))
const pickCardSignature = computed(() =>
  pickCardDescriptors.value.map(stagePickCardSignature).sort().join('|'),
)
const banWallDescriptors = computed(() =>
  collectStageBanWalls(props.blueTeam, props.redTeam, props.blueBans, props.redBans),
)
const banWallSignature = computed(() =>
  banWallDescriptors.value.map(stageBanWallSignature).sort().join('|'),
)
const activeBan = computed<ActiveBan | null>(() => {
  for (const [side, bans] of [
    ['blue', props.blueBans ?? props.blueTeam?.bans],
    ['red', props.redBans ?? props.redTeam?.bans],
  ] as const) {
    const index = bans?.findIndex((ban) => ban.isActive) ?? -1
    if (index >= 0) return { index, side }
  }
  return null
})
const activeBanSignature = computed(() => {
  const active = activeBan.value
  return active ? `${active.side}:${active.index}` : 'none'
})
const activePickLane = computed<ActivePickLane | null>(() => {
  for (const [side, team] of [
    ['blue', props.blueTeam],
    ['red', props.redTeam],
  ] as const) {
    const index = team?.slots?.findIndex((slot) => slot.isActive) ?? -1
    if (index >= 0) {
      const laneIndex = Math.min(index, PICK_LANES.length - 1)
      return {
        iconUrl: PICK_LANE_ICONS[laneIndex] ?? DEFAULT_LANE_ICON,
        label: PICK_LANES[laneIndex] ?? 'PICK',
        side,
      }
    }
  }
  return null
})
const activePickSignature = computed(() => {
  const active = activePickLane.value
  return active ? `${active.side}:${active.label}` : 'draft'
})
const activeActionSide = computed<StageSide | null>(() =>
  props.activeSide !== undefined
    ? props.activeSide
    : (activeBan.value?.side ?? activePickLane.value?.side ?? null),
)
const cameraActiveSide = computed(() =>
  resolveStageCameraActiveSide(
    activeActionSide.value,
    props.draftActive ?? true,
    props.blueTeam,
    props.redTeam,
  ),
)
const activeModelAliases = computed(() =>
  [props.blueTeam, props.redTeam]
    .flatMap((team) => team?.slots ?? [])
    .filter((slot) => slot.isActive && slot.champion?.alias)
    .map((slot) => slot.champion?.alias ?? ''),
)
const activeModelSignature = computed(() => [...activeModelAliases.value].sort().join('|'))
const lockedActionKeys = computed(() => {
  const keys: string[] = []
  for (const [side, team] of [
    ['blue', props.blueTeam],
    ['red', props.redTeam],
  ] as const) {
    team?.slots?.forEach((slot, index) => {
      if (slot.champion && !slot.isActive) keys.push(`pick-${side}-${index}`)
    })
    team?.bans?.forEach((ban, index) => {
      if (ban.champion && !ban.isActive) keys.push(`ban-${side}-${index}`)
    })
  }
  return keys.sort()
})
const lockedActionSignature = computed(() => lockedActionKeys.value.join('|'))

function resolveTeamLogoUrl(path?: string): string | null {
  return resolveBackendAssetUrl(client, path)
}

const teamLogoSignature = computed(() =>
  [
    resolveTeamLogoUrl(props.blueTeam?.metaData?.iconUri),
    resolveTeamLogoUrl(props.redTeam?.metaData?.iconUri),
  ].join('|'),
)
const teamIdentityDescriptors = computed(() =>
  collectStageTeamIdentities(props.blueTeam, props.redTeam),
)
const teamIdentityTextSignature = computed(() =>
  teamIdentityDescriptors.value.map(stageTeamIdentitySignature).join('|'),
)
const eventBrandSignature = computed(
  () => `${props.eventLogoUrl?.trim() ?? ''}|${props.eventName?.trim() ?? ''}`,
)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let cameraController: ChampionStageCameraController | undefined
let modelRuntime: ChampionModelRuntime | undefined
let resizeObserver: ResizeObserver | undefined
let stageReady = false
let hasSyncedDraft = false
const timer = new THREE.Timer()
const actorRuntimes = new Map<string, ActorRuntime>()
const pickCardRuntimes = new Map<string, PickCardRuntime>()
const banWallRuntimes = new Map<string, BanWallRuntime>()
const teamLogoRuntimes = new Map<StageSide, TeamLogoRuntime>()
const teamIdentityTextRuntimes = new Map<StageSide, TeamIdentityTextRuntime>()
const banWallParents = new Map<StageSide, THREE.Group>()
const stageResources = new Set<{ dispose: () => void }>()
let spinnerDisplayTexture: THREE.CanvasTexture | undefined
let spinnerDisplayMesh: THREE.Mesh | undefined
let laneDisplayTexture: THREE.CanvasTexture | undefined
let laneDisplayMesh: THREE.Mesh | undefined
let banStatusDisplayTexture: THREE.CanvasTexture | undefined
let banStatusDisplayMesh: THREE.Mesh | undefined
let banFloorSpotlightTexture: THREE.CanvasTexture | undefined
let banSpotlightTexture: THREE.CanvasTexture | undefined
let pickCardAlphaMaskTexture: THREE.CanvasTexture | undefined
let chakramSpinElapsed: number | undefined
let chakramSpinDirection = 1
const queuedChakramSpinDirections: number[] = []
let knownLockedActionKeys = new Set<string>()
let teamLogoSyncVersion = 0
let modelPreloadTimer: number | undefined
const laneIconImages = new Map<string, HTMLImageElement>()
const unavailableDisplayImages = new Set<string>()
let cameraExitRequested = false
let reducedMotionQuery: MediaQueryList | undefined
let prefersReducedMotion = false

function addStageResource<T extends { dispose: () => void }>(resource: T): T {
  stageResources.add(resource)
  return resource
}

function sideColor(side: StageSide): THREE.Color {
  return side === 'blue' ? BLUE : RED
}

function actorPosition(actor: { index: number; side: StageSide }): THREE.Vector3 {
  const direction = actor.side === 'blue' ? -1 : 1
  // Both teams read from the outside toward centre, matching the 2D draft cards.
  const lane = actor.side === 'blue' ? 4 - actor.index : actor.index
  const x = direction * (2.1 + lane * 2.15)
  // The lineups form a shallow chevron: outside picks lead, centre picks recede.
  const z = -3.6 + Math.pow(lane / 4, 1.15) * 2.3
  return new THREE.Vector3(x, 0, z)
}

function resolveChampionIconUrl(card: StagePickCardDescriptor): string | null {
  const path = card.champion?.loadingImg || card.champion?.splashCenteredImg
  return path ? client.getCacheUrl(path) : null
}

function isPickCardActive(card: StagePickCardDescriptor): boolean {
  const team = card.side === 'blue' ? props.blueTeam : props.redTeam
  return !!team?.slots?.[card.index]?.isActive
}

function isCrossOriginHttpAsset(imageUrl: string): boolean {
  try {
    const resolvedUrl = new URL(imageUrl, window.location.href)
    return /^https?:$/.test(resolvedUrl.protocol) && resolvedUrl.origin !== window.location.origin
  } catch {
    return false
  }
}

function getLaneIconImage(imageUrl: string): HTMLImageElement {
  const cached = laneIconImages.get(imageUrl)
  if (cached) return cached

  const image = new Image()
  const markUnavailable = () => {
    unavailableDisplayImages.add(imageUrl)
    drawSpinnerDisplay()
    console.warn(`[ChampionStage3D] Stage image could not be loaded: ${imageUrl}`)
  }
  image.addEventListener('load', () => {
    unavailableDisplayImages.delete(imageUrl)
    drawSpinnerDisplay()
    drawLaneDisplay()
  })
  image.addEventListener('error', markUnavailable)
  laneIconImages.set(imageUrl, image)

  if (isCrossOriginHttpAsset(imageUrl)) {
    // OBS CEF can reuse an earlier non-CORS image response even after the
    // backend asset becomes available. Fetching without the HTTP cache and
    // drawing from a local blob URL keeps CanvasTexture uploads origin-safe.
    void fetch(imageUrl, { cache: 'no-store', credentials: 'omit', mode: 'cors' })
      .then((response) => {
        if (!response.ok) throw new Error(`Image request failed with ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob)
        const releaseObjectUrl = () => URL.revokeObjectURL(objectUrl)
        image.addEventListener('load', releaseObjectUrl, { once: true })
        image.addEventListener('error', releaseObjectUrl, { once: true })
        image.src = objectUrl
      })
      .catch(markUnavailable)
  } else {
    image.src = imageUrl
  }

  return image
}

function createPickCardLaneTexture(card: StagePickCardDescriptor): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)

  const laneIndex = Math.min(card.index, PICK_LANE_ICONS.length - 1)
  const iconUrl = PICK_LANE_ICONS[laneIndex] ?? DEFAULT_LANE_ICON
  const image = getLaneIconImage(iconUrl)
  const paint = () => {
    if (!image.complete || image.naturalWidth === 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    const mask = document.createElement('canvas')
    mask.width = canvas.width
    mask.height = canvas.height
    const maskContext = mask.getContext('2d')
    if (!maskContext) return

    const size = 300
    const x = (canvas.width - size) / 2
    const y = (canvas.height - size) / 2
    maskContext.drawImage(image, x, y, size, size)
    maskContext.globalCompositeOperation = 'source-in'
    maskContext.fillStyle = `#${sideColor(card.side).getHexString()}`
    maskContext.fillRect(0, 0, canvas.width, canvas.height)

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.save()
    context.shadowColor = `#${sideColor(card.side).getHexString()}`
    context.shadowBlur = 36
    context.drawImage(mask, 0, 0)
    context.restore()
    context.drawImage(mask, 0, 0)
    texture.needsUpdate = true
  }

  if (image.complete && image.naturalWidth > 0) paint()
  else image.addEventListener('load', paint, { once: true })
  return texture
}

function createPickCardBorderGeometry(): THREE.TubeGeometry {
  const halfWidth = PICK_CARD_WIDTH / 2
  const halfHeight = PICK_CARD_HEIGHT / 2
  const radius = PICK_CARD_BORDER_RADIUS
  const path = new THREE.CurvePath<THREE.Vector3>()

  path.add(
    new THREE.LineCurve3(
      new THREE.Vector3(-halfWidth + radius, halfHeight, 0),
      new THREE.Vector3(halfWidth - radius, halfHeight, 0),
    ),
  )
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(halfWidth - radius, halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight - radius, 0),
    ),
  )
  path.add(
    new THREE.LineCurve3(
      new THREE.Vector3(halfWidth, halfHeight - radius, 0),
      new THREE.Vector3(halfWidth, -halfHeight + radius, 0),
    ),
  )
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(halfWidth, -halfHeight + radius, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth - radius, -halfHeight, 0),
    ),
  )
  path.add(
    new THREE.LineCurve3(
      new THREE.Vector3(halfWidth - radius, -halfHeight, 0),
      new THREE.Vector3(-halfWidth + radius, -halfHeight, 0),
    ),
  )
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-halfWidth + radius, -halfHeight, 0),
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(-halfWidth, -halfHeight + radius, 0),
    ),
  )
  path.add(
    new THREE.LineCurve3(
      new THREE.Vector3(-halfWidth, -halfHeight + radius, 0),
      new THREE.Vector3(-halfWidth, halfHeight - radius, 0),
    ),
  )
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-halfWidth, halfHeight - radius, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth + radius, halfHeight, 0),
    ),
  )

  return new THREE.TubeGeometry(path, 96, PICK_CARD_BORDER_TUBE_RADIUS, 6, true)
}

function getPickCardAlphaMaskTexture(): THREE.CanvasTexture {
  if (pickCardAlphaMaskTexture) return pickCardAlphaMaskTexture

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 960
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create champion card alpha mask')

  const inset = 8
  const radius = (PICK_CARD_BORDER_RADIUS / PICK_CARD_WIDTH) * canvas.width
  context.fillStyle = '#000000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.beginPath()
  context.roundRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, radius)
  context.fillStyle = '#ffffff'
  context.fill()

  pickCardAlphaMaskTexture = addStageResource(new THREE.CanvasTexture(canvas))
  return pickCardAlphaMaskTexture
}

function setPickCardOpacity(runtime: PickCardRuntime, opacity: number): void {
  const alpha = THREE.MathUtils.clamp(opacity, 0, 1)
  const pulse = prefersReducedMotion ? 0 : Math.sin(runtime.swayElapsed * 3.6) * 0.06
  const spotlightOpacity = alpha * runtime.spotlightMix * (0.72 + pulse)
  runtime.shellMaterial.opacity = alpha
  runtime.auraMaterial.opacity = alpha * 0.12
  runtime.groundMaterial.opacity = alpha * 0.075
  runtime.laneMaterial.opacity = alpha * (1 - runtime.contentMix)
  runtime.championMaterial.opacity = alpha * runtime.contentMix
  runtime.spotlightMaterial.opacity = spotlightOpacity
  runtime.spotlightFloorMaterial.opacity = THREE.MathUtils.clamp(spotlightOpacity * 1.25, 0, 1)
}

function disposePickCard(runtime: PickCardRuntime): void {
  if (runtime.disposed) return
  runtime.disposed = true
  runtime.imageVersion += 1
  runtime.group.removeFromParent()
  runtime.championTexture?.dispose()
  runtime.laneTexture.dispose()
  runtime.materials.forEach((material) => material.dispose())
  runtime.geometries.forEach((geometry) => geometry.dispose())
}

function updatePickCardChampion(
  runtime: PickCardRuntime,
  descriptor: StagePickCardDescriptor,
): void {
  runtime.descriptor = descriptor
  const source = resolveChampionIconUrl(descriptor)
  if (runtime.championSource === source) return

  runtime.championSource = source
  runtime.championReady = false
  runtime.imageVersion += 1
  const version = runtime.imageVersion
  runtime.championTexture?.dispose()
  runtime.championTexture = undefined
  runtime.championMaterial.map = null
  runtime.championMaterial.needsUpdate = true
  if (!source) return

  const texture = new THREE.TextureLoader().load(
    source,
    () => {
      if (runtime.disposed || runtime.imageVersion !== version) {
        texture.dispose()
        return
      }
      runtime.championReady = true
    },
    undefined,
    () => {
      if (runtime.disposed || runtime.imageVersion !== version) return
      runtime.championReady = false
      runtime.championMaterial.map = null
      runtime.championMaterial.needsUpdate = true
      runtime.championTexture = undefined
      texture.dispose()
      console.warn(`[ChampionStage3D] Champion card icon could not be loaded: ${source}`)
    },
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  runtime.championTexture = texture
  runtime.championMaterial.map = texture
  runtime.championMaterial.needsUpdate = true
}

function createPickCardRuntime(
  descriptor: StagePickCardDescriptor,
  animateEntrance: boolean,
): PickCardRuntime {
  const color = sideColor(descriptor.side)
  const group = new THREE.Group()
  group.position.copy(actorPosition(descriptor))

  const pivot = new THREE.Group()
  group.add(pivot)

  const borderGeometry = createPickCardBorderGeometry()
  const iconGeometry = new THREE.PlaneGeometry(0.82, 0.82)
  const championGeometry = new THREE.PlaneGeometry(PICK_CARD_WIDTH - 0.07, PICK_CARD_HEIGHT - 0.07)
  const groundGeometry = new THREE.CircleGeometry(0.72, 32)
  const spotlightGeometry = new THREE.PlaneGeometry(2.9, 10)
  const spotlightFloorGeometry = new THREE.PlaneGeometry(3.8, 5.8)

  const shellMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 3.8,
    metalness: 0.22,
    roughness: 0.24,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const auraMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const laneTexture = createPickCardLaneTexture(descriptor)
  const laneMaterial = new THREE.MeshBasicMaterial({
    map: laneTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const championMaterial = new THREE.MeshBasicMaterial({
    alphaMap: getPickCardAlphaMaskTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  })
  const groundMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.075,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const spotlightMaterial = new THREE.MeshBasicMaterial({
    map: getBanSpotlightTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const spotlightFloorMaterial = new THREE.MeshBasicMaterial({
    map: getBanFloorSpotlightTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })

  const spotlight = new THREE.Mesh(spotlightGeometry, spotlightMaterial)
  spotlight.position.set(0, 5.1, -0.055)
  spotlight.renderOrder = 1
  group.add(spotlight)

  const spotlightFloor = new THREE.Mesh(spotlightFloorGeometry, spotlightFloorMaterial)
  spotlightFloor.rotation.x = -Math.PI / 2
  spotlightFloor.position.set(0, 0.025, 0.25)
  spotlightFloor.renderOrder = 1
  group.add(spotlightFloor)

  const aura = new THREE.Mesh(borderGeometry, auraMaterial)
  aura.position.z = 0.014
  aura.scale.setScalar(1.035)
  aura.renderOrder = 3
  pivot.add(aura)

  const shell = new THREE.Mesh(borderGeometry, shellMaterial)
  shell.position.z = 0.018
  shell.renderOrder = 5
  pivot.add(shell)

  const laneIcon = new THREE.Mesh(iconGeometry, laneMaterial)
  laneIcon.position.z = 0.026
  laneIcon.renderOrder = 6
  pivot.add(laneIcon)

  const championIcon = new THREE.Mesh(championGeometry, championMaterial)
  championIcon.position.z = 0.004
  championIcon.renderOrder = 4
  pivot.add(championIcon)

  const groundGlow = new THREE.Mesh(groundGeometry, groundMaterial)
  groundGlow.rotation.x = -Math.PI / 2
  groundGlow.scale.set(1.3, 0.48, 1)
  groundGlow.position.y = 0.012
  groundGlow.renderOrder = 2
  group.add(groundGlow)

  const runtime: PickCardRuntime = {
    auraMaterial,
    championMaterial,
    championReady: false,
    championSource: null,
    contentMix: 0,
    descriptor,
    disposed: false,
    entranceElapsed: animateEntrance ? 0 : PICK_CARD_ENTRANCE_DURATION_SECONDS,
    geometries: [
      borderGeometry,
      iconGeometry,
      championGeometry,
      groundGeometry,
      spotlightGeometry,
      spotlightFloorGeometry,
    ],
    groundMaterial,
    group,
    imageVersion: 0,
    laneMaterial,
    laneTexture,
    materials: [
      shellMaterial,
      auraMaterial,
      laneMaterial,
      championMaterial,
      groundMaterial,
      spotlightMaterial,
      spotlightFloorMaterial,
    ],
    pivot,
    shellMaterial,
    spotlightFloorMaterial,
    spotlightMaterial,
    spotlightMix: isPickCardActive(descriptor) ? 1 : 0,
    swayElapsed: 0,
    swayPhase: Math.random() * Math.PI * 2,
  }
  updatePickCardChampion(runtime, descriptor)
  setPickCardOpacity(runtime, animateEntrance ? 0 : 1)
  return runtime
}

function syncPickCards(animateNewCards: boolean): void {
  if (!scene || !stageReady) return
  const pendingActorKeys = new Set(
    [...actorRuntimes.entries()].filter(([, runtime]) => !runtime.modelInstance).map(([key]) => key),
  )
  const desiredCards = collectStagePickCards(props.blueTeam, props.redTeam, pendingActorKeys)
  const desired = new Map(desiredCards.map((card) => [card.key, card]))

  desired.forEach((descriptor, key) => {
    const existing = pickCardRuntimes.get(key)
    if (existing) {
      existing.exitingElapsed = undefined
      updatePickCardChampion(existing, descriptor)
      return
    }

    const runtime = createPickCardRuntime(descriptor, animateNewCards && !prefersReducedMotion)
    pickCardRuntimes.set(key, runtime)
    scene?.add(runtime.group)
  })

  pickCardRuntimes.forEach((runtime, key) => {
    if (!desired.has(key) && runtime.exitingElapsed === undefined) runtime.exitingElapsed = 0
  })
}

function updatePickCard(runtime: PickCardRuntime, delta: number): boolean {
  runtime.swayElapsed += delta
  const targetContent = runtime.championReady && runtime.descriptor.champion ? 1 : 0
  const contentResponse = 1 - Math.exp(-delta * PICK_CARD_CONTENT_RESPONSE)
  runtime.contentMix = THREE.MathUtils.lerp(runtime.contentMix, targetContent, contentResponse)
  const targetSpotlight = isPickCardActive(runtime.descriptor) ? 1 : 0
  const spotlightResponse = 1 - Math.exp(-delta * PICK_CARD_SPOTLIGHT_RESPONSE)
  runtime.spotlightMix = prefersReducedMotion
    ? targetSpotlight
    : THREE.MathUtils.lerp(runtime.spotlightMix, targetSpotlight, spotlightResponse)

  if (prefersReducedMotion) {
    runtime.entranceElapsed = PICK_CARD_ENTRANCE_DURATION_SECONDS
    runtime.pivot.position.y = PICK_CARD_TARGET_Y
    runtime.pivot.rotation.set(0, 0, 0)
  } else {
    runtime.entranceElapsed = Math.min(
      runtime.entranceElapsed + delta,
      PICK_CARD_ENTRANCE_DURATION_SECONDS,
    )
    const progress = runtime.entranceElapsed / PICK_CARD_ENTRANCE_DURATION_SECONDS
    const rise = 1 - Math.pow(1 - progress, 3)
    const settle = 1 + 1.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2)
    const inward = runtime.descriptor.side === 'blue' ? 1 : -1
    const baseYaw = inward * THREE.MathUtils.degToRad(4.5)
    const swayStrength = rise
    const swayY =
      Math.sin(runtime.swayElapsed * 1.04 + runtime.swayPhase) *
      THREE.MathUtils.degToRad(2.15) *
      swayStrength
    const swayZ =
      Math.sin(runtime.swayElapsed * 0.81 + runtime.swayPhase * 0.71) *
      THREE.MathUtils.degToRad(1.65) *
      swayStrength
    const swayX =
      Math.sin(runtime.swayElapsed * 0.67 + runtime.swayPhase * 0.39) *
      THREE.MathUtils.degToRad(0.65) *
      swayStrength

    runtime.pivot.position.y = THREE.MathUtils.lerp(
      -PICK_CARD_HEIGHT * 0.52,
      PICK_CARD_TARGET_Y,
      settle,
    )
    runtime.pivot.rotation.x = THREE.MathUtils.lerp(-THREE.MathUtils.degToRad(78), swayX, rise)
    runtime.pivot.rotation.y = THREE.MathUtils.lerp(
      baseYaw + inward * THREE.MathUtils.degToRad(68),
      baseYaw + swayY,
      rise,
    )
    runtime.pivot.rotation.z = THREE.MathUtils.lerp(
      -inward * THREE.MathUtils.degToRad(10),
      swayZ,
      rise,
    )
  }

  let opacity = prefersReducedMotion
    ? 1
    : THREE.MathUtils.clamp(
        runtime.entranceElapsed / Math.max(PICK_CARD_ENTRANCE_DURATION_SECONDS * 0.45, 0.001),
        0,
        1,
      )
  if (runtime.exitingElapsed !== undefined) {
    runtime.exitingElapsed = Math.min(
      runtime.exitingElapsed + delta,
      PICK_CARD_EXIT_DURATION_SECONDS,
    )
    const exitProgress = runtime.exitingElapsed / PICK_CARD_EXIT_DURATION_SECONDS
    opacity *= Math.pow(1 - exitProgress, 2)
    runtime.pivot.position.y += exitProgress * 0.12
    runtime.pivot.scale.setScalar(1 + exitProgress * 0.025)
    if (exitProgress >= 1) return true
  } else {
    runtime.pivot.scale.setScalar(1)
  }

  setPickCardOpacity(runtime, opacity)
  return false
}

function drawSpinnerDisplay(): void {
  const texture = spinnerDisplayTexture
  const canvas = texture?.image
  if (!texture || !(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  texture.needsUpdate = true

  const logoUrl = props.eventLogoUrl?.trim()
  if (logoUrl && !unavailableDisplayImages.has(logoUrl)) {
    const image = getLaneIconImage(logoUrl)
    if (!image.complete) return
    if (image.naturalWidth > 0) {
      const maxWidth = canvas.width * 0.76
      const maxHeight = canvas.height * 0.76
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const x = (canvas.width - width) / 2
      const y = (canvas.height - height) / 2

      context.save()
      context.shadowColor = 'rgba(255, 255, 255, 0.28)'
      context.shadowBlur = 22
      context.drawImage(image, x, y, width, height)
      context.restore()
      texture.needsUpdate = true
      return
    }
  }

  const eventName = props.eventName?.trim()
  if (!eventName) return
  context.save()
  context.fillStyle = 'rgba(255, 255, 255, 0.88)'
  context.font = '900 68px "Bebas Neue", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const maxWidth = canvas.width * 0.76
  let displayName = eventName.toUpperCase()
  while (displayName.length > 3 && context.measureText(displayName).width > maxWidth) {
    displayName = `${displayName.slice(0, -2).trimEnd()}…`
  }
  context.fillText(displayName, canvas.width / 2, canvas.height / 2, maxWidth)
  context.restore()
  texture.needsUpdate = true
}

function createSpinnerDisplayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 768
  const texture = addStageResource(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  spinnerDisplayTexture = texture
  drawSpinnerDisplay()
  return texture
}

function drawLaneDisplay(): void {
  const texture = laneDisplayTexture
  const canvas = texture?.image
  if (!texture || !(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  texture.needsUpdate = true

  if (activeBan.value) return
  const active = activePickLane.value
  if (!active) return
  const image = getLaneIconImage(active.iconUrl)
  if (!image.complete || image.naturalWidth === 0) return

  const size = 360
  const x = (canvas.width - size) / 2
  const y = (canvas.height - size) / 2
  const color = `#${sideColor(active.side).getHexString()}`

  context.save()
  context.shadowColor = color
  context.shadowBlur = 24
  context.drawImage(image, x, y, size, size)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = color
  context.fillRect(x - 32, y - 32, size + 64, size + 64)
  context.restore()
  texture.needsUpdate = true
}

function createLaneDisplayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const texture = addStageResource(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  laneDisplayTexture = texture
  drawLaneDisplay()
  return texture
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  baselineY: number,
  tracking: number,
): void {
  const widths = [...text].map((character) => context.measureText(character).width)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + tracking * (text.length - 1)
  let x = centerX - totalWidth / 2
  ;[...text].forEach((character, index) => {
    context.fillText(character, x, baselineY)
    x += (widths[index] ?? 0) + tracking
  })
}

function drawBanStatusDisplay(): void {
  const texture = banStatusDisplayTexture
  const canvas = texture?.image
  if (!texture || !(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  const active = activeBan.value
  if (!active) {
    texture.needsUpdate = true
    return
  }

  const color = `#${sideColor(active.side).getHexString()}`
  context.save()
  context.font = '800 112px "Bebas Neue", sans-serif'
  context.textBaseline = 'middle'
  context.fillStyle = '#f6f7f9'
  context.shadowColor = color
  context.shadowBlur = 22
  drawTrackedText(context, 'BANNING', canvas.width / 2, canvas.height / 2 - 8, 11)
  context.restore()

  const lineWidth = 390
  const lineX = (canvas.width - lineWidth) / 2
  const gradient = context.createLinearGradient(lineX, 0, lineX + lineWidth, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.5, color)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(lineX, canvas.height / 2 + 58, lineWidth, 3)
  texture.needsUpdate = true
}

function createBanStatusDisplayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const texture = addStageResource(new THREE.CanvasTexture(canvas))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  banStatusDisplayTexture = texture
  drawBanStatusDisplay()
  void document.fonts.load('800 112px "Bebas Neue"').then(drawBanStatusDisplay)
  return texture
}

function triggerChakramSpin(directions: readonly number[]): void {
  if (prefersReducedMotion || directions.length === 0) return
  queuedChakramSpinDirections.push(...directions.map((direction) => Math.sign(direction) || 1))
  if (chakramSpinElapsed === undefined) {
    chakramSpinDirection = queuedChakramSpinDirections.shift() ?? 1
    chakramSpinElapsed = 0
  }
}

function chakramSpinProgress(progress: number): number {
  const t = THREE.MathUtils.clamp(progress, 0, 1)
  const ramp = CHAKRAM_SPIN_RAMP_RATIO
  const peakVelocity = 1 / (1 - ramp)

  if (t < ramp) return (peakVelocity * t * t) / (2 * ramp)
  if (t <= 1 - ramp) return peakVelocity * (t - ramp / 2)

  const remaining = 1 - t
  return 1 - (peakVelocity * remaining * remaining) / (2 * ramp)
}

function updateChakramSpin(delta: number): void {
  if (!spinnerDisplayMesh || chakramSpinElapsed === undefined) return
  chakramSpinElapsed = Math.min(chakramSpinElapsed + delta, CHAKRAM_SPIN_DURATION_SECONDS)

  const progress = chakramSpinProgress(chakramSpinElapsed / CHAKRAM_SPIN_DURATION_SECONDS)
  spinnerDisplayMesh.rotation.z = chakramSpinDirection * progress * CHAKRAM_SPIN_TURNS * Math.PI * 2

  if (chakramSpinElapsed >= CHAKRAM_SPIN_DURATION_SECONDS) {
    spinnerDisplayMesh.rotation.z = 0
    const nextDirection = queuedChakramSpinDirections.shift()
    if (nextDirection !== undefined) {
      chakramSpinDirection = nextDirection
      chakramSpinElapsed = 0
    } else {
      chakramSpinElapsed = undefined
    }
    return
  }
}

function resolveBanIconUrl(ban: StageBanWallDescriptor): string | null {
  const path = ban.champion.loadingImg || ban.champion.splashCenteredImg
  return path ? client.getCacheUrl(path) : null
}

function createFallbackChampionTexture(alias: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 384
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#2a2d36')
    gradient.addColorStop(1, '#0b0d12')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(255, 255, 255, 0.58)'
    context.font = '700 72px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(alias.slice(0, 2).toUpperCase(), canvas.width / 2, canvas.height / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createBanTexture(descriptor: StageBanWallDescriptor): THREE.Texture {
  const source = resolveBanIconUrl(descriptor)
  if (!source) return createFallbackChampionTexture(descriptor.champion.alias)

  const texture = new THREE.TextureLoader().load(source, undefined, undefined, () => {
    console.warn(`[ChampionStage3D] Ban portrait could not be loaded: ${source}`)
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  return texture
}

function drawBanNameTexture(texture: THREE.CanvasTexture, rawName: string): void {
  const canvas = texture.image
  if (!(canvas instanceof HTMLCanvasElement)) return
  const context = canvas.getContext('2d')
  if (!context) return

  const name = rawName.trim().toLocaleUpperCase()
  const maxWidth = canvas.width - 72
  let fontSize = 160
  const minFontSize = 72

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.font = `800 ${fontSize}px "Bebas Neue", sans-serif`
  while (fontSize > minFontSize && context.measureText(name).width > maxWidth) {
    fontSize -= 2
    context.font = `800 ${fontSize}px "Bebas Neue", sans-serif`
  }

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.shadowColor = 'rgba(0, 0, 0, 0.9)'
  context.shadowBlur = 14
  context.fillText(name, canvas.width / 2, canvas.height / 2, maxWidth)
  texture.needsUpdate = true
}

function createBanNameTexture(descriptor: StageBanWallDescriptor): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  drawBanNameTexture(texture, descriptor.champion.name || descriptor.champion.alias)
  return texture
}

function createChampionBillboardMaterial(
  texture: THREE.Texture | null,
  saturation: number,
  brightness: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      opacity: { value: 1 },
      saturation: { value: saturation },
      brightness: { value: brightness },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float saturation;
      uniform float brightness;
      varying vec2 vUv;
      void main() {
        vec4 sampled = texture2D(map, vUv);
        float luminance = dot(sampled.rgb, vec3(0.299, 0.587, 0.114));
        vec3 color = mix(vec3(luminance), sampled.rgb, saturation) * brightness;
        gl_FragColor = vec4(color, sampled.a * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  })
  material.toneMapped = false
  return material
}

function setBillboardOpacity(material: THREE.ShaderMaterial, opacity: number): void {
  material.uniforms.opacity!.value = THREE.MathUtils.clamp(opacity, 0, 1)
}

function getBanSpotlightTexture(): THREE.CanvasTexture {
  if (banSpotlightTexture) return banSpotlightTexture

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create ban spotlight texture')

  const beam = context.createLinearGradient(0, 0, 0, canvas.height)
  beam.addColorStop(0, 'rgba(255,255,255,0)')
  beam.addColorStop(0.24, 'rgba(255,255,255,0.16)')
  beam.addColorStop(0.72, 'rgba(255,255,255,0.08)')
  beam.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = beam
  context.beginPath()
  context.moveTo(canvas.width * 0.4, 0)
  context.lineTo(canvas.width * 0.6, 0)
  context.lineTo(canvas.width * 0.94, canvas.height)
  context.lineTo(canvas.width * 0.06, canvas.height)
  context.closePath()
  context.fill()

  const focus = context.createRadialGradient(256, 390, 12, 256, 390, 235)
  focus.addColorStop(0, 'rgba(255,255,255,0.88)')
  focus.addColorStop(0.28, 'rgba(255,255,255,0.42)')
  focus.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = focus
  context.fillRect(0, 0, canvas.width, canvas.height)

  banSpotlightTexture = addStageResource(new THREE.CanvasTexture(canvas))
  return banSpotlightTexture
}

function getBanFloorSpotlightTexture(): THREE.CanvasTexture {
  if (banFloorSpotlightTexture) return banFloorSpotlightTexture

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create ban floor spotlight texture')

  const pool = context.createRadialGradient(256, 256, 12, 256, 256, 245)
  pool.addColorStop(0, 'rgba(255,255,255,0.92)')
  pool.addColorStop(0.24, 'rgba(255,255,255,0.56)')
  pool.addColorStop(0.58, 'rgba(255,255,255,0.2)')
  pool.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = pool
  context.fillRect(0, 0, canvas.width, canvas.height)

  banFloorSpotlightTexture = addStageResource(new THREE.CanvasTexture(canvas))
  return banFloorSpotlightTexture
}

function setBanWallVisual(
  runtime: BanWallRuntime,
  saturation: number,
  brightness: number,
  opacity: number,
  spotlightOpacity: number,
): void {
  runtime.material.uniforms.saturation!.value = saturation
  runtime.material.uniforms.brightness!.value = brightness
  setBillboardOpacity(runtime.material, opacity)
  runtime.spotlightMaterial.opacity = spotlightOpacity
  runtime.spotlightFloorMaterial.opacity = THREE.MathUtils.clamp(spotlightOpacity * 1.35, 0, 1)
}

function setBanWallSettled(runtime: BanWallRuntime): void {
  runtime.lockTransitionElapsed = undefined
  setBanWallVisual(runtime, 0, 0.68, 0.84, 0)
}

function setBanWallActive(runtime: BanWallRuntime): void {
  runtime.lockTransitionElapsed = undefined
  setBanWallVisual(runtime, 1, 1, 0.96, 0.78)
}

function createBanWallRuntime(descriptor: StageBanWallDescriptor): BanWallRuntime | null {
  const parent = banWallParents.get(descriptor.side)
  if (!parent) return null

  const texture = createBanTexture(descriptor)
  const geometry = new THREE.PlaneGeometry(1.92, 3.62)
  const material = createChampionBillboardMaterial(texture, descriptor.active ? 1 : 0, 1)
  const mesh = new THREE.Mesh(geometry, material)
  const direction = descriptor.side === 'blue' ? -1 : 1
  const wallBayIndex = PICK_LANES.length - 1 - Math.min(descriptor.index, PICK_LANES.length - 1)
  const wallX = direction * (1.3 + wallBayIndex * 2.48)
  mesh.position.set(wallX, 5.67, 0.315)
  mesh.renderOrder = 2

  const nameTexture = createBanNameTexture(descriptor)
  const nameGeometry = new THREE.PlaneGeometry(BAN_WALL_NAME_WIDTH, BAN_WALL_NAME_HEIGHT)
  const nameMaterial = new THREE.MeshBasicMaterial({
    map: nameTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const nameMesh = new THREE.Mesh(nameGeometry, nameMaterial)
  nameMesh.position.set(wallX, BAN_WALL_NAME_Y, 0.335)
  nameMesh.renderOrder = 4

  const spotlightGeometry = new THREE.PlaneGeometry(3, 10)
  const spotlightMaterial = new THREE.MeshBasicMaterial({
    map: getBanSpotlightTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const spotlightMesh = new THREE.Mesh(spotlightGeometry, spotlightMaterial)
  spotlightMesh.position.set(wallX, 5.2, 0.325)
  spotlightMesh.renderOrder = 3

  const spotlightFloorGeometry = new THREE.PlaneGeometry(4.2, 7.2)
  const spotlightFloorMaterial = new THREE.MeshBasicMaterial({
    map: getBanFloorSpotlightTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const spotlightFloorMesh = new THREE.Mesh(spotlightFloorGeometry, spotlightFloorMaterial)
  spotlightFloorMesh.rotation.x = -Math.PI / 2
  spotlightFloorMesh.position.set(wallX, 0.045, 3.25)
  spotlightFloorMesh.renderOrder = 3
  parent.add(spotlightFloorMesh)
  parent.add(spotlightMesh)
  parent.add(mesh)
  parent.add(nameMesh)

  const runtime: BanWallRuntime = {
    activeElapsed: 0,
    descriptor,
    disposed: false,
    geometry,
    material,
    mesh,
    nameGeometry,
    nameMaterial,
    nameMesh,
    nameTexture,
    spotlightFloorGeometry,
    spotlightFloorMaterial,
    spotlightFloorMesh,
    spotlightGeometry,
    spotlightMaterial,
    spotlightMesh,
    texture,
  }
  if (descriptor.active) setBanWallActive(runtime)
  else setBanWallSettled(runtime)
  return runtime
}

function disposeBanWall(runtime: BanWallRuntime): void {
  if (runtime.disposed) return
  runtime.disposed = true
  runtime.mesh.removeFromParent()
  runtime.nameMesh.removeFromParent()
  runtime.spotlightFloorMesh.removeFromParent()
  runtime.spotlightMesh.removeFromParent()
  runtime.geometry.dispose()
  runtime.material.dispose()
  runtime.nameGeometry.dispose()
  runtime.nameMaterial.dispose()
  runtime.nameTexture.dispose()
  runtime.spotlightFloorGeometry.dispose()
  runtime.spotlightFloorMaterial.dispose()
  runtime.spotlightGeometry.dispose()
  runtime.spotlightMaterial.dispose()
  runtime.texture.dispose()
}

function updateBanWall(runtime: BanWallRuntime, delta: number): void {
  if (runtime.disposed) return
  runtime.activeElapsed += delta

  if (runtime.descriptor.active) {
    const pulse = prefersReducedMotion ? 0 : Math.sin(runtime.activeElapsed * 3.6) * 0.07
    setBanWallVisual(runtime, 1, 1, 0.96, 0.78 + pulse)
    return
  }

  const elapsed = runtime.lockTransitionElapsed
  if (elapsed === undefined) return
  runtime.lockTransitionElapsed = Math.min(elapsed + delta, BAN_WALL_LOCK_DURATION_SECONDS)
  const progress = runtime.lockTransitionElapsed / BAN_WALL_LOCK_DURATION_SECONDS
  const eased = progress * progress * (3 - 2 * progress)
  setBanWallVisual(
    runtime,
    1 - eased,
    THREE.MathUtils.lerp(1, 0.68, eased),
    THREE.MathUtils.lerp(0.96, 0.84, eased),
    0.78 * Math.pow(1 - eased, 2),
  )
  if (progress >= 1) setBanWallSettled(runtime)
}

function syncBanWalls(animateNewBans: boolean): void {
  if (!stageReady) return
  const desired = new Map(banWallDescriptors.value.map((ban) => [ban.key, ban]))

  for (const [key, runtime] of banWallRuntimes) {
    const descriptor = desired.get(key)
    const currentArt =
      runtime.descriptor.champion.loadingImg || runtime.descriptor.champion.splashCenteredImg
    const desiredArt = descriptor?.champion.loadingImg || descriptor?.champion.splashCenteredImg
    const sameChampion =
      descriptor &&
      descriptor.champion.alias === runtime.descriptor.champion.alias &&
      desiredArt === currentArt
    if (descriptor && sameChampion) {
      const wasActive = runtime.descriptor.active
      runtime.descriptor = descriptor
      if (!wasActive && descriptor.active) setBanWallActive(runtime)
      if (wasActive && !descriptor.active) {
        if (animateNewBans && !prefersReducedMotion) runtime.lockTransitionElapsed = 0
        else setBanWallSettled(runtime)
      }
      desired.delete(key)
      continue
    }
    disposeBanWall(runtime)
    banWallRuntimes.delete(key)
  }

  desired.forEach((descriptor, key) => {
    const runtime = createBanWallRuntime(descriptor)
    if (!runtime) return
    banWallRuntimes.set(key, runtime)
  })
}

function fittedFloorText(
  context: CanvasRenderingContext2D,
  rawText: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
): { fontSize: number; text: string } {
  let text = rawText.toLocaleUpperCase()
  let fontSize = maxFontSize
  const setFont = () => {
    context.font = `900 ${fontSize}px "Bebas Neue"`
  }

  setFont()
  while (fontSize > minFontSize && context.measureText(text).width > maxWidth) {
    fontSize -= 2
    setFont()
  }

  if (context.measureText(text).width <= maxWidth) return { fontSize, text }

  const ellipsis = '…'
  while (text.length > 1 && context.measureText(`${text}${ellipsis}`).width > maxWidth) {
    text = text.slice(0, -1)
  }
  return { fontSize, text: `${text.trimEnd()}${ellipsis}` }
}

function createTeamNameTexture(identity: StageTeamIdentityDescriptor): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create team-name floor texture')

  const color = `#${sideColor(identity.side).getHexString()}`
  const fitted = fittedFloorText(context, identity.name, canvas.width - 100, 176, 76)
  context.font = `900 ${fitted.fontSize}px "Bebas Neue"`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(247, 248, 251, 0.96)'
  context.shadowColor = color
  context.shadowBlur = 20
  context.fillText(fitted.text, canvas.width / 2, 126)

  const lineWidth = canvas.width * 0.62
  const lineX = (canvas.width - lineWidth) / 2
  const accent = context.createLinearGradient(lineX, 0, lineX + lineWidth, 0)
  accent.addColorStop(0, 'rgba(255, 255, 255, 0)')
  accent.addColorStop(0.5, color)
  accent.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.shadowBlur = 0
  context.fillStyle = accent
  context.fillRect(lineX, 224, lineWidth, 5)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  return texture
}

function createTeamScoreTexture(identity: StageTeamIdentityDescriptor): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create team-score floor texture')

  const color = `#${sideColor(identity.side).getHexString()}`
  const score = fittedFloorText(context, String(identity.score), canvas.width - 56, 330, 210)
  context.font = `900 ${score.fontSize}px "Bebas Neue"`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 5
  context.strokeStyle = color
  context.shadowColor = color
  context.shadowBlur = 28
  context.strokeText(score.text, canvas.width / 2, 256)
  context.fillStyle = 'rgba(247, 248, 251, 0.98)'
  context.fillText(score.text, canvas.width / 2, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)
  return texture
}

function createFloorTextMesh(
  texture: THREE.CanvasTexture,
  width: number,
  height: number,
  x: number,
  z: number,
): { geometry: THREE.PlaneGeometry; material: THREE.MeshBasicMaterial; mesh: THREE.Mesh } {
  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, 0.055, z)
  mesh.renderOrder = 3
  return { geometry, material, mesh }
}

function disposeTeamIdentityText(side: StageSide): void {
  const runtime = teamIdentityTextRuntimes.get(side)
  if (!runtime) return
  runtime.group.removeFromParent()
  runtime.geometries.forEach((geometry) => geometry.dispose())
  runtime.materials.forEach((material) => material.dispose())
  runtime.textures.forEach((texture) => texture.dispose())
  teamIdentityTextRuntimes.delete(side)
}

function syncTeamIdentityText(): void {
  if (!scene || !stageReady) return
  disposeTeamIdentityText('blue')
  disposeTeamIdentityText('red')

  teamIdentityDescriptors.value.forEach((identity) => {
    const direction = identity.side === 'blue' ? -1 : 1
    const nameTexture = createTeamNameTexture(identity)
    const scoreTexture = createTeamScoreTexture(identity)
    const name = createFloorTextMesh(
      nameTexture,
      TEAM_NAME_WIDTH,
      TEAM_NAME_HEIGHT,
      direction * TEAM_LOGO_X,
      TEAM_NAME_Z,
    )
    const score = createFloorTextMesh(
      scoreTexture,
      TEAM_SCORE_SIZE,
      TEAM_SCORE_SIZE,
      direction * TEAM_SCORE_X,
      TEAM_SCORE_Z,
    )
    const group = new THREE.Group()
    group.add(name.mesh, score.mesh)
    scene?.add(group)
    teamIdentityTextRuntimes.set(identity.side, {
      geometries: [name.geometry, score.geometry],
      group,
      materials: [name.material, score.material],
      textures: [nameTexture, scoreTexture],
    })
  })
}

function disposeTeamLogo(side: StageSide): void {
  const runtime = teamLogoRuntimes.get(side)
  if (!runtime) return
  runtime.mesh.removeFromParent()
  runtime.geometry.dispose()
  runtime.material.dispose()
  runtime.texture.dispose()
  teamLogoRuntimes.delete(side)
}

async function syncTeamLogos(): Promise<void> {
  if (!scene || !stageReady) return
  const version = ++teamLogoSyncVersion
  const sources: Array<[StageSide, string | null]> = [
    ['blue', resolveTeamLogoUrl(props.blueTeam?.metaData?.iconUri)],
    ['red', resolveTeamLogoUrl(props.redTeam?.metaData?.iconUri)],
  ]

  await Promise.all(
    sources.map(async ([side, source]) => {
      const existing = teamLogoRuntimes.get(side)
      if (existing?.source === source) return
      disposeTeamLogo(side)
      if (!source) return

      try {
        const texture = await new THREE.TextureLoader().loadAsync(source)
        if (!stageReady || version !== teamLogoSyncVersion || !scene) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() ?? 1, 8)

        const image = texture.image as { naturalHeight?: number; naturalWidth?: number }
        const aspect = (image.naturalWidth ?? 1) / Math.max(image.naturalHeight ?? 1, 1)
        const maxSize = 4.6
        const width = aspect >= 1 ? maxSize : maxSize * aspect
        const height = aspect >= 1 ? maxSize / aspect : maxSize
        const geometry = new THREE.PlaneGeometry(width, height)
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.025,
          depthWrite: false,
          toneMapped: false,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(side === 'blue' ? -TEAM_LOGO_X : TEAM_LOGO_X, 0.045, TEAM_LOGO_Z)
        mesh.renderOrder = 2
        scene.add(mesh)
        teamLogoRuntimes.set(side, { geometry, material, mesh, source, texture })
      } catch (error) {
        console.warn(`[ChampionStage3D] ${side} team logo could not be loaded`, error)
      }
    }),
  )
}

function createActorRuntime(
  descriptor: StageChampionActor,
  entrancePending: boolean,
): ActorRuntime {
  const group = new THREE.Group()
  group.position.copy(actorPosition(descriptor))

  const runtime: ActorRuntime = {
    descriptor,
    entrancePending,
    group,
    disposed: false,
  }
  return runtime
}

function moveActorRuntime(runtime: ActorRuntime, descriptor: StageChampionActor): void {
  const target = actorPosition(descriptor)
  runtime.descriptor = descriptor
  if (runtime.positionMove && runtime.positionMove.target.distanceToSquared(target) < 0.000001) {
    return
  }
  if (runtime.group.position.distanceToSquared(target) < 0.000001) {
    runtime.group.position.copy(target)
    runtime.positionMove = undefined
    return
  }

  runtime.positionMove = {
    duration: ACTOR_SWAP_DURATION_SECONDS,
    elapsed: 0,
    start: runtime.group.position.clone(),
    target,
  }
}

function disposeActor(runtime: ActorRuntime): void {
  runtime.disposed = true
  runtime.playback?.dispose()
  if (runtime.modelInstance) {
    if (modelRuntime) modelRuntime.release(runtime.modelInstance)
    else disposeChampionModelInstance(runtime.modelInstance)
  }
  runtime.group.removeFromParent()
}

function isModelAliasRelevant(alias: string): boolean {
  return (
    activeModelAliases.value.includes(alias) ||
    actorDescriptors.value.some((actor) => actor.alias === alias)
  )
}

function isModelAliasPersistent(alias: string): boolean {
  return actorDescriptors.value.some((actor) => actor.alias === alias)
}

function updateActorPosition(runtime: ActorRuntime, delta: number): void {
  const move = runtime.positionMove
  if (!move) return

  move.elapsed = Math.min(move.elapsed + delta, move.duration)
  const progress = move.elapsed / move.duration
  const eased =
    progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2
  runtime.group.position.lerpVectors(move.start, move.target, eased)

  if (progress >= 1) {
    runtime.group.position.copy(move.target)
    runtime.positionMove = undefined
  }
}

function scheduleActiveModelPreload(): void {
  if (modelPreloadTimer !== undefined) window.clearTimeout(modelPreloadTimer)
  modelPreloadTimer = undefined
  modelRuntime?.prune()
  const aliases = [...activeModelAliases.value]
  if (!stageReady || !modelRuntime || aliases.length === 0) return

  // A stable hover is the earliest useful signal for a likely pick. Prepare the
  // exact clone all the way through its color and shadow GPU passes now, while a
  // short debounce still filters out cursor-only hover spam.
  modelPreloadTimer = window.setTimeout(() => {
    modelPreloadTimer = undefined
    aliases.forEach((alias) => {
      if (activeModelAliases.value.includes(alias)) void modelRuntime?.prepare(alias)
    })
  }, MODEL_PRELOAD_DEBOUNCE_MS)
}

async function hydrateActor(runtime: ActorRuntime): Promise<void> {
  const models = modelRuntime
  if (!models) return
  const alias = runtime.descriptor.alias
  let prepared: ChampionModelInstance | null = await models.prepare(alias)
  if (!prepared) {
    // The actor and card watchers can be queued in either order for the same
    // lock snapshot. Re-sync after an unavailable model settles so a card that
    // briefly started exiting is restored as the permanent fallback.
    if (!runtime.disposed && stageReady) syncPickCards(false)
    return
  }
  if (runtime.disposed || !stageReady) {
    models.release(prepared)
    return
  }

  // A duplicate same-alias actor must never reparent the first actor's exact
  // clone. Claim atomically; a losing claimant prepares another instance while
  // reusing the renderer programs and shared source geometry/textures.
  if (!models.claim(prepared)) {
    prepared = await models.prepare(alias)
    if (!prepared) {
      if (!runtime.disposed && stageReady) syncPickCards(false)
      return
    }
    if (runtime.disposed || !stageReady) {
      models.release(prepared)
      return
    }
    if (!models.claim(prepared)) {
      syncPickCards(false)
      return
    }
  }
  runtime.modelInstance = prepared
  runtime.group.add(prepared.model)
  runtime.playback = playChampionModelAnimation(prepared, runtime.entrancePending)
  runtime.entrancePending = false
  // The physical card is the readiness placeholder. Retire it only after the
  // fully warmed model has been attached, producing a clean overlap/crossfade.
  syncPickCards(false)
}

function syncDraftActors(animateNewLocks: boolean): void {
  if (!scene || !stageReady) return
  const desired = new Map(actorDescriptors.value.map((actor) => [actor.key, actor]))
  const reconciliation = planStageActorReconciliation(
    [...actorRuntimes.values()].map((runtime) => runtime.descriptor),
    [...desired.values()],
  )
  const nextRuntimes = new Map<string, ActorRuntime>()

  for (const assignment of reconciliation.assignments) {
    const runtime = actorRuntimes.get(assignment.currentKey)
    const descriptor = desired.get(assignment.desiredKey)
    if (!runtime || !descriptor) continue
    moveActorRuntime(runtime, descriptor)
    nextRuntimes.set(descriptor.key, runtime)
  }

  for (const key of reconciliation.removedKeys) {
    const runtime = actorRuntimes.get(key)
    if (runtime) disposeActor(runtime)
  }

  for (const key of reconciliation.addedKeys) {
    const descriptor = desired.get(key)
    if (!descriptor) continue
    const runtime = createActorRuntime(descriptor, animateNewLocks)
    nextRuntimes.set(descriptor.key, runtime)
    scene.add(runtime.group)
    void hydrateActor(runtime)
  }

  actorRuntimes.clear()
  nextRuntimes.forEach((runtime, key) => actorRuntimes.set(key, runtime))
}

function handleResize(): void {
  if (!container.value || !camera || !renderer) return
  const width = Math.max(container.value.clientWidth, 1)
  const height = Math.max(container.value.clientHeight, 1)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  prefersReducedMotion = event.matches
  cameraController?.setReducedMotion(event.matches)
  if (!event.matches) return
  chakramSpinElapsed = undefined
  queuedChakramSpinDirections.splice(0)
  if (spinnerDisplayMesh) spinnerDisplayMesh.rotation.z = 0
}

function beginExit(): void {
  if (!cameraController) {
    cameraExitRequested = true
    return
  }
  cameraExitRequested = false
  cameraController.beginExit()
}

defineExpose({ beginExit })
function renderFrame(): void {
  if (!renderer || !scene || !camera) return
  timer.update()
  const delta = Math.min(timer.getDelta(), 0.05)
  actorRuntimes.forEach((runtime) => {
    runtime.playback?.update(delta)
    updateActorPosition(runtime, delta)
  })
  pickCardRuntimes.forEach((runtime, key) => {
    if (!updatePickCard(runtime, delta)) return
    disposePickCard(runtime)
    pickCardRuntimes.delete(key)
  })
  banWallRuntimes.forEach((runtime) => updateBanWall(runtime, delta))
  updateChakramSpin(delta)
  cameraController?.update(delta)
  renderer.render(scene, camera)
}

function initializeStage(): void {
  if (!container.value) return

  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = reducedMotionQuery.matches
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    console.warn('[ChampionStage3D] WebGL is unavailable; keeping the 2D draft UI', error)
    return
  }

  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.className = 'champion-stage-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  scene.fog = new THREE.FogExp2(0x000000, 0.014)

  camera = new THREE.PerspectiveCamera(CAMERA_FINAL_FOV, 16 / 9, 0.1, 90)
  cameraController = new ChampionStageCameraController(camera, {
    activeSide: () => cameraActiveSide.value,
    prefersReducedMotion,
  })
  timer.connect(document)

  const studio = createChampionStageStudio({
    renderer,
    scene,
    textures: {
      banStatus: createBanStatusDisplayTexture(),
      lane: createLaneDisplayTexture(),
      spinner: createSpinnerDisplayTexture(),
    },
    trackResource: addStageResource,
  })
  spinnerDisplayMesh = studio.spinnerDisplay
  laneDisplayMesh = studio.laneDisplay
  banStatusDisplayMesh = studio.banStatusDisplay
  studio.banWallParents.forEach((parent, side) => banWallParents.set(side, parent))
  addChampionStageLighting(scene)
  const initializedRenderer = renderer
  const initializedScene = scene
  const initializedCamera = camera
  modelRuntime = createChampionModelRuntime({
    apiBase,
    camera: initializedCamera,
    configureModel: (model) => {
      model.rotation.y = CHAMPION_MODEL_YAW
      model.scale.multiplyScalar(CHAMPION_MODEL_WORLD_SCALE)
    },
    isPersistent: isModelAliasPersistent,
    isRelevant: isModelAliasRelevant,
    logName: 'ChampionStage3D',
    renderer: initializedRenderer,
    restoreLiveFrame: () => initializedRenderer.render(initializedScene, initializedCamera),
    scene: initializedScene,
  })
  stageReady = true
  syncDraftActors(false)
  syncPickCards(false)
  syncBanWalls(false)
  knownLockedActionKeys = new Set(lockedActionKeys.value)
  scheduleActiveModelPreload()
  void syncTeamLogos()
  syncTeamIdentityText()
  void document.fonts.load('900 176px "Bebas Neue"').then(() => {
    if (!stageReady) return
    syncTeamIdentityText()
    drawSpinnerDisplay()
  })
  void document.fonts.load('800 160px "Bebas Neue"').then(() => {
    if (!stageReady) return
    banWallRuntimes.forEach((runtime) => {
      drawBanNameTexture(
        runtime.nameTexture,
        runtime.descriptor.champion.name || runtime.descriptor.champion.alias,
      )
    })
  })
  hasSyncedDraft = true
  handleResize()

  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(container.value)
  renderer.setAnimationLoop(renderFrame)
  if (cameraExitRequested) beginExit()
}

watch(actorSignature, () => {
  if (!stageReady) return
  syncDraftActors(hasSyncedDraft)
  hasSyncedDraft = true
})

watch(pickCardSignature, () => {
  if (stageReady) syncPickCards(hasSyncedDraft)
})

watch(banWallSignature, () => {
  if (stageReady) syncBanWalls(hasSyncedDraft)
})

watch(activePickSignature, () => {
  if (stageReady) drawLaneDisplay()
})

watch(activeBanSignature, () => {
  if (stageReady) {
    drawBanStatusDisplay()
    drawLaneDisplay()
  }
})

watch(lockedActionSignature, () => {
  const nextKeys = new Set(lockedActionKeys.value)
  if (stageReady) {
    const completedDirections = [...nextKeys]
      .filter((key) => !knownLockedActionKeys.has(key))
      .map((key) => (key.includes('-blue-') ? 1 : -1))
    triggerChakramSpin(completedDirections)
  }
  knownLockedActionKeys = nextKeys
})

watch(activeModelSignature, scheduleActiveModelPreload)

watch(teamLogoSignature, () => {
  if (stageReady) void syncTeamLogos()
})

watch(teamIdentityTextSignature, () => {
  if (stageReady) syncTeamIdentityText()
})

watch(eventBrandSignature, () => {
  if (stageReady) drawSpinnerDisplay()
})

onMounted(initializeStage)

function finalizeStageGpuDisposal(): void {
  stageResources.forEach((resource) => resource.dispose())
  stageResources.clear()
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer = undefined
  scene = undefined
  camera = undefined
  cameraController = undefined
  modelRuntime = undefined
}

onUnmounted(() => {
  stageReady = false
  if (modelPreloadTimer !== undefined) window.clearTimeout(modelPreloadTimer)
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  reducedMotionQuery = undefined
  renderer?.setAnimationLoop(null)
  timer.dispose()
  const modelDisposal = modelRuntime?.dispose() ?? Promise.resolve()
  actorRuntimes.forEach(disposeActor)
  actorRuntimes.clear()
  pickCardRuntimes.forEach(disposePickCard)
  pickCardRuntimes.clear()
  banWallRuntimes.forEach(disposeBanWall)
  banWallRuntimes.clear()
  banWallParents.clear()
  disposeTeamIdentityText('blue')
  disposeTeamIdentityText('red')
  teamLogoSyncVersion += 1
  disposeTeamLogo('blue')
  disposeTeamLogo('red')
  renderer?.domElement.remove()
  // compileAsync cannot be cancelled. Keep the context and shared GLB resources
  // alive until the serialized warm-up queue has genuinely settled, then tear
  // down the renderer without risking post-context-loss driver calls.
  void modelDisposal.then(finalizeStageGpuDisposal)
  spinnerDisplayTexture = undefined
  spinnerDisplayMesh = undefined
  laneDisplayTexture = undefined
  laneDisplayMesh = undefined
  banStatusDisplayTexture = undefined
  banStatusDisplayMesh = undefined
  banFloorSpotlightTexture = undefined
  banSpotlightTexture = undefined
  pickCardAlphaMaskTexture = undefined
  chakramSpinElapsed = undefined
  queuedChakramSpinDirections.splice(0)
  knownLockedActionKeys.clear()
  laneIconImages.clear()
  unavailableDisplayImages.clear()
})
</script>

<template>
  <div ref="container" class="champion-stage" aria-hidden="true">
    <div class="stage-vignette" />
  </div>
</template>

<style scoped>
.champion-stage {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #000000;
}

.champion-stage :deep(.champion-stage-canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.stage-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage-vignette {
  background: radial-gradient(ellipse at 50% 48%, transparent 62%, rgb(0 0 0 / 0.32) 100%);
}
</style>
