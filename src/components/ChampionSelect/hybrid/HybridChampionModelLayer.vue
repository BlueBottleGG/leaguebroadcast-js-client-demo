<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { championSelectTeam } from '@bluebottle_gg/league-broadcast-client'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { useClient } from '@/client'
import {
  CHAMPION_MODEL_WARMUP_LAYER,
  CHAMPION_MODEL_WORLD_SCALE,
  CHAMPION_MODEL_YAW,
  createChampionModelRuntime,
  disposeChampionModelInstance,
  findChampionModelAnimation,
  playChampionModelAnimation,
  type ChampionModelInstance,
  type ChampionModelPlayback,
  type ChampionModelRuntime,
} from '../model/championModelRuntime'
import {
  createChampionPortraitFraming,
  updateChampionPortraitCamera,
  type ChampionPortraitFraming,
} from './hybridChampionFraming'
import {
  collectHybridChampionSlots,
  hybridChampionSlotSignature,
  type HybridChampionSlot,
  type HybridChampionModelStatus,
} from './hybridChampionState'

const INCLUDE_HOVER_MODELS = true
const FIRST_PORTRAIT_LAYER = 1
const METRICS_REPORT_INTERVAL_MS = 5_000
// Render at the display's real pixel density (capped) so models are as crisp
// as the surrounding DOM art; the cap bounds fill cost on high-DPI displays.
const MAX_PIXEL_RATIO = 2
const SIZE_PROBE = new THREE.Vector2()

const props = withDefaults(
  defineProps<{
    blueTeam?: championSelectTeam
    redTeam?: championSelectTeam
    suppressBlue?: boolean
    suppressRed?: boolean
  }>(),
  { suppressBlue: false, suppressRed: false },
)

const emit = defineEmits<{
  statusChange: [key: string, alias: string | null, status: HybridChampionModelStatus | null]
}>()

interface PortraitViewport {
  height: number
  width: number
  x: number
  y: number
}

interface PortraitRuntime {
  camera: THREE.OrthographicCamera
  descriptor: HybridChampionSlot
  framing?: ChampionPortraitFraming
  instance?: ChampionModelInstance
  layer: number
  playback?: ChampionModelPlayback
  spawnOnAttach: boolean
  version: number
}

const container = ref<HTMLDivElement>()
const client = useClient()
const apiBase = client.getApiUrl().replace(/\/$/, '')
const descriptors = computed(() =>
  collectHybridChampionSlots(props.blueTeam, props.redTeam, {
    includeActive: INCLUDE_HOVER_MODELS,
  }),
)
const descriptorSignature = computed(() =>
  descriptors.value.map(hybridChampionSlotSignature).sort().join('|'),
)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let environmentTarget: THREE.WebGLRenderTarget | undefined
let modelRuntime: ChampionModelRuntime | undefined
let resizeObserver: ResizeObserver | undefined
let markerObserver: ResizeObserver | undefined
let reducedMotionQuery: MediaQueryList | undefined
let prefersReducedMotion = false
let disposed = false
let layerUnavailable = false
let layoutDirty = true
let trackLayoutUntil = 0
let version = 0
let relevantAliases = new Set<string>()
let persistentAliases = new Set<string>()
let desiredDescriptors = descriptors.value
const timer = new THREE.Timer()
const portraitRuntimes = new Map<string, PortraitRuntime>()
const markerElements = new Map<string, HTMLElement>()
const viewports = new Map<string, PortraitViewport>()
const requestStartedAt = new Map<string, number>()
const metricsEnabled = new URLSearchParams(window.location.search).get('modelMetrics') === '1'
let metricsStartedAt = performance.now()
let nextMetricsReport = metricsStartedAt + METRICS_REPORT_INTERVAL_MS
let renderedFrames = 0
let framesOver33Ms = 0
let framesOver50Ms = 0

function portraitLayer(descriptor: HybridChampionSlot): number {
  return FIRST_PORTRAIT_LAYER + descriptor.index + (descriptor.side === 'red' ? 5 : 0)
}

function setObjectLayer(object: THREE.Object3D, layer: number): void {
  object.traverse((child) => child.layers.set(layer))
}

function enablePortraitLayers(object: THREE.Object3D): void {
  for (let layer = FIRST_PORTRAIT_LAYER; layer < FIRST_PORTRAIT_LAYER + 10; layer += 1) {
    object.layers.enable(layer)
  }
  object.layers.enable(CHAMPION_MODEL_WARMUP_LAYER)
}

function isSuppressed(descriptor: HybridChampionSlot): boolean {
  return descriptor.side === 'blue' ? props.suppressBlue : props.suppressRed
}

