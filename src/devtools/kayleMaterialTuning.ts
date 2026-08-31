// Dev-only harness: renders Kayle once per candidate material profile so the
// backend's Kayle_Body ChampionMaterialProfile (metallic/emissive) can be tuned
// against the hybrid layer's real lighting rig before changing the converter.
//
// Usage (against the backend-hosted dev server, via headless-Chrome CDP):
//   const mod = await import('/src/devtools/kayleMaterialTuning.ts')
//   const metricsJson = await mod.runKayleMaterialTuning([
//     { label: 'current', metallic: 0, emissive: [0.032, 0.03, 0.018] },
//     ...
//   ])
// The composited grid is exposed as a PNG data URL on window.__kayleTuningGrid.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  createChampionPortraitFraming,
  updateChampionPortraitCamera,
} from '../components/ChampionSelect/hybrid/hybridChampionFraming'

const API_BASE = 'http://localhost:58869/api'
const CELL_HEIGHT = 700
const CELL_ASPECT = 0.85
const WORLD_SCALE = 0.0175
const BODY_MATERIALS = new Set(['level1', 'Kayle_Base_Body_Mat'])

export interface KayleProfileCandidate {
  label: string
  metallic: number
  emissive: [number, number, number]
  roughness?: number
}

async function loadKayle(loader: GLTFLoader) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(`${API_BASE}/pregame/models/Kayle/status`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const status = (await response.json()) as {
      status: string
      version?: string
      contentUrl?: string
    }
    if (status.status === 'ready') {
      const url = new URL(status.contentUrl ?? `${API_BASE}/pregame/models/Kayle/content`, API_BASE)
      if (status.version) url.searchParams.set('v', status.version)
      return await loader.loadAsync(url.toString())
    }
    if (status.status === 'failed' || status.status === 'unavailable') {
      throw new Error(`model ${status.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('model build timeout')
}

// Mirrors prepareChampionModelInstance in championModelRuntime.ts so candidates
// are judged under the exact material state the live layer renders.
function applyClientMaterialPrep(model: THREE.Object3D): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.frustumCulled = false
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.roughness = Math.min(material.roughness, 0.6)
      }
      if (material.transparent) {
        material.transparent = false
        material.opacity = 1
        material.alphaTest = Math.max(material.alphaTest, 0.08)
        material.alphaToCoverage = true
        material.depthWrite = true
      }
      material.needsUpdate = true
    })
  })
}

function applyCandidate(model: THREE.Object3D, candidate: KayleProfileCandidate): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return
      if (!BODY_MATERIALS.has(material.name)) return
      material.metalness = candidate.metallic
      material.emissive.setRGB(...candidate.emissive)
      if (candidate.roughness !== undefined) {
        material.roughness = Math.min(candidate.roughness, 0.6)
      }
      material.needsUpdate = true
    })
  })
}

export async function runKayleMaterialTuning(
  candidates: KayleProfileCandidate[],
  modelUrl?: string,
): Promise<string> {
  document.body.innerHTML = ''
  document.body.style.cssText = 'margin:0;background:#0c141c;font:12px monospace;color:#dfe8f0'

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x1a2733, 1)
  // Exact copy of HybridChampionModelLayer's output pipeline.
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = false

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environmentTarget = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = 0.3
  const ambient = new THREE.HemisphereLight(0xe8f0ff, 0x080b10, 1.15)
  const key = new THREE.DirectionalLight(0xffffff, 2.0)
  key.position.set(-4, 7, 9)
  const fill = new THREE.DirectionalLight(0xbfd7ff, 1.0)
  fill.position.set(5, 3, 7)
  scene.add(ambient, key, fill)

  const gltf = modelUrl
    ? await new GLTFLoader().loadAsync(modelUrl)
    : await loadKayle(new GLTFLoader())
  const model = gltf.scene
  model.rotation.y = 0
  model.scale.multiplyScalar(WORLD_SCALE)
  applyClientMaterialPrep(model)
  scene.add(model)
  model.updateMatrixWorld(true)

  const idle = gltf.animations.find((clip) => clip.name.toLowerCase() === 'bb_idle')
  const framing = createChampionPortraitFraming(model, idle)
  if (idle) {
    const mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(idle).play()
    mixer.setTime(idle.duration * 0.3)
    model.updateMatrixWorld(true)
  }

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  const width = Math.round(CELL_HEIGHT * CELL_ASPECT)
  updateChampionPortraitCamera(camera, framing, CELL_ASPECT)

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:10px;'
  document.body.appendChild(row)

  const cells: Array<{ canvas: HTMLCanvasElement; label: string }> = []
  for (const candidate of candidates) {
    applyCandidate(model, candidate)
    renderer.setSize(width, CELL_HEIGHT, false)
    renderer.render(scene, camera)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = CELL_HEIGHT
    canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0)
    const cell = document.createElement('div')
    canvas.style.cssText = 'display:block;outline:1px solid #33475a'
    const caption = document.createElement('div')
    caption.textContent = candidate.label
    cell.appendChild(canvas)
    cell.appendChild(caption)
    row.appendChild(cell)
    cells.push({ canvas, label: candidate.label })
  }

  const captionHeight = 24
  const composite = document.createElement('canvas')
  composite.width = cells.reduce((total, cell) => total + cell.canvas.width + 6, 0)
  composite.height = CELL_HEIGHT + captionHeight
  const context = composite.getContext('2d')!
  context.fillStyle = '#0c141c'
  context.fillRect(0, 0, composite.width, composite.height)
  context.fillStyle = '#dfe8f0'
  context.font = '14px monospace'
  let offsetX = 0
  cells.forEach((cell) => {
    context.drawImage(cell.canvas, offsetX, 0)
    context.fillText(cell.label, offsetX + 4, CELL_HEIGHT + 16)
    offsetX += cell.canvas.width + 6
  })
  ;(window as unknown as { __kayleTuningGrid: string }).__kayleTuningGrid =
    composite.toDataURL('image/png')

  renderer.dispose()
  environmentTarget.dispose()
  return JSON.stringify(candidates.map((candidate) => candidate.label))
}
