import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  createChampionPortraitFraming,
  findChampionPortraitAnchor,
  PORTRAIT_FACE_SCREEN_Y,
  updateChampionPortraitCamera,
} from '../hybridChampionFraming.ts'

const model = new THREE.Group()
const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial())
body.position.y = 2
model.add(body)
const head = new THREE.Object3D()
head.name = 'HEAD'
head.position.y = 3.3
model.add(head)
const buffbone = new THREE.Object3D()
buffbone.name = 'C_Buffbone_Glb_Head_Loc'
buffbone.position.y = 0.25
head.add(buffbone)
model.updateMatrixWorld(true)

const idle = new THREE.AnimationClip('bb_idle', 2, [
  new THREE.VectorKeyframeTrack(
    'C_Buffbone_Glb_Head_Loc.position',
    [0, 1, 2],
    [0, 0.25, 0, 0, 1.45, 0, 0, 0.25, 0],
  ),
])

assert.equal(findChampionPortraitAnchor(model)?.object, buffbone)

const framing = createChampionPortraitFraming(model, idle)
assert.ok(Math.abs(framing.referenceAnchor.y - 4.15) < 0.0001)
assert.equal(buffbone.position.y, 0.25)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
updateChampionPortraitCamera(camera, framing, 0.55)
const projected = framing.referenceAnchor.clone().project(camera)
assert.ok(Math.abs((1 - projected.y) / 2 - PORTRAIT_FACE_SCREEN_Y) < 0.0001)

const cameraPosition = camera.position.clone()
buffbone.position.y += 1.2
model.updateMatrixWorld(true)
updateChampionPortraitCamera(camera, framing, 0.55)
assert.ok(camera.position.equals(cameraPosition))
const projectedAfterMovement = buffbone.getWorldPosition(new THREE.Vector3()).project(camera)
assert.ok(Math.abs((1 - projectedAfterMovement.y) / 2 - PORTRAIT_FACE_SCREEN_Y) > 0.1)

const crouchedModel = new THREE.Group()
const crouchedBody = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial())
crouchedBody.position.y = 2
crouchedModel.add(crouchedBody)
const crouchedHead = new THREE.Object3D()
crouchedHead.name = 'C_BUFFBONE_GLB_HEAD_LOC'
crouchedHead.position.y = 1.6
crouchedModel.add(crouchedHead)
const ground = new THREE.Object3D()
ground.name = 'BUFFBONE_GLB_GROUND_LOC'
crouchedModel.add(ground)
const overhead = new THREE.Object3D()
overhead.name = 'C_Buffbone_Glb_Overhead_Loc'
overhead.position.y = 4.8
crouchedModel.add(overhead)
crouchedModel.updateMatrixWorld(true)

const crouchedFraming = createChampionPortraitFraming(crouchedModel)
assert.equal(crouchedFraming.source, 'buffbone')
assert.ok(Math.abs(crouchedFraming.portraitHeight - 2.88) < 0.0001)
assert.equal(crouchedFraming.faceScreenY, 0.36)

const crouchedCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
updateChampionPortraitCamera(crouchedCamera, crouchedFraming, 0.55)
const crouchedProjection = crouchedFraming.referenceAnchor.clone().project(crouchedCamera)
assert.ok(Math.abs((1 - crouchedProjection.y) / 2 - 0.36) < 0.0001)

body.geometry.dispose()
body.material.dispose()
crouchedBody.geometry.dispose()
crouchedBody.material.dispose()
console.log('hybrid champion buffbone framing passed')