function disposePortraitRuntime(runtime: PortraitRuntime): void {
  runtime.version = ++version
  runtime.playback?.dispose()
  if (runtime.instance) {
    if (modelRuntime) modelRuntime.release(runtime.instance)
    else disposeChampionModelInstance(runtime.instance)
  }
  emit('statusChange', runtime.descriptor.key, null, null)
}

function isCurrentRuntime(runtime: PortraitRuntime, requestVersion: number): boolean {
  return (
    !disposed &&
    runtime.version === requestVersion &&
    portraitRuntimes.get(runtime.descriptor.key) === runtime
  )
}

function reportReady(runtime: PortraitRuntime): void {
  emit('statusChange', runtime.descriptor.key, runtime.descriptor.alias, 'ready')
  if (!metricsEnabled) return

  const elapsed =
    performance.now() - (requestStartedAt.get(runtime.descriptor.key) ?? performance.now())
  const resourceNeedle = `/pregame/models/${encodeURIComponent(runtime.descriptor.alias)}/content`
  const resource = performance
    .getEntriesByType('resource')
    .filter((entry) => entry.name.includes(resourceNeedle))
    .at(-1) as PerformanceResourceTiming | undefined
  console.info(
    '[HybridChampionModels] portrait ready',
    JSON.stringify({
      alias: runtime.descriptor.alias,
      anchor: runtime.framing?.source,
      decodedBytes: resource?.decodedBodySize ?? 0,
      key: runtime.descriptor.key,
      readyMs: Math.round(elapsed),
      transferBytes: resource?.transferSize ?? 0,
    }),
  )
}

async function hydratePortrait(runtime: PortraitRuntime): Promise<void> {
  const models = modelRuntime
  const portraitScene = scene
  if (!models || !portraitScene) return
  const requestVersion = runtime.version
  let instance: ChampionModelInstance | null = null

  for (let attempt = 0; attempt < 2 && !instance; attempt += 1) {
    const candidate = await models.prepare(runtime.descriptor.alias)
    if (!candidate) break
    if (!isCurrentRuntime(runtime, requestVersion)) {
      models.release(candidate)
      return
    }
    if (models.claim(candidate)) instance = candidate
  }

  if (!instance || !isCurrentRuntime(runtime, requestVersion)) {
    if (instance) models.release(instance)
    if (!instance && isCurrentRuntime(runtime, requestVersion)) {
      emit('statusChange', runtime.descriptor.key, runtime.descriptor.alias, 'failed')
    }
    return
  }

  runtime.instance = instance
  setObjectLayer(instance.model, runtime.layer)
  portraitScene.add(instance.model)
  runtime.framing = createChampionPortraitFraming(
    instance.model,
    findChampionModelAnimation(instance.asset, 'idle'),
  )
  const playSpawn = runtime.spawnOnAttach && runtime.descriptor.isActive && !prefersReducedMotion
  runtime.playback = playChampionModelAnimation(instance, playSpawn)
  if (metricsEnabled && playSpawn) {
    console.info(
      '[HybridChampionModels] spawn',
      JSON.stringify({
        alias: runtime.descriptor.alias,
        key: runtime.descriptor.key,
        state: 'hover',
      }),
    )
  }
  runtime.spawnOnAttach = false
  reportReady(runtime)
}

function syncPortraits(): void {
  if (!modelRuntime) {
    if (layerUnavailable) {
      desiredDescriptors.forEach((descriptor) => {
        emit('statusChange', descriptor.key, descriptor.alias, 'failed')
      })
    }
    return
  }
  const desired = new Map(desiredDescriptors.map((descriptor) => [descriptor.key, descriptor]))

  portraitRuntimes.forEach((runtime, key) => {
    const next = desired.get(key)
    if (next?.alias === runtime.descriptor.alias) return
    portraitRuntimes.delete(key)
    disposePortraitRuntime(runtime)
  })

  desired.forEach((descriptor, key) => {
    const existing = portraitRuntimes.get(key)
    if (existing) {
      const changedState = existing.descriptor.isActive !== descriptor.isActive
      existing.descriptor = descriptor
      if (changedState) {
        existing.spawnOnAttach = descriptor.isActive
        if (descriptor.isActive && existing.playback) {
          if (prefersReducedMotion) existing.playback.playIdle()
          else existing.playback.playSpawn()
        }
        if (descriptor.isActive && metricsEnabled && !prefersReducedMotion) {
          console.info(
            '[HybridChampionModels] spawn',
            JSON.stringify({
              alias: descriptor.alias,
              key: descriptor.key,
              state: 'hover',
            }),
          )
        }
      }
      return
    }

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
    const layer = portraitLayer(descriptor)
    camera.layers.set(layer)
    const runtime: PortraitRuntime = {
      camera,
      descriptor,
      layer,
      spawnOnAttach: descriptor.isActive,
      version: ++version,
    }
    portraitRuntimes.set(key, runtime)
    requestStartedAt.set(key, performance.now())
    emit('statusChange', key, descriptor.alias, 'loading')
    void hydratePortrait(runtime)
  })

  modelRuntime.prune()
  trackLayoutUntil = performance.now() + 700
  void nextTick(observeViewportMarkers)
}

