import * as THREE from 'three'

export const PORTRAIT_FACE_SCREEN_Y = 0.27
export const PORTRAIT_FACE_SCREEN_Y_MAX = 0.52
const CROWN_MASS_QUANTILE = 0.88
const IDLE_POSE_SAMPLES = 8
const MAX_VERTEX_SAMPLES_PER_MESH = 400
const MIN_GEOMETRY_SAMPLES = 24
const WIDTH_MASS_FRACTION = 0.84
const HEIGHT_MASS_FRACTION = 0.97
const MIN_BODY_HEIGHT_COVERAGE = 0.62
const MAX_PORTRAIT_OVERSHOOT = 1.3
const CROWN_MARGIN = 0.03
const GROUND_MARGIN = 0.04
// League animations hide sheathed weapons/alt geometry by parking their bones
// hundreds of units below the map floor (Akali: ~-9 world units). Nothing that
// deep is ever portrait subject — drop it before measuring body mass.
const SUB_GROUND_CUTOFF = -2
// A body whose mass floor sits this far above the ground plane is hovering
// (Nocturne); frame down to the ground under it, not to the floating mass.
const FLOATING_BODY_THRESHOLD = 1
const FACE_CENTER_BAND = 0.25
// All models share one world scale and ground plane, so this is a standard
// broadcast camera field: small champions (yordles, Amumu) are framed at this
// distance — roughly full body plus breathing room — instead of having their
// tiny bodies fill the portrait like a monster-sized closeup.
const MIN_FRAME_HEIGHT = 1.9

export type ChampionPortraitAnchorSource = 'buffbone' | 'head' | 'neck' | 'bounds'

export interface ChampionPortraitFraming {
  bodyCenterX: number
  bodyHalfWidth: number
  bodyMaxY: number
  bodyMinY: number
  cameraDepth: number
  crownY: number
  faceScreenY: number
  portraitHeight: number
  referenceAnchor: THREE.Vector3
  source: ChampionPortraitAnchorSource
  target: THREE.Vector3
}

interface NamedAnchor {
  object: THREE.Object3D
  source: Exclude<ChampionPortraitAnchorSource, 'bounds'>
}

interface PortraitGeometrySample {
  positions: THREE.Vector3[]
  xs: number[]
  ys: number[]
}

function normalizedName(object: THREE.Object3D): string {
  return object.name.trim().toLowerCase()
}

function samplePortraitGeometry(
  model: THREE.Object3D,
  objects: THREE.Object3D[],
  idleClip: THREE.AnimationClip | undefined,
): PortraitGeometrySample {
  const meshes: THREE.Mesh[] = []
  model.traverseVisible((object) => {
    // Idle-VFX ribbons hold pre-allocated zeroed buffers and drift beyond the
    // body; sampling them would drag the mass window toward the origin.
    if (object.userData.bbIdleVfx) return
    if (object instanceof THREE.Mesh && object.geometry.getAttribute('position')) {
      meshes.push(object)
    }
  })

  const animated = !!idleClip && idleClip.duration > 0
  const transforms: Array<{
    object: THREE.Object3D
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
  }> = []
  if (animated) {
    model.traverse((object) => {
      transforms.push({
        object,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      })
    })
  }

  const mixer = animated ? new THREE.AnimationMixer(model) : undefined
  const poseCount = animated ? IDLE_POSE_SAMPLES : 1
  const averages = objects.map(() => new THREE.Vector3())
  const sampleCounts = objects.map(() => 0)
  const fallbacks = objects.map((object) => object.getWorldPosition(new THREE.Vector3()))
  const xs: number[] = []
  const ys: number[] = []
  const sample = new THREE.Vector3()

  try {
    if (mixer && idleClip) mixer.clipAction(idleClip).play()
    for (let pose = 0; pose < poseCount; pose += 1) {
      if (mixer && idleClip) {
        mixer.setTime((idleClip.duration * (pose + 0.5)) / poseCount)
        model.updateMatrixWorld(true)
      }
      objects.forEach((object, objectIndex) => {
        object.getWorldPosition(sample)
        if (![sample.x, sample.y, sample.z].every(Number.isFinite)) return
        averages[objectIndex]!.add(sample)
        sampleCounts[objectIndex] = sampleCounts[objectIndex]! + 1
      })
      meshes.forEach((mesh) => {
        const positionCount = mesh.geometry.getAttribute('position')!.count
        const stride = Math.max(1, Math.floor(positionCount / MAX_VERTEX_SAMPLES_PER_MESH))
        for (let index = pose % stride; index < positionCount; index += stride) {
          mesh.getVertexPosition(index, sample).applyMatrix4(mesh.matrixWorld)
          if (![sample.x, sample.y, sample.z].every(Number.isFinite)) continue
          if (sample.y < SUB_GROUND_CUTOFF) continue
          xs.push(sample.x)
          ys.push(sample.y)
        }
      })
    }
  } finally {
    if (mixer) {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      transforms.forEach(({ object, position, quaternion, scale }) => {
        object.position.copy(position)
        object.quaternion.copy(quaternion)
        object.scale.copy(scale)
      })
      model.updateMatrixWorld(true)
    }
  }

  return {
    positions: averages.map((average, index) =>
      sampleCounts[index]! > 0
        ? average.multiplyScalar(1 / sampleCounts[index]!)
        : fallbacks[index]!,
    ),
    xs,
    ys,
  }
}

