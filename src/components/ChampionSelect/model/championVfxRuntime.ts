import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

// Runtime for the idle-particle manifest the backend embeds in champion GLBs
// (extras.bbIdleVfx): the persistent effects League attaches to bones while a
// champion stands around — Nocturne's mist tails, ambient wisps, aura glows.
// It interprets a deliberately small subset of League's emitter schema: ribbon
// trails (VfxPrimitiveCameraTrail / ArbitraryTrail) and billboard quads
// (everything else), with constant-or-curve values, per-particle probability
// randomisation, colour ramps, and additive blending. Geometry is rebuilt on
// the CPU each frame in model-root space, which equals League's own unit space,
// so manifest values need no conversion and the meshes inherit the model's
// world transform, layers, and warm-up handling for free.

const MAX_TRAIL_POINTS = 128
const MAX_QUAD_PARTICLES = 64
const VFX_RENDER_ORDER = 10

interface VfxDynamics {
  times?: number[]
  values?: Array<number | number[]>
}

interface VfxProbabilityTable {
  keyTimes?: number[]
  keyValues?: number[]
}

interface VfxValue {
  constantValue?: number | number[]
  dynamics?: VfxDynamics & { probabilityTables?: VfxProbabilityTable[] }
}

interface VfxEmitterDef {
  emitterName?: string
  rate?: VfxValue
  particleLifetime?: VfxValue
  timeBeforeFirstEmission?: number
  isSingleParticle?: boolean
  blendMode?: number
  texture?: string
  particleColorTexture?: string
  birthColor?: VfxValue
  color?: VfxValue
  birthVelocity?: VfxValue
  birthDrag?: VfxValue
  worldAcceleration?: VfxValue
  birthTranslation?: VfxValue
  bindWeight?: VfxValue
  birthScale0?: VfxValue
  scale0?: VfxValue
  birthUvScrollRate?: VfxValue
  disableBackfaceCull?: boolean
  isUniformScale?: boolean
  isLocalOrientation?: boolean
  particleIsLocalOrientation?: boolean
  EmitterPosition?: VfxValue
  SpawnShape?: { emitOffset?: VfxValue }
  primitive?: { __type?: string; mTrail?: { mCutoff?: number; mBirthTilingSize?: VfxValue } }
}

interface VfxEffectDef {
  bone?: string
  system?: string
  emitters?: VfxEmitterDef[]
}

interface VfxManifest {
  version?: number
  effects?: VfxEffectDef[]
  textures?: Record<string, string>
}

type RampSample = (t: number) => [number, number, number, number]

interface SharedTexture {
  texture: THREE.Texture
  dataUri: string
  ramp?: RampSample
  rampRequested?: boolean
}

export interface ChampionIdleVfxAsset {
  manifest: VfxManifest
  textures: Map<string, SharedTexture>
}

export interface ChampionIdleVfxInstance {
  update(delta: number, camera?: THREE.Camera): void
  dispose(): void
}

/** Reads the backend's idle-VFX manifest out of a loaded GLB, if it carries one. */
export function parseChampionIdleVfx(gltf: GLTF): ChampionIdleVfxAsset | undefined {
  const json = (gltf.parser as unknown as { json?: { extras?: { bbIdleVfx?: VfxManifest } } })
    .json
  const manifest = json?.extras?.bbIdleVfx
  if (!manifest || manifest.version !== 1 || !manifest.effects?.length) return undefined

  const loader = new THREE.TextureLoader()
  const textures = new Map<string, SharedTexture>()
  for (const [path, dataUri] of Object.entries(manifest.textures ?? {})) {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) continue
    const texture = loader.load(dataUri)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    textures.set(path.toLowerCase(), { dataUri, texture })
  }
  return { manifest, textures }
}

export function disposeChampionIdleVfxAsset(asset: ChampionIdleVfxAsset): void {
  asset.textures.forEach((shared) => shared.texture.dispose())
  asset.textures.clear()
}

