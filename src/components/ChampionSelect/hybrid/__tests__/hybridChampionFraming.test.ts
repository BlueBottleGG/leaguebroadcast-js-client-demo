import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  createChampionPortraitFraming,
  findChampionPortraitAnchor,
  PORTRAIT_FACE_SCREEN_Y,
  PORTRAIT_FACE_SCREEN_Y_MAX,
  updateChampionPortraitCamera,
} from '../hybridChampionFraming.ts'

const ASPECT = 0.55

function frameRect(camera: THREE.OrthographicCamera) {
  return {
    bottom: camera.position.y + camera.bottom,
    height: camera.top - camera.bottom,
    left: camera.position.x + camera.left,
    right: camera.position.x + camera.right,
    top: camera.position.y + camera.top,
  }
}

function screenFractionFromTop(point: THREE.Vector3, camera: THREE.OrthographicCamera): number {
  return (1 - point.clone().project(camera).y) / 2
}

// Upright humanoid: tall box with an animated head buffbone. The face should sit
// at the preferred screen height and the camera must not follow later bone motion.
{
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
  assert.equal(framing.source, 'buffbone')
  assert.ok(Math.abs(framing.referenceAnchor.y - 4.15) < 0.0001)
  assert.equal(buffbone.position.y, 0.25)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  updateChampionPortraitCamera(camera, framing, ASPECT)
  const faceFromTop = screenFractionFromTop(framing.referenceAnchor, camera)
  assert.ok(Math.abs(faceFromTop - PORTRAIT_FACE_SCREEN_Y) < 0.0001)

  const cameraPosition = camera.position.clone()
  buffbone.position.y += 1.2
  model.updateMatrixWorld(true)
  updateChampionPortraitCamera(camera, framing, ASPECT)
  assert.ok(camera.position.equals(cameraPosition))
  const movedFromTop = screenFractionFromTop(buffbone.getWorldPosition(new THREE.Vector3()), camera)
  assert.ok(Math.abs(movedFromTop - PORTRAIT_FACE_SCREEN_Y) > 0.1)

  body.geometry.dispose()
  body.material.dispose()
}

// Wide low monster (Rek'Sai/Cho'Gath shape): head anchor near the ground on one
// end of a long body. The old anchor-height zoom would give a ~0.9-unit frame;
// the body-aware framing must zoom out, keep the crown in frame, keep the ground
// near the frame bottom, and keep the face inside the central band.
{
  const model = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.2), new THREE.MeshBasicMaterial())
  body.position.y = 0.8
  model.add(body)
  const buffbone = new THREE.Object3D()
  buffbone.name = 'C_Buffbone_Glb_Head_Loc'
  buffbone.position.set(2.2, 1.1, 0)
  model.add(buffbone)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  assert.equal(framing.source, 'buffbone')
  assert.ok(Math.abs(framing.bodyMinY) < 0.0001)
  assert.ok(Math.abs(framing.bodyMaxY - 1.6) < 0.0001)
  assert.ok(Math.abs(framing.crownY - 1.6) < 0.0001)
  assert.ok(framing.portraitHeight > 1.0)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  updateChampionPortraitCamera(camera, framing, ASPECT)
  const rect = frameRect(camera)
  assert.ok(rect.height > 2)
  assert.ok(rect.top >= framing.bodyMaxY)
  assert.ok(rect.bottom >= -0.045 * rect.height)
  assert.ok(rect.bottom <= 0.0001)

  const anchorNdcX = framing.referenceAnchor.clone().project(camera).x
  assert.ok(Math.abs(anchorNdcX) <= 0.46)
  const faceFromTop = screenFractionFromTop(framing.referenceAnchor, camera)
  assert.ok(faceFromTop >= PORTRAIT_FACE_SCREEN_Y - 0.0001)
  assert.ok(faceFromTop <= PORTRAIT_FACE_SCREEN_Y_MAX + 0.0001)

  body.geometry.dispose()
  body.material.dispose()
}

