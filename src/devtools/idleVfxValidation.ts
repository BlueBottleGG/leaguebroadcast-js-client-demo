// Dev-only harness: animates a champion GLB (with its embedded idle-VFX
// manifest) exactly the way the hybrid portrait layer would, and captures
// timed frames so the mist trails can be eyeballed / diffed headlessly.
//
// Usage (against the backend-hosted dev server, e.g. via headless-Chrome CDP):
//   const mod = await import('/src/devtools/idleVfxValidation.ts')
//   const metricsJson = await mod.runIdleVfxValidation('/devtools/nocturne-vfx.glb')
// Captured PNG data URLs land on window.__vfxFrames keyed by capture time.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  createChampionPortraitFraming,
  updateChampionPortraitCamera,
} from '../components/ChampionSelect/hybrid/hybridChampionFraming'
import { playChampionModelAnimation } from '../components/ChampionSelect/model/championModelRuntime'
import {
  createChampionIdleVfx,
  parseChampionIdleVfx,
} from '../components/ChampionSelect/model/championVfxRuntime'

const WORLD_SCALE = 0.0175
const CELL_HEIGHT = 480
const ASPECT = 0.7
const STEP = 1 / 60

export async function runIdleVfxValidation(
  url: string,
  captureTimes: number[] = [0.75, 2, 4],
): Promise<string> {
  document.body.innerHTML = ''
  document.body.style.cssText = 'margin:0;background:#0c141c;font:12px monospace;color:#dfe8f0'

  const width = Math.round(CELL_HEIGHT * ASPECT)
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setSize(width, CELL_HEIGHT, false)
  renderer.setClearColor(0x141c26, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  document.body.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const ambient = new THREE.HemisphereLight(0xe8f0ff, 0x080b10, 1.15)
  const key = new THREE.DirectionalLight(0xffffff, 2.0)
  key.position.set(-4, 7, 9)
  const fill = new THREE.DirectionalLight(0xbfd7ff, 1.0)
  fill.position.set(5, 3, 7)
  scene.add(ambient, key, fill)

  // Fetch + parse instead of GLTFLoader.load: clearer errors, no loader cache.
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GLB fetch failed: ${response.status}`)
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
  const idleVfxAsset = parseChampionIdleVfx(gltf)
  const model = gltf.scene
  model.scale.multiplyScalar(WORLD_SCALE)
  scene.add(model)
  model.updateMatrixWorld(true)

  const asset = { animations: gltf.animations, idleVfx: idleVfxAsset, scene: gltf.scene }
  const idleVfx = idleVfxAsset ? createChampionIdleVfx(model, idleVfxAsset) : undefined
  const instance = { alias: 'harness', asset, idleVfx, model, ownedMaterials: [] }
  const playback = playChampionModelAnimation(instance, false)

  const framing = createChampionPortraitFraming(
    model,
    gltf.animations.find((clip) => clip.name.toLowerCase() === 'bb_idle'),
  )
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  updateChampionPortraitCamera(camera, framing, ASPECT)

  const frames: Record<string, string> = {}
  ;(window as unknown as { __vfxFrames: Record<string, string> }).__vfxFrames = frames

  // Ramp textures decode asynchronously; give them a beat before simulating.
  await new Promise((resolve) => setTimeout(resolve, 300))

  const totalTime = Math.max(...captureTimes) + STEP
  let nextCapture = 0
  let vfxTriangles = 0
  for (let time = 0; time < totalTime; time += STEP) {
    playback.update(STEP, camera)
    renderer.render(scene, camera)
    if (nextCapture < captureTimes.length && time >= captureTimes[nextCapture]!) {
      frames[captureTimes[nextCapture]!.toFixed(2)] = renderer.domElement.toDataURL('image/png')
      nextCapture += 1
      vfxTriangles = renderer.info.render.triangles
    }
  }

  // VFX-only capture: hide the body so the particle contribution is unambiguous.
  const bodyMeshes: THREE.Object3D[] = []
  model.traverse((object) => {
    if (!object.userData.bbIdleVfx && object instanceof THREE.Mesh) bodyMeshes.push(object)
  })
  bodyMeshes.forEach((mesh) => (mesh.visible = false))
  renderer.render(scene, camera)
  frames['vfx-only'] = renderer.domElement.toDataURL('image/png')

  // Per-emitter isolation frames: exactly one emitter visible at a time.
  const vfxMeshes: THREE.Mesh[] = []
  model.traverse((object) => {
    if (object.userData.bbIdleVfx && object instanceof THREE.Mesh) vfxMeshes.push(object)
  })
  vfxMeshes.forEach((mesh, index) => {
    vfxMeshes.forEach((other) => (other.visible = other === mesh))
    renderer.render(scene, camera)
    frames[`solo-${index}-${mesh.name.replace('bb-idle-vfx-', '')}`] =
      renderer.domElement.toDataURL('image/png')
  })
  vfxMeshes.forEach((mesh) => (mesh.visible = true))
  bodyMeshes.forEach((mesh) => (mesh.visible = true))

  const emitterMeshes: Array<Record<string, unknown>> = []
  model.traverse((object) => {
    if (object.userData.bbIdleVfx && object instanceof THREE.Mesh) {
      const geometry = object.geometry
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute
      const colors = geometry.getAttribute('color') as THREE.BufferAttribute
      const index = geometry.getIndex()!
      const bounds = new THREE.Box3()
      let peak = 0
      const probe = new THREE.Vector3()
      for (let i = 0; i < geometry.drawRange.count; i += 1) {
        const vertex = index.getX(i)
        bounds.expandByPoint(probe.set(positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)))
        peak = Math.max(peak, colors.getX(vertex) + colors.getY(vertex) + colors.getZ(vertex))
      }
      const material = object.material as THREE.MeshBasicMaterial
      const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute
      const image = material.map?.source.data as { width?: number; height?: number } | undefined
      const tri: number[][] = []
      for (let i = 0; i < Math.min(3, geometry.drawRange.count); i += 1) {
        const vertex = index.getX(i)
        tri.push([
          Number(positions.getX(vertex).toFixed(1)),
          Number(positions.getY(vertex).toFixed(1)),
          Number(positions.getZ(vertex).toFixed(1)),
          Number(uvs.getX(vertex).toFixed(2)),
          Number(uvs.getY(vertex).toFixed(2)),
          Number(colors.getX(vertex).toFixed(2)),
          Number(colors.getW(vertex).toFixed(2)),
        ])
      }
      emitterMeshes.push({
        name: object.name,
        draw: geometry.drawRange.count,
        min: bounds.min.toArray().map((v) => Number(v.toFixed(1))),
        max: bounds.max.toArray().map((v) => Number(v.toFixed(1))),
        peakRgbSum: Number(peak.toFixed(3)),
        mapSize: image ? `${image.width}x${image.height}` : 'none',
        tri,
      })
    }
  })

  playback.dispose()
  idleVfx?.dispose()
  renderer.dispose()
  return JSON.stringify({
    effects: idleVfxAsset?.manifest.effects?.length ?? 0,
    emitterMeshes,
    frames: Object.keys(frames),
    portraitHeight: Number(framing.portraitHeight.toFixed(3)),
    source: framing.source,
    triangles: vfxTriangles,
  })
}