/** League colour ramps map particle lifetime along X; sampling happens on the CPU per point. */
function requestRamp(asset: ChampionIdleVfxAsset, path: string | undefined): SharedTexture | undefined {
  if (!path) return undefined
  const shared = asset.textures.get(normalizePath(path))
  if (!shared || shared.rampRequested) return shared
  shared.rampRequested = true
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, image.naturalWidth)
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(image, 0, 0, canvas.width, 1)
    const pixels = context.getImageData(0, 0, canvas.width, 1).data
    shared.ramp = (t) => {
      const x = Math.min(canvas.width - 1, Math.max(0, Math.round(t * (canvas.width - 1)))) * 4
      return [pixels[x]! / 255, pixels[x + 1]! / 255, pixels[x + 2]! / 255, pixels[x + 3]! / 255]
    }
  }
  image.src = shared.dataUri
  return shared
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function components(value: number | number[] | undefined, fallback: number): [number, number, number, number] {
  if (typeof value === 'number') return [value, value, value, value]
  if (!Array.isArray(value)) return [fallback, fallback, fallback, fallback]
  return [
    value[0] ?? fallback,
    value[1] ?? value[0] ?? fallback,
    value[2] ?? value[0] ?? fallback,
    value[3] ?? 1,
  ]
}

/** Samples a {constantValue, dynamics} League value at normalised lifetime t. */
function sampleValue(value: VfxValue | undefined, t: number, fallback: number): [number, number, number, number] {
  if (!value) return [fallback, fallback, fallback, fallback]
  const dynamics = value.dynamics
  if (!dynamics?.times?.length || !dynamics.values?.length) {
    return components(value.constantValue, fallback)
  }
  const times = dynamics.times
  const values = dynamics.values
  let index = 0
  while (index < times.length - 1 && times[index + 1]! <= t) index += 1
  const next = Math.min(index + 1, times.length - 1)
  const span = times[next]! - times[index]!
  const mix = span > 0 ? THREE.MathUtils.clamp((t - times[index]!) / span, 0, 1) : 0
  const from = components(values[index], fallback)
  const to = components(values[next], fallback)
  return [
    THREE.MathUtils.lerp(from[0], to[0], mix),
    THREE.MathUtils.lerp(from[1], to[1], mix),
    THREE.MathUtils.lerp(from[2], to[2], mix),
    THREE.MathUtils.lerp(from[3], to[3], mix),
  ]
}

/** A per-particle random multiplier from the value's probability tables (identity without them). */
function sampleProbability(value: VfxValue | undefined): [number, number, number, number] {
  const tables = value?.dynamics?.probabilityTables
  if (!tables?.length) return [1, 1, 1, 1]
  const result: [number, number, number, number] = [1, 1, 1, 1]
  for (let component = 0; component < Math.min(tables.length, 4); component += 1) {
    const table = tables[component]
    const times = table?.keyTimes
    const values = table?.keyValues
    if (!times?.length || !values?.length) continue
    const t = Math.random()
    let index = 0
    while (index < times.length - 1 && times[index + 1]! <= t) index += 1
    const next = Math.min(index + 1, times.length - 1)
    const span = times[next]! - times[index]!
    const mix = span > 0 ? THREE.MathUtils.clamp((t - times[index]!) / span, 0, 1) : 0
    result[component] = THREE.MathUtils.lerp(values[index]!, values[next]!, mix)
  }
  return result
}

function constantVector(value: VfxValue | undefined): THREE.Vector3 {
  const [x, y, z] = components(value?.constantValue, 0)
  return new THREE.Vector3(x, y, z)
}

interface Particle {
  age: number
  life: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  spawnOffset: THREE.Vector3
  randomScale: [number, number, number, number]
}

/** Shared per-frame context: everything is expressed in model-root space. */
interface FrameContext {
  boneToModel: THREE.Matrix4
  bonePosition: THREE.Vector3
  boneQuaternion: THREE.Quaternion
  cameraPosition: THREE.Vector3
  cameraForward: THREE.Vector3
  orthographic: boolean
}

abstract class EmitterRuntime {
  readonly mesh: THREE.Mesh
  protected readonly definition: VfxEmitterDef
  protected readonly particles: Particle[] = []
  protected readonly maxParticles: number
  protected readonly rate: number
  protected readonly lifetime: number
  protected readonly additive: boolean
  protected readonly worldAcceleration: THREE.Vector3
  protected readonly drag: THREE.Vector3
  protected readonly spawnOffset: THREE.Vector3
  protected readonly ramp?: SharedTexture
  protected emitterAge = 0
  private spawnDebt = 0