function massInterval(sorted: number[], fraction: number): [number, number] {
  const count = sorted.length
  if (count === 0) return [0, 0]
  const window = Math.max(1, Math.min(count, Math.ceil(count * fraction)))
  let bestStart = 0
  let bestSpan = Number.POSITIVE_INFINITY
  for (let start = 0; start + window <= count; start += 1) {
    const span = sorted[start + window - 1]! - sorted[start]!
    if (span < bestSpan) {
      bestSpan = span
      bestStart = start
    }
  }
  return [sorted[bestStart]!, sorted[bestStart + window - 1]!]
}

export function findChampionPortraitAnchor(model: THREE.Object3D): NamedAnchor | null {
  let buffbone: THREE.Object3D | undefined
  let head: THREE.Object3D | undefined
  let neck: THREE.Object3D | undefined

  model.traverse((object) => {
    const name = normalizedName(object)
    if (!buffbone && name === 'c_buffbone_glb_head_loc') buffbone = object
    else if (!head && name === 'head') head = object
    else if (!neck && (name === 'neck' || name.endsWith('_neck') || name.endsWith('neck_jnt'))) {
      neck = object
    }
  })

  if (buffbone) return { object: buffbone, source: 'buffbone' }
  if (head) return { object: head, source: 'head' }
  if (neck) return { object: neck, source: 'neck' }
  return null
}

export function createChampionPortraitFraming(
  model: THREE.Object3D,
  idleClip?: THREE.AnimationClip,
): ChampionPortraitFraming {
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model, true)
  const size = bounds.isEmpty() ? new THREE.Vector3(1, 2, 1) : bounds.getSize(new THREE.Vector3())
  const center = bounds.isEmpty()
    ? model.getWorldPosition(new THREE.Vector3())
    : bounds.getCenter(new THREE.Vector3())
  const namedAnchor = findChampionPortraitAnchor(model)
  const source: ChampionPortraitAnchorSource = namedAnchor?.source ?? 'bounds'

  const sampled = samplePortraitGeometry(model, namedAnchor ? [namedAnchor.object] : [], idleClip)
  let bodyMinX = center.x - size.x / 2
  let bodyMaxX = center.x + size.x / 2
  let bodyMinY = center.y - size.y / 2
  let bodyMaxY = center.y + size.y / 2
  let crownY = bodyMaxY
  if (sampled.xs.length >= MIN_GEOMETRY_SAMPLES) {
    sampled.xs.sort((a, b) => a - b)
    sampled.ys.sort((a, b) => a - b)
    ;[bodyMinX, bodyMaxX] = massInterval(sampled.xs, WIDTH_MASS_FRACTION)
    ;[bodyMinY, bodyMaxY] = massInterval(sampled.ys, HEIGHT_MASS_FRACTION)
    crownY = sampled.ys[Math.floor(CROWN_MASS_QUANTILE * (sampled.ys.length - 1))]!
  }
  if (bodyMinY > FLOATING_BODY_THRESHOLD) bodyMinY = 0
  const bodyHeight = Math.max(bodyMaxY - bodyMinY, 0.5)

  const referenceAnchor =
    sampled.positions[0] ??
    new THREE.Vector3((bodyMinX + bodyMaxX) / 2, bodyMinY + bodyHeight * 0.72, center.z)

  const heightBelowAnchor = referenceAnchor.y - bodyMinY
  const anchoredHeight = THREE.MathUtils.clamp(
    heightBelowAnchor > 0 ? heightBelowAnchor : bodyHeight * 0.68,
    Math.max(bodyHeight * 0.35, 0.7),
    Math.max(bodyHeight * 0.88, 0.9),
  )
  if (source === 'neck') referenceAnchor.y += anchoredHeight * 0.12

  const crownFloor =
    (crownY - referenceAnchor.y + CROWN_MARGIN * bodyHeight) / PORTRAIT_FACE_SCREEN_Y_MAX
  const coreHeight = Math.max(crownY - bodyMinY, 0.5)
  const portraitHeight = Math.max(
    MIN_FRAME_HEIGHT,
    Math.min(
      Math.max(
        anchoredHeight * (source === 'bounds' ? 0.86 : 0.78),
        coreHeight * MIN_BODY_HEIGHT_COVERAGE,
        crownFloor,
      ),
      bodyHeight * MAX_PORTRAIT_OVERSHOOT,
    ),
  )

  return {
    bodyCenterX: (bodyMinX + bodyMaxX) / 2,
    bodyHalfWidth: Math.max(bodyMaxX - bodyMinX, 0) / 2,
    bodyMaxY,
    bodyMinY,
    cameraDepth: Math.max(10, size.z * 2 + 4),
    crownY,
    faceScreenY: PORTRAIT_FACE_SCREEN_Y,
    portraitHeight,
    referenceAnchor,
    source,
    target: new THREE.Vector3(),
  }
}

