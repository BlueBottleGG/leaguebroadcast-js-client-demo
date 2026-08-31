import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  playChampionModelAnimation,
  type ChampionModelInstance,
} from '../../model/championModelRuntime.ts'

const model = new THREE.Group()
const spawn = new THREE.AnimationClip('BB_SPAWN', 0.1, [
  new THREE.VectorKeyframeTrack('.position', [0, 0.1], [0, 0, 0, 0, 1, 0]),
])
const idle = new THREE.AnimationClip('bb_idle', 0.2, [
  new THREE.NumberKeyframeTrack('.rotation[y]', [0, 0.2], [0, 0.2]),
])
const instance = {
  alias: 'TestChampion',
  asset: { animations: [spawn, idle], scene: new THREE.Group() },
  model,
  ownedMaterials: [],
} satisfies ChampionModelInstance

const playback = playChampionModelAnimation(instance, true)
playback.update(0.05)
assert.ok(model.position.y > 0 && model.position.y < 1)
playback.update(0.06)
playback.update(0.1)
assert.ok(model.rotation.y > 0)

model.position.set(0, 0, 0)
playback.playSpawn()
playback.update(0.05)
assert.ok(model.position.y > 0 && model.position.y < 1)
playback.dispose()

console.log('shared champion spawn-to-idle playback passed')
