import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

export const CHAMPION_MODEL_WARMUP_LAYER = 31
export const CHAMPION_MODEL_WORLD_SCALE = 0.0175
export const CHAMPION_MODEL_YAW = 0

const MODEL_PARKED_LAYER = 30
const MODEL_LOAD_CONCURRENCY = 1
const MODEL_PRELOAD_CACHE_LIMIT = 2
const MODEL_WARMUP_MIN_IDLE_MS = 1
const MODEL_WARMUP_STEP_TIMEOUT_MS = 100
const MODEL_CLIPS = {
  idle: 'bb_idle',
  spawn: 'bb_spawn',
} as const

export type ModelAvailability = 'missing' | 'building' | 'ready' | 'failed' | 'unavailable'

interface ModelStatusResponse {
  status: ModelAvailability
  version?: string
  contentUrl?: string
}

export interface ChampionModelAsset {
  animations: THREE.AnimationClip[]
  scene: THREE.Group
}

export interface ChampionModelInstance {
  alias: string
  asset: ChampionModelAsset
  model: THREE.Object3D
  ownedMaterials: THREE.Material[]
}

export interface ChampionModelPlayback {
  playIdle(): void
  playSpawn(): void
  update(delta: number): void
  dispose(): void
}

export interface ChampionModelRuntimeOptions {
  apiBase: string
  camera: THREE.Camera
  configureModel: (model: THREE.Object3D) => void
  isPersistent: (alias: string) => boolean
  isRelevant: (alias: string) => boolean
  logName: string
  renderer: THREE.WebGLRenderer
  restoreLiveFrame: () => void
  scene: THREE.Scene
}

export interface ChampionModelRuntime {
  readonly parallelShaderCompileAvailable: boolean
  claim(instance: ChampionModelInstance): boolean
  dispose(): Promise<void>
  prepare(alias: string): Promise<ChampionModelInstance | null>
  prune(): void
  release(instance: ChampionModelInstance): void
}

interface ParkedRenderable {
  mesh: THREE.Mesh
  originalLayerMask: number
}

interface FallbackEntrance {
  duration: number
  elapsed: number
  startY: number
  targetScale: THREE.Vector3
  targetY: number
}

export function findChampionModelAnimation(
  asset: ChampionModelAsset,
  kind: 'idle' | 'spawn',
): THREE.AnimationClip | undefined {
  return asset.animations.find((clip) => clip.name.toLowerCase() === MODEL_CLIPS[kind])
}

export function playChampionModelAnimation(
  instance: ChampionModelInstance,
  spawn: boolean,
): ChampionModelPlayback {
  const { asset, model } = instance
  const mixer = new THREE.AnimationMixer(model)
  let fallbackEntrance: FallbackEntrance | undefined
  let finishedListener: ((event: { action: THREE.AnimationAction }) => void) | undefined

  function clearFinishedListener(): void {
    if (!finishedListener) return
    mixer.removeEventListener('finished', finishedListener)
    finishedListener = undefined
  }

  function finishFallbackEntrance(): void {
    if (!fallbackEntrance) return
    model.position.y = fallbackEntrance.targetY
    model.scale.copy(fallbackEntrance.targetScale)
    fallbackEntrance = undefined
  }

  function startIdle(fadeFrom?: THREE.AnimationAction): void {
    const idle = findChampionModelAnimation(asset, 'idle')
    if (!idle) return
    const action = mixer
      .clipAction(idle)
      .reset()
      .setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY)
      .fadeIn(0.3)
    action.play()
    if (fadeFrom) action.crossFadeFrom(fadeFrom, 0.35, true)
  }

  function playIdle(): void {
    clearFinishedListener()
    finishFallbackEntrance()
    mixer.stopAllAction()
    startIdle()
  }

  function playSpawn(): void {
    clearFinishedListener()
    finishFallbackEntrance()
    mixer.stopAllAction()
    const entranceClip = findChampionModelAnimation(asset, 'spawn')

    if (!entranceClip) {
      const targetScale = model.scale.clone()
      const targetY = model.position.y
      model.position.y = targetY - 0.32
      model.scale.copy(targetScale).multiplyScalar(0.94)
      fallbackEntrance = {
        duration: 0.62,
        elapsed: 0,
        startY: model.position.y,
        targetScale,
        targetY,
      }
      startIdle()
      return
    }

    const entrance = mixer.clipAction(entranceClip)
    entrance.reset().setLoop(THREE.LoopOnce, 1)
    entrance.clampWhenFinished = true
    entrance.play()

    finishedListener = (event) => {
      if (event.action !== entrance) return
      startIdle(entrance)
      clearFinishedListener()
    }
    mixer.addEventListener('finished', finishedListener)
  }

  function update(delta: number): void {
    mixer.update(delta)
    if (!fallbackEntrance) return

    fallbackEntrance.elapsed = Math.min(fallbackEntrance.elapsed + delta, fallbackEntrance.duration)
    const progress = fallbackEntrance.elapsed / fallbackEntrance.duration
    const eased = 1 - Math.pow(1 - progress, 3)
    model.position.y = THREE.MathUtils.lerp(
      fallbackEntrance.startY,
      fallbackEntrance.targetY,
      eased,
    )
    model.scale
      .copy(fallbackEntrance.targetScale)
      .multiplyScalar(THREE.MathUtils.lerp(0.94, 1, eased))
    if (progress >= 1) fallbackEntrance = undefined
  }

  function dispose(): void {
    clearFinishedListener()
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
  }

  const playback = { dispose, playIdle, playSpawn, update }
  if (spawn) playback.playSpawn()
  else playback.playIdle()
  return playback
}

