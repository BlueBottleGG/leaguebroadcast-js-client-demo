// Dev-only harness: renders hybrid champion portrait framings for real backend
// models so framing changes can be eyeballed against the full roster.
//
// Usage (against the backend-hosted dev server, e.g. via headless-Chrome CDP):
//   const mod = await import('/src/devtools/framingValidation.ts')
//   const metricsJson = await mod.runFramingValidation(['Naafiri', 'Chogath'])
// Each champion's composited cells (narrow + active card aspects) are exposed as
// PNG data URLs on window.__framingRows[alias]; metrics come back as JSON.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  createChampionPortraitFraming,
  updateChampionPortraitCamera,
} from '../components/ChampionSelect/hybrid/hybridChampionFraming'

const API_BASE = 'http://localhost:58869/api'
const CELL_HEIGHT = 420
const ASPECTS = [0.55, 0.85]
const WORLD_SCALE = 0.0175

async function loadChampionModel(loader: GLTFLoader, alias: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(`${API_BASE}/pregame/models/${encodeURIComponent(alias)}/status`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const status = (await response.json()) as {
      status: string
      version?: string
      contentUrl?: string
    }
    if (status.status === 'ready') {
      const url = new URL(
        status.contentUrl ?? `${API_BASE}/pregame/models/${encodeURIComponent(alias)}/content`,
        API_BASE,
      )
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

/** List every mesh in a champion GLB with its bind-pose world bounds. */
export async function dumpChampionMeshes(alias: string): Promise<string> {
  const gltf = await loadChampionModel(new GLTFLoader(), alias)
  const model = gltf.scene
  model.scale.multiplyScalar(WORLD_SCALE)
  model.updateMatrixWorld(true)
  const rows: Array<Record<string, unknown>> = []
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const bounds = new THREE.Box3().setFromObject(object, true)
    rows.push({
      name: object.name,
      type: object.type,
      visible: object.visible,
      vertices: object.geometry.getAttribute('position')?.count ?? 0,
      min: bounds.min.toArray().map((v) => Number(v.toFixed(2))),
      max: bounds.max.toArray().map((v) => Number(v.toFixed(2))),
    })
  })
  return JSON.stringify(rows)
}

export async function runFramingValidation(aliases: string[]): Promise<string> {
  document.body.innerHTML = ''
  document.body.style.cssText = 'margin:0;background:#0c141c;font:12px monospace;color:#dfe8f0'

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x1a2733, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const ambient = new THREE.HemisphereLight(0xe8f0ff, 0x080b10, 1.65)
  const key = new THREE.DirectionalLight(0xffffff, 2.8)
  key.position.set(-4, 7, 9)
  const fill = new THREE.DirectionalLight(0xbfd7ff, 1.45)
  fill.position.set(5, 3, 7)
  scene.add(ambient, key, fill)

  const loader = new GLTFLoader()
  const metrics: Array<Record<string, unknown>> = []
  const rowImages: Record<string, string> = {}
  ;(window as unknown as { __framingRows: Record<string, string> }).__framingRows = rowImages

  for (const alias of aliases) {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:10px;'
    const label = document.createElement('div')
    label.style.cssText = 'width:90px;padding-top:8px;font-weight:bold'
    label.textContent = alias
    row.appendChild(label)
    document.body.appendChild(row)

    let gltf
    try {
      gltf = await loadChampionModel(loader, alias)
    } catch (error) {
      label.textContent = `${alias}: ${String(error)}`
      metrics.push({ alias, error: String(error) })
      continue
    }

    const model = gltf.scene
    model.rotation.y = 0
    model.scale.multiplyScalar(WORLD_SCALE)
    scene.add(model)
    model.updateMatrixWorld(true)
    const idle = gltf.animations.find((clip) => clip.name.toLowerCase() === 'bb_idle')

    const framing = createChampionPortraitFraming(model, idle)

    // pose the model mid-idle for a representative still
    if (idle) {
      const mixer = new THREE.AnimationMixer(model)
      mixer.clipAction(idle).play()
      mixer.setTime(idle.duration * 0.3)
      model.updateMatrixWorld(true)
    }

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
    const cellCanvases: HTMLCanvasElement[] = []
    for (const aspect of ASPECTS) {
      const width = Math.round(CELL_HEIGHT * aspect)
      renderer.setSize(width, CELL_HEIGHT, false)
      updateChampionPortraitCamera(camera, framing, aspect)
      renderer.render(scene, camera)

      const cell = document.createElement('div')
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = CELL_HEIGHT
      canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0)
      canvas.style.cssText = 'display:block;outline:1px solid #33475a'
      const caption = document.createElement('div')
      caption.textContent = `${aspect} h=${framing.portraitHeight.toFixed(2)}`
      cell.appendChild(canvas)
      cell.appendChild(caption)
      row.appendChild(cell)
      cellCanvases.push(canvas)
    }

    const composite = document.createElement('canvas')
    composite.width = cellCanvases.reduce((total, cell) => total + cell.width + 6, 0)
    composite.height = CELL_HEIGHT
    const context = composite.getContext('2d')!
    context.fillStyle = '#0c141c'
    context.fillRect(0, 0, composite.width, composite.height)
    let offsetX = 0
    cellCanvases.forEach((cell) => {
      context.drawImage(cell, offsetX, 0)
      offsetX += cell.width + 6
    })
    rowImages[alias] = composite.toDataURL('image/png')

    metrics.push({
      alias,
      source: framing.source,
      portraitHeight: Number(framing.portraitHeight.toFixed(3)),
      bodyWidth: Number((framing.bodyHalfWidth * 2).toFixed(3)),
      bodyHeight: Number((framing.bodyMaxY - framing.bodyMinY).toFixed(3)),
      anchorY: Number(framing.referenceAnchor.y.toFixed(3)),
      crownY: Number(framing.crownY.toFixed(3)),
    })

    scene.remove(model)
  }

  renderer.dispose()
  return JSON.stringify(metrics)
}