  protected constructor(
    definition: VfxEmitterDef,
    asset: ChampionIdleVfxAsset,
    maxParticles: number,
    geometry: THREE.BufferGeometry,
  ) {
    this.definition = definition
    this.maxParticles = maxParticles
    this.rate = sampleValue(definition.rate, 0, 0)[0]
    this.lifetime = Math.max(0.05, sampleValue(definition.particleLifetime, 0, 1)[0])
    this.additive = (definition.blendMode ?? 0) !== 0
    this.worldAcceleration = constantVector(definition.worldAcceleration)
    this.drag = constantVector(definition.birthDrag)
    this.spawnOffset = constantVector(definition.EmitterPosition)
      .add(constantVector(definition.SpawnShape?.emitOffset))
      .add(constantVector(definition.birthTranslation))
    this.ramp = requestRamp(asset, definition.particleColorTexture)

    const texture = definition.texture
      ? asset.textures.get(normalizePath(definition.texture))?.texture
      : undefined
    const material = new THREE.MeshBasicMaterial({
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
      map: texture ?? null,
      // Additive output must be scaled by texel alpha (League's masks carry
      // their shape there); premultiplied output does exactly that under
      // ONE/ONE blending.
      premultipliedAlpha: this.additive,
      side: THREE.DoubleSide,
      transparent: true,
      vertexColors: true,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = VFX_RENDER_ORDER
    this.mesh.userData.bbIdleVfx = true
    this.mesh.name = `bb-idle-vfx-${definition.emitterName ?? 'emitter'}`
  }

  update(delta: number, context: FrameContext): void {
    this.emitterAge += delta
    const emitting = this.emitterAge >= (this.definition.timeBeforeFirstEmission ?? 0)

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index]!
      particle.age += delta
      if (particle.age >= particle.life && !this.definition.isSingleParticle) {
        this.particles.splice(index, 1)
        continue
      }
      if (this.definition.isSingleParticle) particle.age %= particle.life
      particle.velocity.addScaledVector(this.worldAcceleration, delta)
      // birthDrag is a per-axis damping coefficient, not a multiplier.
      particle.velocity.set(
        particle.velocity.x * Math.exp(-this.drag.x * delta),
        particle.velocity.y * Math.exp(-this.drag.y * delta),
        particle.velocity.z * Math.exp(-this.drag.z * delta),
      )
      particle.position.addScaledVector(particle.velocity, delta)
    }

    if (emitting) {
      if (this.definition.isSingleParticle) {
        if (this.particles.length === 0) this.spawn(context)
      } else {
        this.spawnDebt += this.rate * delta
        while (this.spawnDebt >= 1 && this.particles.length < this.maxParticles) {
          this.spawnDebt -= 1
          this.spawn(context)
        }
        this.spawnDebt = Math.min(this.spawnDebt, 4)
      }
    }

    this.build(context)
  }

  /**
   * League emitters inherit only the bone's position by default; offsets and
   * velocities stay in the champion's own frame unless local orientation is
   * requested — and our simulation space IS the model frame, so those need no
   * rotation at all.
   */
  private get localOrientation(): boolean {
    return (
      this.definition.isLocalOrientation === true ||
      this.definition.particleIsLocalOrientation === true
    )
  }

  private spawn(context: FrameContext): void {
    const offset = this.spawnOffset.clone()
    if (this.localOrientation) offset.applyQuaternion(context.boneQuaternion)
    const velocity = constantVector(this.definition.birthVelocity)
    const velocityRandom = sampleProbability(this.definition.birthVelocity)
    velocity.set(
      velocity.x * velocityRandom[0],
      velocity.y * velocityRandom[1],
      velocity.z * velocityRandom[2],
    )
    if (this.localOrientation) velocity.applyQuaternion(context.boneQuaternion)
    this.particles.push({
      age: 0,
      life: this.lifetime,
      position: context.bonePosition.clone().add(offset),
      velocity,
      spawnOffset: this.spawnOffset.clone(),
      randomScale: sampleProbability(this.definition.birthScale0),
    })
  }

  /** The particle's rendered position: bindWeight blends bone-anchored toward free-flying. */
  protected renderedPosition(particle: Particle, context: FrameContext, target: THREE.Vector3): THREE.Vector3 {
    const t = particle.age / particle.life
    const weight = THREE.MathUtils.clamp(
      sampleValue(this.definition.bindWeight, t, 1)[0],
      0,
      1,
    )
    target.copy(particle.position)
    if (weight > 0) {
      const bound = particle.spawnOffset.clone()
      if (this.localOrientation) bound.applyQuaternion(context.boneQuaternion)
      bound.add(context.bonePosition)
      target.lerp(bound, weight)
    }
    return target
  }