function observeViewportMarkers(): void {
  markerObserver?.disconnect()
  markerElements.clear()
  const pickStrip = container.value?.parentElement
  if (!pickStrip) return
  pickStrip.querySelectorAll<HTMLElement>('[data-model-viewport]').forEach((element) => {
    const key = element.dataset.modelViewport
    if (!key) return
    markerElements.set(key, element)
    markerObserver?.observe(element)
  })
  layoutDirty = true
}

function handleResize(): void {
  if (!renderer || !container.value) return
  const width = Math.max(container.value.clientWidth, 1)
  const height = Math.max(container.value.clientHeight, 1)
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio)
  const size = renderer.getSize(SIZE_PROBE)
  if (size.x !== width || size.y !== height) {
    renderer.setSize(width, height, false)
  }
  layoutDirty = true
}

// Viewports are kept in CSS units; setViewport/setScissor scale by the
// renderer's pixel ratio internally.
function measureViewports(): void {
  if (!renderer) return
  const canvasRect = renderer.domElement.getBoundingClientRect()
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return
  const size = renderer.getSize(SIZE_PROBE)
  const scaleX = size.x / canvasRect.width
  const scaleY = size.y / canvasRect.height
  viewports.clear()

  markerElements.forEach((element, key) => {
    const marker = element.getBoundingClientRect()
    const left = Math.max(marker.left, canvasRect.left)
    const right = Math.min(marker.right, canvasRect.right)
    const top = Math.max(marker.top, canvasRect.top)
    const bottom = Math.min(marker.bottom, canvasRect.bottom)
    if (right <= left || bottom <= top) return

    const x = (left - canvasRect.left) * scaleX
    const width = Math.max(1, (right - left) * scaleX)
    const height = Math.max(1, (bottom - top) * scaleY)
    const y = size.y - (bottom - canvasRect.top) * scaleY
    viewports.set(key, { height, width, x, y })
  })
  layoutDirty = false
}

