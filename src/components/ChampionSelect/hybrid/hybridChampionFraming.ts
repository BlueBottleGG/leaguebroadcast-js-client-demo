import * as THREE from 'three'

export const PORTRAIT_FACE_SCREEN_Y = 0.27
const PORTRAIT_FACE_SCREEN_Y_MAX = 0.36
const PORTRAIT_SEMANTIC_HEIGHT_SCALE = 0.6
const IDLE_SAMPLE_COUNT = 24

export type ChampionPortraitAnchorSource = 'buffbone' | 'head' | 'neck' | 'bounds'

export interface ChampionPortraitFraming {
  cameraDepth: number
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

interface SemanticScaleAnchors {
  ground?: THREE.Object3D
  overhead?: THREE.Object3D
}

function normalizedName(object: THREE.Object3D): string {
  return object.name.trim().toLowerCase()
}

function averageIdleWorldPositions(
  model: THREE.Object3D,
  objects: THREE.Object3D[],
  idleClip: THREE.AnimationClip | undefined,
): THREE.Vector3[] {
  const fallbacks = objects.map((object) => object.getWorldPosition(new THREE.Vector3()))
  if (!idleClip || idleClip.duration <= 0) return fallbacks

  const transforms: Array<{
    object: THREE.Object3D
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
  }> = []
  model.traverse((object) => {
    transforms.push({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    })
  })

  const mixer = new THREE.AnimationMixer(model)
  const averages = objects.map(() => new THREE.Vector3())
  const sampleCounts = objects.map(() => 0)
  const sample = new THREE.Vector3()

  try {
    mixer.clipAction(idleClip).play()
    for (let index = 0; index < IDLE_SAMPLE_COUNT; index += 1) {
      mixer.setTime((idleClip.duration * (index + 0.5)) / IDLE_SAMPLE_COUNT)
      model.updateMatrixWorld(true)
      objects.forEach((object, objectIndex) => {
        object.getWorldPosition(sample)
        if (![sample.x, sample.y, sample.z].every(Number.isFinite)) return
        averages[objectIndex]!.add(sample)
        sampleCounts[objectIndex] = sampleCounts[objectIndex]! + 1
      })
    }
  } finally {
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
    transforms.forEach(({ object, position, quaternion, scale }) => {
      object.position.copy(position)
      object.quaternion.copy(quaternion)
      object.scale.copy(scale)
    })
    model.updateMatrixWorld(true)
  }

  return averages.map((average, index) =>
    sampleCounts[index]! > 0 ? average.multiplyScalar(1 / sampleCounts[index]!) : fallbacks[index]!,
  )
}

function findChampionPortraitScaleAnchors(model: THREE.Object3D): SemanticScaleAnchors {
  let ground: THREE.Object3D | undefined
  let overhead: THREE.Object3D | undefined

  model.traverse((object) => {
    const name = normalizedName(object)
    if (!ground && (name === 'buffbone_glb_ground_loc' || name === 'c_buffbone_glb_ground_loc')) {
      ground = object
    } else if (
      !overhead &&
      (name === 'c_buffbone_glb_overhead_loc' || name === 'buffbone_glb_overhead_loc')
    ) {
      overhead = object
    }
  })

  return { ground, overhead }
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
  const scaleAnchors = findChampionPortraitScaleAnchors(model)
  let anchor = namedAnchor?.object
  const source: ChampionPortraitAnchorSource = namedAnchor?.source ?? 'bounds'

  if (!anchor) {
    const worldFallback = new THREE.Vector3(
      center.x,
      bounds.isEmpty() ? center.y + size.y * 0.22 : bounds.min.y + size.y * 0.72,
      center.z,
    )
    anchor = new THREE.Object3D()
    anchor.name = 'champion-portrait-bounds-anchor'
    anchor.position.copy(model.worldToLocal(worldFallback))
    model.add(anchor)
    model.updateMatrixWorld(true)
  }

  const sampleObjects = [anchor]
  if (scaleAnchors.ground) sampleObjects.push(scaleAnchors.ground)
  if (scaleAnchors.overhead) sampleObjects.push(scaleAnchors.overhead)
  const averagePositions = averageIdleWorldPositions(model, sampleObjects, idleClip)
  const referenceAnchor = averagePositions[0]!
  let sampleIndex = 1
  const averageGround = scaleAnchors.ground ? averagePositions[sampleIndex++] : undefined
  const averageOverhead = scaleAnchors.overhead ? averagePositions[sampleIndex] : undefined
  const heightBelowAnchor = bounds.isEmpty() ? size.y * 0.72 : referenceAnchor.y - bounds.min.y
  const bodyHeight = THREE.MathUtils.clamp(
    heightBelowAnchor > 0 ? heightBelowAnchor : size.y * 0.68,
    Math.max(size.y * 0.35, 0.7),
    Math.max(size.y * 0.88, 0.9),
  )
  let portraitHeight = Math.max(0.9, bodyHeight * (source === 'bounds' ? 0.86 : 0.78))
  if (source === 'neck') referenceAnchor.y += bodyHeight * 0.12

  const semanticHeight = averageGround && averageOverhead ? averageOverhead.y - averageGround.y : 0
  let faceScreenY = PORTRAIT_FACE_SCREEN_Y
  if (Number.isFinite(semanticHeight) && semanticHeight > 0) {
    portraitHeight = Math.max(portraitHeight, semanticHeight * PORTRAIT_SEMANTIC_HEIGHT_SCALE)
    faceScreenY = THREE.MathUtils.clamp(
      (averageOverhead!.y - referenceAnchor.y) / semanticHeight,
      PORTRAIT_FACE_SCREEN_Y,
      PORTRAIT_FACE_SCREEN_Y_MAX,
    )
  }

  return {
    cameraDepth: Math.max(10, size.z * 2 + 4),
    faceScreenY,
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
  const halfHeight = framing.portraitHeight / 2
  const halfWidth = halfHeight * Math.max(aspect, 0.1)
  camera.left = -halfWidth
  camera.right = halfWidth
  camera.top = halfHeight
  camera.bottom = -halfHeight
  camera.updateProjectionMatrix()

  framing.target.copy(framing.referenceAnchor)
  framing.target.y -= framing.portraitHeight * (0.5 - framing.faceScreenY)
  camera.position.set(
    framing.referenceAnchor.x,
    framing.target.y,
    framing.referenceAnchor.z + framing.cameraDepth,
  )
  camera.lookAt(framing.target)
  camera.updateMatrixWorld(true)
}
