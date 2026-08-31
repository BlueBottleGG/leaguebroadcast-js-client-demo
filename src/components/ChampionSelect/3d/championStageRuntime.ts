import type * as THREE from 'three'
import type {
  ChampionModelInstance,
  ChampionModelPlayback,
} from '../model/championModelRuntime'
import type {
  StageBanWallDescriptor,
  StageChampionActor,
  StagePickCardDescriptor,
} from './championStageState'

export interface ActorPositionMove {
  duration: number
  elapsed: number
  start: THREE.Vector3
  target: THREE.Vector3
}

export interface ActivePickLane {
  iconUrl: string
  label: string
  side: 'blue' | 'red'
}

export interface ActiveBan {
  index: number
  side: 'blue' | 'red'
}

export interface TeamLogoRuntime {
  geometry: THREE.PlaneGeometry
  material: THREE.MeshBasicMaterial
  mesh: THREE.Mesh
  source: string
  texture: THREE.Texture
}

export interface TeamIdentityTextRuntime {
  geometries: THREE.PlaneGeometry[]
  group: THREE.Group
  materials: THREE.MeshBasicMaterial[]
  textures: THREE.CanvasTexture[]
}

export interface ActorRuntime {
  descriptor: StageChampionActor
  entrancePending: boolean
  group: THREE.Group
  modelInstance?: ChampionModelInstance
  playback?: ChampionModelPlayback
  positionMove?: ActorPositionMove
  disposed: boolean
}

export interface PickCardRuntime {
  auraMaterial: THREE.MeshBasicMaterial
  championMaterial: THREE.MeshBasicMaterial
  championReady: boolean
  championSource: string | null
  championTexture?: THREE.Texture
  contentMix: number
  descriptor: StagePickCardDescriptor
  disposed: boolean
  entranceElapsed: number
  exitingElapsed?: number
  geometries: THREE.BufferGeometry[]
  groundMaterial: THREE.MeshBasicMaterial
  group: THREE.Group
  imageVersion: number
  laneMaterial: THREE.MeshBasicMaterial
  laneTexture: THREE.CanvasTexture
  materials: THREE.Material[]
  pivot: THREE.Group
  shellMaterial: THREE.MeshStandardMaterial
  spotlightFloorMaterial: THREE.MeshBasicMaterial
  spotlightMaterial: THREE.MeshBasicMaterial
  spotlightMix: number
  swayElapsed: number
  swayPhase: number
}

export interface BanWallRuntime {
  activeElapsed: number
  descriptor: StageBanWallDescriptor
  disposed: boolean
  geometry: THREE.PlaneGeometry
  lockTransitionElapsed?: number
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh
  nameGeometry: THREE.PlaneGeometry
  nameMaterial: THREE.MeshBasicMaterial
  nameMesh: THREE.Mesh
  nameTexture: THREE.CanvasTexture
  spotlightFloorGeometry: THREE.PlaneGeometry
  spotlightFloorMaterial: THREE.MeshBasicMaterial
  spotlightFloorMesh: THREE.Mesh
  spotlightGeometry: THREE.PlaneGeometry
  spotlightMaterial: THREE.MeshBasicMaterial
  spotlightMesh: THREE.Mesh
  texture: THREE.Texture
}

export type CameraMotionPhase = 'intro' | 'live' | 'exit'