function renderVisiblePortraits(): void {
  if (!renderer || !scene) return
  const size = renderer.getSize(SIZE_PROBE)
  renderer.setScissorTest(false)
  renderer.setViewport(0, 0, size.x, size.y)
  renderer.clear(true, true, true)
  renderer.setScissorTest(true)

  portraitRuntimes.forEach((runtime, key) => {
    const viewport = viewports.get(key)
    if (!runtime.instance || !runtime.framing || !viewport || isSuppressed(runtime.descriptor))
      return
    updateChampionPortraitCamera(runtime.camera, runtime.framing, viewport.width / viewport.height)
    renderer!.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer!.setScissor(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer!.render(scene!, runtime.camera)
  })

  renderer.setScissorTest(false)
}

function reportRendererMetrics(now: number): void {
  if (!metricsEnabled || !renderer || now < nextMetricsReport) return
  console.info(
    '[HybridChampionModels] renderer sample',
    JSON.stringify({
      calls: renderer.info.render.calls,
      frames: renderedFrames,
      framesOver33Ms,
      framesOver50Ms,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      triangles: renderer.info.render.triangles,
      visiblePortraits: [...portraitRuntimes.values()].filter((runtime) => !!runtime.instance)
        .length,
    }),
  )
  renderer.info.reset()
  renderedFrames = 0
  framesOver33Ms = 0
  framesOver50Ms = 0
  nextMetricsReport = now + METRICS_REPORT_INTERVAL_MS
}

function renderFrame(): void {
  if (!renderer || !scene) return
  timer.update()
  const rawDelta = timer.getDelta()
  const delta = Math.min(rawDelta, 0.05)
  if (rawDelta > 1 / 30) framesOver33Ms += 1
  if (rawDelta > 0.05) framesOver50Ms += 1
  renderedFrames += 1
  portraitRuntimes.forEach((runtime) => runtime.playback?.update(delta, runtime.camera))
  const now = performance.now()
  if (layoutDirty || now < trackLayoutUntil) measureViewports()
  renderVisiblePortraits()
  reportRendererMetrics(now)
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  prefersReducedMotion = event.matches
  if (event.matches) portraitRuntimes.forEach((runtime) => runtime.playback?.playIdle())
}

function initializeLayer(): void {
  if (!container.value) return
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = reducedMotionQuery.matches
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    layerUnavailable = true
    console.warn('[HybridChampionModels] WebGL is unavailable; keeping champion splash art', error)
    desiredDescriptors.forEach((descriptor) => {
      emit('statusChange', descriptor.key, descriptor.alias, 'failed')
    })
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Neutral instead of ACES filmic: League textures are hand-painted with
  // lighting baked in, and filmic grading desaturates them into clay.
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = false
  renderer.autoClear = false
  renderer.info.autoReset = !metricsEnabled
  renderer.domElement.className = 'hybrid-champion-model-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  // A subtle image-based environment keeps the now-glossier materials from
  // reading flat. Must be assigned before any model warm-up so compileAsync
  // compiles the shader variant that is used live.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  environmentTarget = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = 0.3
  const ambient = new THREE.HemisphereLight(0xe8f0ff, 0x080b10, 1.15)
  const key = new THREE.DirectionalLight(0xffffff, 2.0)
  key.position.set(-4, 7, 9)
  const fill = new THREE.DirectionalLight(0xbfd7ff, 1.0)
  fill.position.set(5, 3, 7)
  ;[ambient, key, fill].forEach(enablePortraitLayers)
  scene.add(ambient, key, fill)

  const warmupCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
  warmupCamera.position.set(0, 2, 10)
  warmupCamera.lookAt(0, 2, 0)
  const initializedRenderer = renderer
  const initializedScene = scene
  modelRuntime = createChampionModelRuntime({
    apiBase,
    camera: warmupCamera,
    configureModel: (model) => {
      model.rotation.y = CHAMPION_MODEL_YAW
      model.scale.multiplyScalar(CHAMPION_MODEL_WORLD_SCALE)
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.castShadow = false
        object.receiveShadow = false
      })
    },
    isPersistent: (alias) => persistentAliases.has(alias),
    isRelevant: (alias) => relevantAliases.has(alias),
    logName: 'HybridChampionModels',
    renderer: initializedRenderer,
    restoreLiveFrame: () => {
      if (layoutDirty) measureViewports()
      renderVisiblePortraits()
    },
    scene: initializedScene,
  })

  markerObserver = new ResizeObserver(() => {
    layoutDirty = true
    trackLayoutUntil = performance.now() + 400
  })
  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(container.value)
  handleResize()
  trackLayoutUntil = performance.now() + 1_800
  observeViewportMarkers()
  syncPortraits()
  timer.connect(document)
  renderer.setAnimationLoop(renderFrame)
}

watch(
  descriptorSignature,
  () => {
    desiredDescriptors = descriptors.value
    relevantAliases = new Set(desiredDescriptors.map((descriptor) => descriptor.alias))
    persistentAliases = new Set(
      desiredDescriptors
        .filter((descriptor) => !descriptor.isActive)
        .map((descriptor) => descriptor.alias),
    )
    syncPortraits()
  },
  { immediate: true },
)

watch(
  () => [props.suppressBlue, props.suppressRed],
  () => {
    layoutDirty = true
  },
)

onMounted(initializeLayer)

onUnmounted(() => {
  disposed = true
  renderer?.setAnimationLoop(null)
  timer.dispose()
  resizeObserver?.disconnect()
  markerObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  const runtimeDisposal = modelRuntime?.dispose() ?? Promise.resolve()
  portraitRuntimes.forEach(disposePortraitRuntime)
  portraitRuntimes.clear()
  markerElements.clear()
  viewports.clear()
  renderer?.domElement.remove()
  const rendererToDispose = renderer
  const environmentToDispose = environmentTarget
  void runtimeDisposal.then(() => {
    environmentToDispose?.dispose()
    rendererToDispose?.dispose()
    rendererToDispose?.forceContextLoss()
  })
  if (metricsEnabled) {
    console.info(
      '[HybridChampionModels] session complete',
      JSON.stringify({
        durationMs: Math.round(performance.now() - metricsStartedAt),
        requestedSlots: requestStartedAt.size,
      }),
    )
  }
  renderer = undefined
  scene = undefined
  environmentTarget = undefined
  modelRuntime = undefined
})
</script>

<template>
  <div ref="container" class="hybrid-champion-model-layer" aria-hidden="true" />
</template>

<style scoped>
.hybrid-champion-model-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.hybrid-champion-model-layer :deep(.hybrid-champion-model-canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