// Pack-shaped champion (Naafiri): a small central body with flanking packmates
// and an off-center head. The frame must zoom out beyond the anchor height and
// recenter toward the pack's mass instead of pinning the head at screen center.
{
  const model = new THREE.Group()
  const material = new THREE.MeshBasicMaterial()
  const main = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), material)
  main.position.y = 0.5
  model.add(main)
  const packmates = [-1.6, 1.6].map((x) => {
    const packmate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), material)
    packmate.position.set(x, 0.3, 0)
    model.add(packmate)
    return packmate
  })
  const buffbone = new THREE.Object3D()
  buffbone.name = 'C_Buffbone_Glb_Head_Loc'
  buffbone.position.set(0.3, 0.85, 0)
  model.add(buffbone)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  updateChampionPortraitCamera(camera, framing, ASPECT)
  const rect = frameRect(camera)
  assert.ok(rect.height >= 1.25)
  assert.ok(camera.position.x < framing.referenceAnchor.x)
  assert.ok(camera.position.x > 0)
  const anchorNdcX = framing.referenceAnchor.clone().project(camera).x
  assert.ok(Math.abs(anchorNdcX) <= 0.46)

  main.geometry.dispose()
  packmates.forEach((packmate) => packmate.geometry.dispose())
  material.dispose()
}

// Small champion (yordle/Amumu shape): the frame must not shrink to the tiny
// body — the standard minimum camera field keeps small champs at a distance
// comparable to the rest of the roster.
{
  const model = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.8), new THREE.MeshBasicMaterial())
  body.position.y = 0.8
  model.add(body)
  const buffbone = new THREE.Object3D()
  buffbone.name = 'C_Buffbone_Glb_Head_Loc'
  buffbone.position.set(0, 1.25, 0)
  model.add(buffbone)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  assert.ok(framing.portraitHeight >= 1.9 - 0.0001)

  body.geometry.dispose()
  body.material.dispose()
}

// Asymmetric prop (Syndra orbs / Jayce hammer): side mass must not drag the
// camera off the face when the body already fits the frame width.
{
  const model = new THREE.Group()
  const material = new THREE.MeshBasicMaterial()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1), material)
  body.position.y = 1.5
  model.add(body)
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), material)
  prop.position.set(1.0, 1.4, 0)
  model.add(prop)
  const buffbone = new THREE.Object3D()
  buffbone.name = 'C_Buffbone_Glb_Head_Loc'
  buffbone.position.set(0, 2.6, 0)
  model.add(buffbone)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
  updateChampionPortraitCamera(camera, framing, 1.4)
  assert.ok(Math.abs(camera.position.x) < 0.0001)

  body.geometry.dispose()
  prop.geometry.dispose()
  material.dispose()
}

// Parked sub-ground geometry (Akali's sheathed-weapon trick): mass driven far
// below the map floor must not stretch the measured body.
{
  const material = new THREE.MeshBasicMaterial()
  const buildModel = (withJunk: boolean) => {
    const model = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1), material)
    body.position.y = 1.5
    model.add(body)
    if (withJunk) {
      const junk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), material)
      junk.position.y = -9
      model.add(junk)
    }
    const buffbone = new THREE.Object3D()
    buffbone.name = 'C_Buffbone_Glb_Head_Loc'
    buffbone.position.set(0, 2.6, 0)
    model.add(buffbone)
    model.updateMatrixWorld(true)
    return model
  }

  const clean = createChampionPortraitFraming(buildModel(false))
  const withJunk = createChampionPortraitFraming(buildModel(true))
  assert.ok(Math.abs(clean.portraitHeight - withJunk.portraitHeight) < 0.0001)
  assert.ok(Math.abs(clean.bodyMinY - withJunk.bodyMinY) < 0.0001)
  material.dispose()
}

// Floating champion (Nocturne shape): body mass hovering above the ground must
// be framed down to the floor, not cropped to the hovering mass.
{
  const model = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1), new THREE.MeshBasicMaterial())
  body.position.y = 2.8
  model.add(body)
  const buffbone = new THREE.Object3D()
  buffbone.name = 'C_Buffbone_Glb_Head_Loc'
  buffbone.position.set(0, 3.3, 0)
  model.add(buffbone)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  assert.equal(framing.bodyMinY, 0)
  assert.ok(framing.portraitHeight > 2)

  body.geometry.dispose()
  body.material.dispose()
}

// No named anchor: framing falls back to body bounds without mutating the model.
{
  const model = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1), new THREE.MeshBasicMaterial())
  body.position.y = 1.5
  model.add(body)
  model.updateMatrixWorld(true)

  const framing = createChampionPortraitFraming(model)
  assert.equal(framing.source, 'bounds')
  assert.equal(model.children.length, 1)
  assert.ok(framing.referenceAnchor.y > 1.5)
  assert.ok(framing.portraitHeight >= 0.9)

  body.geometry.dispose()
  body.material.dispose()
}

console.log('hybrid champion portrait framing passed')
