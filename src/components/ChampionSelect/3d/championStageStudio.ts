import * as THREE from 'three'
import type { StageSide } from './championStageState'
import {
  BLUE,
  CHAMPION_STAGE_LIGHTING,
  MODEL_WARMUP_LAYER,
  RED,
  STUDIO_FLOOR_TEXTURE_URL,
} from './championStageConfig'

type Disposable = { dispose: () => void }
type TrackStageResource = <T extends Disposable>(resource: T) => T

export interface ChampionStageStudioTextures {
  banStatus: THREE.Texture
  lane: THREE.Texture
  spinner: THREE.Texture
}

export interface ChampionStageStudioRuntime {
  banStatusDisplay: THREE.Mesh
  banWallParents: Map<StageSide, THREE.Group>
  laneDisplay: THREE.Mesh
  spinnerDisplay: THREE.Mesh
}

export interface CreateChampionStageStudioOptions {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  textures: ChampionStageStudioTextures
  trackResource: TrackStageResource
}

function sideColor(side: StageSide): THREE.Color {
  return side === 'blue' ? BLUE : RED
}

function createStudioMaterial(
  trackResource: TrackStageResource,
  color: THREE.ColorRepresentation,
  roughness = 0.78,
  metalness = 0.18,
): THREE.MeshStandardMaterial {
  return trackResource(new THREE.MeshStandardMaterial({ color, roughness, metalness }))
}

function createFloorTexture(
  renderer: THREE.WebGLRenderer,
  trackResource: TrackStageResource,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(STUDIO_FLOOR_TEXTURE_URL)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.4, 1.1)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
  return trackResource(texture)
}

function createCenterWallTexture(trackResource: TrackStageResource): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create center wall texture')

  context.fillStyle = '#101218'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const glow = context.createRadialGradient(256, 330, 20, 256, 330, 390)
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
  glow.addColorStop(0.42, 'rgba(255, 255, 255, 0.075)')
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return trackResource(texture)
}

function createDisplay(
  trackResource: TrackStageResource,
  width: number,
  height: number,
  texture: THREE.Texture,
  position: readonly [number, number, number],
  renderOrder: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    trackResource(new THREE.PlaneGeometry(width, height)),
    trackResource(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  )
  mesh.position.set(...position)
  mesh.renderOrder = renderOrder
  return mesh
}