  /** RGBA at normalised lifetime t, ramp and curves applied, premultiplied for additive blending. */
  protected colorAt(t: number): [number, number, number, number] {
    const birth = components(this.definition.birthColor?.constantValue, 1)
    const curve = this.definition.color
      ? sampleValue(this.definition.color, t, 1)
      : ([1, 1, 1, 1] as const)
    const ramp = this.ramp?.ramp?.(t) ?? ([1, 1, 1, 1] as const)
    let red = birth[0] * curve[0] * ramp[0]
    let green = birth[1] * curve[1] * ramp[1]
    let blue = birth[2] * curve[2] * ramp[2]
    const alpha = birth[3] * curve[3] * ramp[3]
    if (this.additive) {
      // ONE/ONE blending ignores alpha, so fading has to darken the colour itself.
      red *= alpha
      green *= alpha
      blue *= alpha
      return [red, green, blue, 1]
    }
    return [red, green, blue, alpha]
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.mesh.removeFromParent()
  }

  protected abstract build(context: FrameContext): void
}

/**
 * Ribbon trail: points are emitted at the bone and aged; consecutive rendered
 * positions form a camera-facing strip. Covers VfxPrimitiveCameraTrail and
 * (approximately) VfxPrimitiveArbitraryTrail.
 */
class TrailEmitterRuntime extends EmitterRuntime {
  private readonly cutoff: number
  private readonly tiling: number
  private readonly scrollRate: number
  private scroll = 0

  constructor(definition: VfxEmitterDef, asset: ChampionIdleVfxAsset) {
    const maxPoints = Math.min(
      MAX_TRAIL_POINTS,
      Math.max(8, Math.ceil(sampleValue(definition.rate, 0, 20)[0] * 2) + 4),
    )
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 3), 3),
    )
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 2), 2))
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(maxPoints * 2 * 4), 4),
    )
    const indices = new Uint16Array((maxPoints - 1) * 6)
    for (let segment = 0; segment < maxPoints - 1; segment += 1) {
      const vertex = segment * 2
      indices.set(
        [vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3],
        segment * 6,
      )
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.setDrawRange(0, 0)
    super(definition, asset, maxPoints, geometry)

    this.cutoff = definition.primitive?.mTrail?.mCutoff ?? Number.POSITIVE_INFINITY
    this.tiling = Math.max(
      1,
      sampleValue(definition.primitive?.mTrail?.mBirthTilingSize, 0, 0)[0] || 0,
    )
    this.scrollRate = sampleValue(definition.birthUvScrollRate, 0, 0)[0]
  }

  protected build(context: FrameContext): void {
    this.scroll = (this.scroll + this.scrollRate * (1 / 60)) % 1
    const geometry = this.mesh.geometry
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute

    // Newest first so the strip starts at the bone.
    const points = [...this.particles].sort((a, b) => a.age - b.age)
    const rendered: THREE.Vector3[] = []
    for (const point of points) rendered.push(this.renderedPosition(point, context, new THREE.Vector3()))

    const tangent = new THREE.Vector3()
    const view = new THREE.Vector3()
    const side = new THREE.Vector3()
    let distance = 0
    let written = 0
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!
      const position = rendered[index]!
      if (index > 0) {
        distance += position.distanceTo(rendered[index - 1]!)
        if (distance > this.cutoff) break
      }

      const next = rendered[Math.min(index + 1, rendered.length - 1)]!
      const previous = rendered[Math.max(index - 1, 0)]!
      tangent.subVectors(next, previous)
      if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0)
      if (context.orthographic) view.copy(context.cameraForward)
      else view.subVectors(position, context.cameraPosition)
      side.crossVectors(tangent, view)
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
      side.normalize()

      const t = point.age / point.life
      const width =
        sampleValue(this.definition.birthScale0, 0, 1)[0] *
        point.randomScale[0] *
        sampleValue(this.definition.scale0, t, 1)[0]
      const half = Math.max(0, width) * 0.5
      positions.setXYZ(
        written * 2,
        position.x + side.x * half,
        position.y + side.y * half,
        position.z + side.z * half,
      )
      positions.setXYZ(
        written * 2 + 1,
        position.x - side.x * half,
        position.y - side.y * half,
        position.z - side.z * half,
      )
      const u = (this.tiling > 1 ? distance / this.tiling : t) - this.scroll
      uvs.setXY(written * 2, u, 0)
      uvs.setXY(written * 2 + 1, u, 1)
      const [red, green, blue, alpha] = this.colorAt(t)
      colors.setXYZW(written * 2, red, green, blue, alpha)
      colors.setXYZW(written * 2 + 1, red, green, blue, alpha)
      written += 1
    }

    positions.needsUpdate = true
    uvs.needsUpdate = true
    colors.needsUpdate = true
    geometry.setDrawRange(0, written > 1 ? (written - 1) * 6 : 0)
  }
}