export function disposeChampionModelInstance(instance: ChampionModelInstance): void {
  instance.model.removeFromParent()
  instance.ownedMaterials.forEach((material) => material.dispose())
}

function disposeChampionModelAsset(asset: ChampionModelAsset): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  asset.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    geometries.add(child.geometry)
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material]
    meshMaterials.forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value)
      })
    })
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => {
    texture.dispose()
    const image = texture.image as { close?: () => void } | undefined
    image?.close?.()
  })
}

function prepareChampionModelInstance(
  alias: string,
  asset: ChampionModelAsset,
  configureModel: (model: THREE.Object3D) => void,
): ChampionModelInstance {
  const model = cloneSkeleton(asset.scene)
  const ownedMaterials: THREE.Material[] = []

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    child.frustumCulled = false
    const original = Array.isArray(child.material) ? child.material : [child.material]
    const owned = original.map((material) => {
      const clone = material.clone()
      if (clone.transparent) {
        clone.transparent = false
        clone.opacity = 1
        clone.alphaTest = Math.max(clone.alphaTest, 0.08)
        clone.alphaToCoverage = true
        clone.depthWrite = true
      }
      clone.needsUpdate = true
      return clone
    })
    ownedMaterials.push(...owned)
    child.material = Array.isArray(child.material) ? owned : owned[0]
  })

  configureModel(model)
  return { alias, asset, model, ownedMaterials }
}

function collectModelTextures(model: THREE.Object3D): THREE.Texture[] {
  const textures = new Set<THREE.Texture>()
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value)
      })
    })
  })
  return [...textures]
}

function parkModelRenderables(model: THREE.Object3D): ParkedRenderable[] {
  const renderables: ParkedRenderable[] = []
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    renderables.push({ mesh: child, originalLayerMask: child.layers.mask })
    child.layers.set(MODEL_PARKED_LAYER)
  })
  return renderables
}

function restoreModelLayers(renderables: ParkedRenderable[]): void {
  renderables.forEach(({ mesh, originalLayerMask }) => {
    mesh.layers.mask = originalLayerMask
  })
}

function setWarmupLayers(renderables: ParkedRenderable[]): void {
  renderables.forEach(({ mesh }) => mesh.layers.set(CHAMPION_MODEL_WARMUP_LAYER))
}

function parkWarmupLayers(renderables: ParkedRenderable[]): void {
  renderables.forEach(({ mesh }) => mesh.layers.set(MODEL_PARKED_LAYER))
}