/** Build the static studio shell and return the few surfaces updated at runtime. */
export function createChampionStageStudio({
  renderer,
  scene,
  textures,
  trackResource,
}: CreateChampionStageStudioOptions): ChampionStageStudioRuntime {
  const floor = new THREE.Mesh(
    trackResource(new THREE.PlaneGeometry(44, 34)),
    trackResource(
      new THREE.MeshStandardMaterial({
        color: 0x70747c,
        map: createFloorTexture(renderer, trackResource),
        roughness: 0.92,
        metalness: 0.025,
      }),
    ),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -4)
  floor.receiveShadow = true
  scene.add(floor)

  const backWall = new THREE.Mesh(
    trackResource(new THREE.PlaneGeometry(44, 14)),
    createStudioMaterial(trackResource, 0x090b10, 0.82, 0.14),
  )
  backWall.position.set(0, 5.6, -12.6)
  backWall.receiveShadow = true
  scene.add(backWall)

  const centerPanel = new THREE.Mesh(
    trackResource(new THREE.BoxGeometry(6.1, 10.85, 0.2)),
    trackResource(new THREE.MeshBasicMaterial({ map: createCenterWallTexture(trackResource) })),
  )
  centerPanel.position.set(0, 5.4, -12.47)
  centerPanel.receiveShadow = true
  scene.add(centerPanel)

  const spinnerDisplay = createDisplay(
    trackResource,
    3.35,
    3.35,
    textures.spinner,
    [0, 6.4, -12.22],
    3,
  )
  const laneDisplay = createDisplay(trackResource, 1.8, 1.8, textures.lane, [0, 3.85, -12.2], 4)
  const banStatusDisplay = createDisplay(
    trackResource,
    4.8,
    1.2,
    textures.banStatus,
    [0, 3.85, -12.14],
    6,
  )
  scene.add(spinnerDisplay, laneDisplay, banStatusDisplay)

  const banWallParents = new Map<StageSide, THREE.Group>()
  for (const side of ['blue', 'red'] as const) {
    const direction = side === 'blue' ? -1 : 1
    const color = sideColor(side)
    const wing = new THREE.Group()
    wing.position.set(direction * 3.05, 0, -12.42)
    wing.rotation.y = -direction * THREE.MathUtils.degToRad(11.5)

    const teamWall = new THREE.Mesh(
      trackResource(new THREE.BoxGeometry(14.8, 10.85, 0.18)),
      createStudioMaterial(trackResource, side === 'blue' ? 0x09121f : 0x1c0a10, 0.9, 0.06),
    )
    teamWall.position.set(direction * 7.4, 5.4, 0)
    teamWall.receiveShadow = true
    wing.add(teamWall)

    for (let index = 0; index < 5; index += 1) {
      const panelX = direction * (1.3 + index * 2.48)
      const wallPanel = new THREE.Mesh(
        trackResource(new THREE.BoxGeometry(2.12, 8.75, 0.09)),
        createStudioMaterial(trackResource, side === 'blue' ? 0x101d31 : 0x2a1018, 0.92, 0.04),
      )
      wallPanel.position.set(panelX, 5.67, 0.15)
      wallPanel.receiveShadow = true
      wing.add(wallPanel)
    }

    const lightBarMaterial = trackResource(
      new THREE.MeshStandardMaterial({
        color: 0x090b0f,
        emissive: color,
        emissiveIntensity: 3.6,
        roughness: 0.28,
        metalness: 0.08,
        toneMapped: false,
      }),
    )
    const lightBarGlowMaterial = trackResource(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    for (let index = 0; index < 6; index += 1) {
      const x = direction * (0.07 + index * 2.48)
      const lightBar = new THREE.Mesh(
        trackResource(new THREE.BoxGeometry(0.065, 8.45, 0.07)),
        lightBarMaterial,
      )
      lightBar.position.set(x, 5.67, 0.25)
      wing.add(lightBar)

      const glow = new THREE.Mesh(
        trackResource(new THREE.PlaneGeometry(0.28, 8.65)),
        lightBarGlowMaterial,
      )
      glow.position.set(x, 5.67, 0.295)
      glow.renderOrder = 1
      wing.add(glow)
    }

    for (const y of [0.16, 10.7]) {
      const rail = new THREE.Mesh(
        trackResource(new THREE.BoxGeometry(14.9, 0.22, 0.34)),
        createStudioMaterial(trackResource, 0x20232b, 0.52, 0.42),
      )
      rail.position.set(direction * 7.4, y, 0.2)
      wing.add(rail)
    }

    banWallParents.set(side, wing)
    scene.add(wing)
  }

  const centerHeader = new THREE.Mesh(
    trackResource(new THREE.BoxGeometry(6.2, 0.22, 0.34)),
    createStudioMaterial(trackResource, 0x151820, 0.56, 0.42),
  )
  centerHeader.position.set(0, 10.72, -12.27)
  scene.add(centerHeader)

  return { banStatusDisplay, banWallParents, laneDisplay, spinnerDisplay }
}

function createSpotLight(config: {
  color: THREE.ColorRepresentation
  intensity: number
  distance: number
  angle: number
  penumbra: number
  decay: number
}): THREE.SpotLight {
  return new THREE.SpotLight(
    config.color,
    config.intensity,
    config.distance,
    config.angle,
    config.penumbra,
    config.decay,
  )
}

/** Add the fixed production light rig; no draft action changes the light count. */
export function addChampionStageLighting(scene: THREE.Scene): void {
  const lighting = CHAMPION_STAGE_LIGHTING
  scene.add(
    new THREE.HemisphereLight(
      lighting.ambient.sky,
      lighting.ambient.ground,
      lighting.ambient.intensity,
    ),
  )

  const key = createSpotLight(lighting.key)
  key.position.set(...lighting.key.position)
  key.target.position.set(...lighting.key.target)
  key.castShadow = true
  key.shadow.mapSize.set(lighting.key.shadowMapSize, lighting.key.shadowMapSize)
  key.shadow.camera.near = lighting.key.shadowNear
  key.shadow.camera.far = lighting.key.shadowFar
  key.shadow.bias = lighting.key.shadowBias
  scene.add(key, key.target)

  // Match the production light/shader variant without rasterizing the 2048px
  // shadow map when detached champion models are compiled.
  const warmupKey = createSpotLight(lighting.key)
  warmupKey.position.copy(key.position)
  warmupKey.target.position.copy(key.target.position)
  warmupKey.castShadow = true
  warmupKey.shadow.mapSize.set(1, 1)
  warmupKey.shadow.camera.near = key.shadow.camera.near
  warmupKey.shadow.camera.far = key.shadow.camera.far
  warmupKey.shadow.bias = key.shadow.bias
  warmupKey.layers.set(MODEL_WARMUP_LAYER)
  warmupKey.target.layers.set(MODEL_WARMUP_LAYER)
  scene.add(warmupKey, warmupKey.target)

  const fill = createSpotLight(lighting.fill)
  fill.position.set(...lighting.fill.position)
  fill.target.position.set(...lighting.fill.target)
  scene.add(fill, fill.target)

  for (const side of ['blue', 'red'] as const) {
    const direction = side === 'blue' ? -1 : 1
    const actorFill = createSpotLight({
      ...lighting.actorFill,
      color: side === 'blue' ? lighting.actorFill.blueColor : lighting.actorFill.redColor,
    })
    actorFill.position.set(
      direction * lighting.actorFill.x,
      lighting.actorFill.y,
      lighting.actorFill.z,
    )
    actorFill.target.position.set(
      direction * lighting.actorFill.x,
      lighting.actorFill.targetY,
      lighting.actorFill.targetZ,
    )
    scene.add(actorFill, actorFill.target)

    const rim = createSpotLight({ ...lighting.teamRim, color: sideColor(side) })
    rim.position.set(direction * lighting.teamRim.x, lighting.teamRim.y, lighting.teamRim.z)
    rim.target.position.set(
      direction * lighting.teamRim.x * lighting.teamRim.targetXRatio,
      lighting.teamRim.targetY,
      lighting.teamRim.targetZ,
    )
    scene.add(rim, rim.target)
  }

  const wallWash = createSpotLight(lighting.wallWash)
  wallWash.position.set(...lighting.wallWash.position)
  wallWash.target.position.set(...lighting.wallWash.target)
  scene.add(wallWash, wallWash.target)

  scene.traverse((object) => {
    if (!(object instanceof THREE.Light)) return
    if (object === key) object.layers.set(0)
    else if (object !== warmupKey) object.layers.enable(MODEL_WARMUP_LAYER)
  })
}