/**
 * Billboard quads for everything that is not a trail: soft glows, sparkles,
 * and a serviceable stand-in for primitives the runtime does not model (rays).
 */
class QuadEmitterRuntime extends EmitterRuntime {
  constructor(definition: VfxEmitterDef, asset: ChampionIdleVfxAsset) {
    const maxParticles = definition.isSingleParticle
      ? 1
      : Math.min(
          MAX_QUAD_PARTICLES,
          Math.max(
            4,
            Math.ceil(
              sampleValue(definition.rate, 0, 8)[0] *
                Math.max(0.05, sampleValue(definition.particleLifetime, 0, 1)[0]),
            ) + 2,
          ),
        )
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(maxParticles * 4 * 3), 3),
    )
    const uvs = new Float32Array(maxParticles * 4 * 2)
    for (let index = 0; index < maxParticles; index += 1) {
      uvs.set([0, 0, 1, 0, 0, 1, 1, 1], index * 8)
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(maxParticles * 4 * 4), 4),
    )
    const indices = new Uint16Array(maxParticles * 6)
    for (let index = 0; index < maxParticles; index += 1) {
      const vertex = index * 4
      indices.set(
        [vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3],
        index * 6,
      )
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.setDrawRange(0, 0)
    super(definition, asset, maxParticles, geometry)
  }

  protected build(context: FrameContext): void {
    const geometry = this.mesh.geometry
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute

    const position = new THREE.Vector3()
    const view = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3()
    const worldUp = new THREE.Vector3(0, 1, 0)
    let written = 0
    for (const particle of this.particles) {
      if (written >= this.maxParticles) break
      this.renderedPosition(particle, context, position)
      if (context.orthographic) view.copy(context.cameraForward)
      else view.subVectors(position, context.cameraPosition)
      view.normalize()
      right.crossVectors(worldUp, view)
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
      right.normalize()
      up.crossVectors(view, right)

      const t = particle.age / particle.life
      const birthScale = sampleValue(this.definition.birthScale0, 0, 1)
      const scale = sampleValue(this.definition.scale0, t, 1)
      const width = birthScale[0] * particle.randomScale[0] * scale[0] * 0.5
      const height = this.definition.isUniformScale
        ? width
        : (birthScale[1] || birthScale[0]) *
          (particle.randomScale[1] || particle.randomScale[0]) *
          (scale[1] || scale[0]) *
          0.5
      const vertex = written * 4
      positions.setXYZ(
        vertex,
        position.x - right.x * width - up.x * height,
        position.y - right.y * width - up.y * height,
        position.z - right.z * width - up.z * height,
      )
      positions.setXYZ(
        vertex + 1,
        position.x + right.x * width - up.x * height,
        position.y + right.y * width - up.y * height,
        position.z + right.z * width - up.z * height,
      )
      positions.setXYZ(
        vertex + 2,
        position.x - right.x * width + up.x * height,
        position.y - right.y * width + up.y * height,
        position.z - right.z * width + up.z * height,
      )
      positions.setXYZ(
        vertex + 3,
        position.x + right.x * width + up.x * height,
        position.y + right.y * width + up.y * height,
        position.z + right.z * width + up.z * height,
      )
      const [red, green, blue, alpha] = this.colorAt(t)
      for (let corner = 0; corner < 4; corner += 1) {
        colors.setXYZW(vertex + corner, red, green, blue, alpha)
      }
      written += 1
    }

    positions.needsUpdate = true
    colors.needsUpdate = true
    geometry.setDrawRange(0, written * 6)
  }
}