function waitForWarmupOpportunity(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)

  const idleWindow = window as unknown as {
    cancelIdleCallback?: (handle: number) => void
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  }

  return new Promise((resolve) => {
    let idleId: number | undefined
    let frameId: number | undefined
    let settled = false

    const finish = (canContinue: boolean) => {
      if (settled) return
      settled = true
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId)
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      signal.removeEventListener('abort', handleAbort)
      resolve(canContinue)
    }
    const handleAbort = () => finish(false)
    signal.addEventListener('abort', handleAbort, { once: true })

    if (idleWindow.requestIdleCallback) {
      const requestIdlePeriod = () => {
        idleId = idleWindow.requestIdleCallback?.(
          (deadline) => {
            idleId = undefined
            if (deadline.didTimeout || deadline.timeRemaining() >= MODEL_WARMUP_MIN_IDLE_MS) {
              finish(true)
              return
            }
            requestIdlePeriod()
          },
          { timeout: MODEL_WARMUP_STEP_TIMEOUT_MS },
        )
      }
      requestIdlePeriod()
      return
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(() => finish(true))
    })
  })
}

function abortableWait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => finish(true), ms)
    const handleAbort = () => finish(false)
    const finish = (completed: boolean) => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', handleAbort)
      resolve(completed)
    }
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

function resolveContentUrl(apiBase: string, alias: string, status: ModelStatusResponse): string {
  const fallback = `${apiBase}/pregame/models/${encodeURIComponent(alias)}/content`
  const url = status.contentUrl ? new URL(status.contentUrl, `${apiBase}/`).toString() : fallback
  if (!status.version) return url
  const parsed = new URL(url)
  parsed.searchParams.set('v', status.version)
  return parsed.toString()
}