export function updateChampionPortraitCamera(
  camera: THREE.OrthographicCamera,
  framing: ChampionPortraitFraming,
  aspect: number,
): void {
  const safeAspect = Math.max(aspect, 0.1)
  const bodyHeight = Math.max(framing.bodyMaxY - framing.bodyMinY, 0.5)
  const widthDrivenHeight = (framing.bodyHalfWidth * 2) / safeAspect
  const heightCap = Math.max(framing.portraitHeight, bodyHeight * MAX_PORTRAIT_OVERSHOOT)
  const frameHeight = THREE.MathUtils.clamp(widthDrivenHeight, framing.portraitHeight, heightCap)
  const halfHeight = frameHeight / 2
  const halfWidth = halfHeight * safeAspect
  camera.left = -halfWidth
  camera.right = halfWidth
  camera.top = halfHeight
  camera.bottom = -halfHeight
  camera.updateProjectionMatrix()

  const anchor = framing.referenceAnchor
  const maxFaceOffset = halfWidth * FACE_CENTER_BAND
  const bodyLeft = framing.bodyCenterX - framing.bodyHalfWidth
  const bodyRight = framing.bodyCenterX + framing.bodyHalfWidth
  // Stay centered on the face; leave it only as far as covering the body
  // window demands (asymmetric props like orbs or hammers must not drag the
  // portrait sideways when the body already fits).
  let cameraX = anchor.x
  if (framing.bodyHalfWidth > halfWidth) {
    cameraX = framing.bodyCenterX
  } else if (bodyRight > cameraX + halfWidth) {
    cameraX = bodyRight - halfWidth
  } else if (bodyLeft < cameraX - halfWidth) {
    cameraX = bodyLeft + halfWidth
  }
  cameraX = THREE.MathUtils.clamp(cameraX, anchor.x - maxFaceOffset, anchor.x + maxFaceOffset)

  let centerY = anchor.y - (0.5 - framing.faceScreenY) * frameHeight
  const crownTop = framing.crownY + CROWN_MARGIN * frameHeight
  if (centerY + halfHeight < crownTop) centerY = crownTop - halfHeight
  const groundBottom = framing.bodyMinY - GROUND_MARGIN * frameHeight
  if (centerY - halfHeight < groundBottom) centerY = groundBottom + halfHeight
  centerY = Math.min(centerY, anchor.y - (0.5 - PORTRAIT_FACE_SCREEN_Y_MAX) * frameHeight)

  framing.target.set(cameraX, centerY, anchor.z)
  camera.position.set(cameraX, centerY, anchor.z + framing.cameraDepth)
  camera.lookAt(framing.target)
  camera.updateMatrixWorld(true)
}