interface EffectRuntime {
  bone: THREE.Object3D
  emitters: EmitterRuntime[]
}

function findBone(model: THREE.Object3D, name: string | undefined): THREE.Object3D {
  if (!name) return model
  const wanted = name.trim().toLowerCase()
  let found: THREE.Object3D | undefined
  model.traverse((object) => {
    if (!found && object.name.trim().toLowerCase() === wanted) found = object
  })
  return found ?? model
}

function isTrailPrimitive(definition: VfxEmitterDef): boolean {
  const type = definition.primitive?.__type ?? ''
  return type === 'VfxPrimitiveCameraTrail' || type === 'VfxPrimitiveArbitraryTrail'
}

/**
 * Primitives with a faithful runtime representation. Anything else (rays,
 * beams, meshes, projections) is dropped: a wrong stand-in — Nocturne's
 * chest rays as giant billboards, say — is worse than its absence.
 */
function isSupportedPrimitive(definition: VfxEmitterDef): boolean {
  const type = definition.primitive?.__type ?? ''
  return (
    isTrailPrimitive(definition) ||
    type === '' ||
    type === 'VfxPrimitiveCameraQuad' ||
    type === 'VfxPrimitiveArbitraryQuad' ||
    type === 'VfxPrimitiveCameraUnitQuad'
  )
}

/**
 * Builds the live emitters for one model instance and mounts their meshes as
 * children of the model root, so layers, warm-up parking, and the portrait
 * transform all apply without special cases.
 */
export function createChampionIdleVfx(
  model: THREE.Object3D,
  asset: ChampionIdleVfxAsset,
): ChampionIdleVfxInstance | undefined {
  const effects: EffectRuntime[] = []
  const group = new THREE.Group()
  group.name = 'bb-idle-vfx'
  group.userData.bbIdleVfx = true

  for (const effect of asset.manifest.effects ?? []) {
    const emitters: EmitterRuntime[] = []
    for (const definition of effect.emitters ?? []) {
      if (!isSupportedPrimitive(definition)) continue
      try {
        emitters.push(
          isTrailPrimitive(definition)
            ? new TrailEmitterRuntime(definition, asset)
            : new QuadEmitterRuntime(definition, asset),
        )
      } catch {
        // One malformed emitter must not take down the rest of the effect.
      }
    }
    if (emitters.length === 0) continue
    emitters.forEach((emitter) => group.add(emitter.mesh))
    effects.push({ bone: findBone(model, effect.bone), emitters })
  }
  if (effects.length === 0) return undefined
  model.add(group)
  model.updateMatrixWorld(true)

  const modelInverse = new THREE.Matrix4()
  const boneToModel = new THREE.Matrix4()
  const boneScale = new THREE.Vector3()
  const cameraWorld = new THREE.Vector3()
  const cameraQuaternion = new THREE.Quaternion()
  const context: FrameContext = {
    boneToModel,
    bonePosition: new THREE.Vector3(),
    boneQuaternion: new THREE.Quaternion(),
    cameraPosition: new THREE.Vector3(),
    cameraForward: new THREE.Vector3(0, 0, 1),
    orthographic: true,
  }

  function update(delta: number, camera?: THREE.Camera): void {
    modelInverse.copy(model.matrixWorld).invert()
    if (camera) {
      camera.getWorldPosition(cameraWorld)
      context.cameraPosition.copy(cameraWorld).applyMatrix4(modelInverse)
      camera.getWorldQuaternion(cameraQuaternion)
      context.cameraForward
        .set(0, 0, -1)
        .applyQuaternion(cameraQuaternion)
        .transformDirection(modelInverse)
      context.orthographic = (camera as THREE.OrthographicCamera).isOrthographicCamera === true
    }
    for (const effect of effects) {
      boneToModel.multiplyMatrices(modelInverse, effect.bone.matrixWorld)
      boneToModel.decompose(context.bonePosition, context.boneQuaternion, boneScale)
      for (const emitter of effect.emitters) {
        emitter.update(delta, context)
      }
    }
  }

  function dispose(): void {
    effects.forEach((effect) => effect.emitters.forEach((emitter) => emitter.dispose()))
    effects.length = 0
    group.removeFromParent()
  }

  return { dispose, update }
}