export function createChampionModelRuntime(
  options: ChampionModelRuntimeOptions,
): ChampionModelRuntime {
  const abortController = new AbortController()
  const { signal } = abortController
  const modelAssets = new Map<string, ChampionModelAsset>()
  const modelRequests = new Map<string, Promise<ChampionModelAsset | null>>()
  const preparedModels = new Map<string, ChampionModelInstance>()
  const preparationRequests = new Map<string, Promise<ChampionModelInstance | null>>()
  const cancelledPreparations = new Set<string>()
  const waitingModelLoads: Array<() => void> = []
  const speculativeAliases: string[] = []
  const warmupRoot = new THREE.Group()
  const warmupCamera = options.camera.clone()
  const warmupTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
  const parallelShaderCompileAvailable = options.renderer.extensions.has(
    'KHR_parallel_shader_compile',
  )
  let activeModelLoads = 0
  let gpuWarmupTail: Promise<void> = Promise.resolve()
  let disposePromise: Promise<void> | undefined

  warmupRoot.name = 'champion-model-warmup-root'
  warmupCamera.layers.set(CHAMPION_MODEL_WARMUP_LAYER)
  options.scene.add(warmupRoot)

  console.info(
    `[${options.logName}] Parallel shader compilation ${
      parallelShaderCompileAvailable ? 'available' : 'unavailable'
    }; exact ${options.renderer.shadowMap.enabled ? 'color and shadow' : 'color'} warm-up remains enabled`,
  )

  function enqueueGpuWarmup<T>(task: () => Promise<T>): Promise<T> {
    const scheduled = gpuWarmupTail.then(task, task)
    gpuWarmupTail = scheduled.then(
      () => undefined,
      () => undefined,
    )
    return scheduled
  }

  function renderWarmupMesh(renderable: ParkedRenderable): boolean {
    if (signal.aborted) return false
    const previousTarget = options.renderer.getRenderTarget()
    const shadowsAutoUpdate = options.renderer.shadowMap.autoUpdate
    const shadowsNeedUpdate = options.renderer.shadowMap.needsUpdate
    const warmOnCanvas = !parallelShaderCompileAvailable
    renderable.mesh.layers.set(CHAMPION_MODEL_WARMUP_LAYER)

    try {
      options.renderer.shadowMap.autoUpdate = true
      options.renderer.shadowMap.needsUpdate = true
      options.renderer.setRenderTarget(warmOnCanvas ? null : warmupTarget)
      options.renderer.render(options.scene, warmupCamera)
      return true
    } finally {
      renderable.mesh.layers.set(MODEL_PARKED_LAYER)
      if (warmOnCanvas) {
        options.renderer.shadowMap.autoUpdate = false
        options.renderer.shadowMap.needsUpdate = false
        options.renderer.setRenderTarget(null)
        options.restoreLiveFrame()
      }
      options.renderer.setRenderTarget(previousTarget)
      options.renderer.shadowMap.autoUpdate = shadowsAutoUpdate
      options.renderer.shadowMap.needsUpdate = shadowsNeedUpdate
    }
  }

  async function warmModelGpu(instance: ChampionModelInstance): Promise<boolean> {
    const { alias, model } = instance
    const renderables = parkModelRenderables(model)
    const warmupId = `${alias}-${Math.round(performance.now() * 1000)}`
    const startMark = `champion-model-warmup-start:${warmupId}`
    const endMark = `champion-model-warmup-end:${warmupId}`
    performance.mark(startMark)
    warmupRoot.add(model)

    try {
      for (const texture of collectModelTextures(model)) {
        if (
          !options.isRelevant(alias) ||
          !(await waitForWarmupOpportunity(signal)) ||
          signal.aborted
        )
          return false
        options.renderer.initTexture(texture)
      }

      if (!options.isRelevant(alias) || !(await waitForWarmupOpportunity(signal)) || signal.aborted)
        return false

      setWarmupLayers(renderables)
      try {
        await options.renderer.compileAsync(model, warmupCamera, options.scene)
      } finally {
        parkWarmupLayers(renderables)
      }
      if (signal.aborted) return false

      for (const renderable of renderables) {
        if (
          !options.isRelevant(alias) ||
          !(await waitForWarmupOpportunity(signal)) ||
          signal.aborted
        )
          return false
        if (!renderWarmupMesh(renderable)) return false
      }
      return true
    } catch (error) {
      if (!signal.aborted) {
        console.warn(
          `[${options.logName}] GPU warm-up failed for ${alias}; keeping the 2D pick visible`,
          error,
        )
      }
      return false
    } finally {
      model.removeFromParent()
      restoreModelLayers(renderables)
      performance.mark(endMark)
      performance.measure(`${options.logName} GPU warm-up (${alias})`, startMark, endMark)
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
    }
  }

  async function withModelLoadSlot<T>(load: () => Promise<T>): Promise<T> {
    if (activeModelLoads >= MODEL_LOAD_CONCURRENCY) {
      await new Promise<void>((resolve) => waitingModelLoads.push(resolve))
    }
    if (signal.aborted) throw new DOMException('Champion model runtime was disposed', 'AbortError')

    activeModelLoads += 1
    try {
      return await load()
    } finally {
      activeModelLoads -= 1
      waitingModelLoads.shift()?.()
    }
  }

  async function requestChampionModel(alias: string): Promise<ChampionModelAsset | null> {
    if (!/^[a-z0-9_-]+$/i.test(alias)) return null
    const statusUrl = `${options.apiBase}/pregame/models/${encodeURIComponent(alias)}/status`

    for (let attempt = 0; attempt < 80 && !signal.aborted; attempt += 1) {
      let response: Response
      try {
        response = await fetch(statusUrl, {
          headers: { Accept: 'application/json' },
          signal,
        })
      } catch {
        return null
      }

      if (response.status === 404) return null
      if (!response.ok) {
        if (!(await abortableWait(1250, signal))) return null
        continue
      }

      let status: ModelStatusResponse
      try {
        status = (await response.json()) as ModelStatusResponse
      } catch {
        return null
      }
      if (status.status === 'failed' || status.status === 'unavailable') return null
      if (status.status !== 'ready') {
        if (!(await abortableWait(900 + Math.min(attempt, 8) * 100, signal))) return null
        continue
      }

      try {
        const contentUrl = resolveContentUrl(options.apiBase, alias, status)
        const gltf: GLTF = await withModelLoadSlot(async () => {
          if (!(await waitForWarmupOpportunity(signal))) {
            throw new DOMException('Champion model runtime was disposed', 'AbortError')
          }
          return new GLTFLoader().loadAsync(contentUrl)
        })
        return { animations: gltf.animations, scene: gltf.scene }
      } catch (error) {
        if (signal.aborted) return null
        console.warn(`[${options.logName}] Model content failed for ${alias}`, error)
        return null
      }
    }
    return null
  }

  function getChampionModel(alias: string): Promise<ChampionModelAsset | null> {
    const existing = modelAssets.get(alias)
    if (existing) return Promise.resolve(existing)
    const pending = modelRequests.get(alias)
    if (pending) return pending

    const request = requestChampionModel(alias).then((asset) => {
      modelRequests.delete(alias)
      if (asset && signal.aborted) {
        disposeChampionModelAsset(asset)
        return null
      }
      if (asset) modelAssets.set(alias, asset)
      return asset
    })
    modelRequests.set(alias, request)
    return request
  }

  function prune(): void {
    while (speculativeAliases.length > MODEL_PRELOAD_CACHE_LIMIT) {
      const disposableIndex = speculativeAliases.findIndex((alias) => !options.isRelevant(alias))
      if (disposableIndex < 0) return
      const [alias] = speculativeAliases.splice(disposableIndex, 1)
      if (!alias) continue
      const instance = preparedModels.get(alias)
      if (instance) {
        preparedModels.delete(alias)
        disposeChampionModelInstance(instance)
      }
      const asset = modelAssets.get(alias)
      if (!asset) continue
      modelAssets.delete(alias)
      disposeChampionModelAsset(asset)
    }
  }

  function rememberSpeculative(alias: string, asset: ChampionModelAsset | null): void {
    if (!asset || options.isPersistent(alias)) return
    const previousIndex = speculativeAliases.indexOf(alias)
    if (previousIndex >= 0) speculativeAliases.splice(previousIndex, 1)
    speculativeAliases.push(alias)
    prune()
  }

  function claim(instance: ChampionModelInstance): boolean {
    if (preparedModels.get(instance.alias) !== instance) return false
    preparedModels.delete(instance.alias)
    const index = speculativeAliases.indexOf(instance.alias)
    if (index >= 0) speculativeAliases.splice(index, 1)
    return true
  }

  function release(instance: ChampionModelInstance): void {
    if (preparedModels.get(instance.alias) === instance) {
      rememberSpeculative(instance.alias, instance.asset)
      return
    }
    disposeChampionModelInstance(instance)
    rememberSpeculative(instance.alias, instance.asset)
  }

  async function prepareOnce(alias: string): Promise<ChampionModelInstance | null> {
    cancelledPreparations.delete(alias)
    const asset = await getChampionModel(alias)
    if (!asset || signal.aborted) return null

    if (!options.isRelevant(alias)) {
      cancelledPreparations.add(alias)
      rememberSpeculative(alias, asset)
      return null
    }

    let instance: ChampionModelInstance | undefined
    try {
      instance = prepareChampionModelInstance(alias, asset, options.configureModel)
      const warmed = await enqueueGpuWarmup(() => warmModelGpu(instance!))
      if (!warmed || signal.aborted) {
        if (!signal.aborted && !options.isRelevant(alias)) cancelledPreparations.add(alias)
        disposeChampionModelInstance(instance)
        rememberSpeculative(alias, asset)
        return null
      }
    } catch (error) {
      if (instance) disposeChampionModelInstance(instance)
      if (!signal.aborted) {
        console.warn(
          `[${options.logName}] Could not prepare ${alias}; keeping the 2D pick visible`,
          error,
        )
      }
      return null
    }

    preparedModels.set(alias, instance)
    rememberSpeculative(alias, asset)
    return instance
  }

  function getPrepared(alias: string): Promise<ChampionModelInstance | null> {
    const existing = preparedModels.get(alias)
    if (existing) return Promise.resolve(existing)
    const pending = preparationRequests.get(alias)
    if (pending) return pending

    const request = prepareOnce(alias).finally(() => {
      if (preparationRequests.get(alias) === request) preparationRequests.delete(alias)
    })
    preparationRequests.set(alias, request)
    return request
  }

  async function prepare(alias: string): Promise<ChampionModelInstance | null> {
    let instance = await getPrepared(alias)
    if (!instance && cancelledPreparations.has(alias) && options.isRelevant(alias)) {
      instance = await getPrepared(alias)
    }
    return instance
  }

  function dispose(): Promise<void> {
    if (disposePromise) return disposePromise
    abortController.abort()
    waitingModelLoads.splice(0).forEach((resume) => resume())
    disposePromise = Promise.allSettled([
      gpuWarmupTail,
      ...preparationRequests.values(),
      ...modelRequests.values(),
    ]).then(() => {
      preparedModels.forEach(disposeChampionModelInstance)
      preparedModels.clear()
      modelAssets.forEach(disposeChampionModelAsset)
      modelAssets.clear()
      preparationRequests.clear()
      modelRequests.clear()
      cancelledPreparations.clear()
      speculativeAliases.splice(0)
      warmupRoot.removeFromParent()
      warmupTarget.dispose()
    })
    return disposePromise
  }

  return {
    parallelShaderCompileAvailable,
    claim,
    dispose,
    prepare,
    prune,
    release,
  }
}
