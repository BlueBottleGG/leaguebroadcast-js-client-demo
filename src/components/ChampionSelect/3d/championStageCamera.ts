import * as THREE from 'three'
import type { StageSide } from './championStageState'
import {
  CAMERA_ACTION_TARGET_OFFSET,
  CAMERA_ACTION_TARGET_TRANSITION_SECONDS,
  CAMERA_BASE_POSITION,
  CAMERA_BASE_TARGET,
  CAMERA_EXIT_DURATION_SECONDS,
  CAMERA_EXIT_FOV,
  CAMERA_EXIT_POSITION,
  CAMERA_EXIT_TARGET,
  CAMERA_FINAL_FOV,
  CAMERA_INTRO_CONTROL_POSITION,
  CAMERA_INTRO_FOV,
  CAMERA_INTRO_HOLD_SECONDS,
  CAMERA_INTRO_MOVE_SECONDS,
  CAMERA_INTRO_POSITION,
  CAMERA_INTRO_TARGET,
  CAMERA_SWAY_PHASES,
  CAMERA_SWAY_STRENGTH,
} from './championStageConfig'

type CameraMotionPhase = 'intro' | 'live' | 'exit'

export interface ChampionStageCameraOptions {
  activeSide: () => StageSide | null
  prefersReducedMotion: boolean
}

/** Owns the intro, live drift, action focus, and exit shot choreography. */
export class ChampionStageCameraController {
  readonly camera: THREE.PerspectiveCamera
  private readonly activeSide: () => StageSide | null
  private actionTargetDestinationX = 0
  private actionTargetOffsetX = 0
  private actionTargetStartX = 0
  private actionTargetTransitionElapsed = CAMERA_ACTION_TARGET_TRANSITION_SECONDS
  private currentRoll = 0
  private readonly currentTarget = CAMERA_INTRO_TARGET.clone()
  private readonly exitControlPosition = new THREE.Vector3()
  private exitStartFov = CAMERA_FINAL_FOV
  private readonly exitStartPosition = new THREE.Vector3()
  private exitStartRoll = 0
  private readonly exitStartTarget = new THREE.Vector3()
  private readonly livePosition = CAMERA_BASE_POSITION.clone()
  private readonly liveTarget = CAMERA_BASE_TARGET.clone()
  private motionElapsed = 0
  private motionPhase: CameraMotionPhase
  private readonly posePosition = CAMERA_INTRO_POSITION.clone()
  private readonly poseTarget = CAMERA_INTRO_TARGET.clone()
  private prefersReducedMotion: boolean
  private swayElapsed = 0

  constructor(camera: THREE.PerspectiveCamera, options: ChampionStageCameraOptions) {
    this.camera = camera
    this.activeSide = options.activeSide
    this.prefersReducedMotion = options.prefersReducedMotion
    this.motionPhase = options.prefersReducedMotion ? 'live' : 'intro'

    if (options.prefersReducedMotion) {
      this.applyPose(CAMERA_BASE_POSITION, CAMERA_BASE_TARGET, CAMERA_FINAL_FOV)
    } else {
      this.applyPose(CAMERA_INTRO_POSITION, CAMERA_INTRO_TARGET, CAMERA_INTRO_FOV)
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.prefersReducedMotion = reduced
    if (!reduced) return
    if (this.motionPhase === 'intro') this.motionPhase = 'live'
    if (this.motionPhase === 'exit') this.motionElapsed = CAMERA_EXIT_DURATION_SECONDS
  }

  beginExit(): void {
    if (this.motionPhase === 'exit') return
    this.motionPhase = 'exit'
    this.motionElapsed = this.prefersReducedMotion ? CAMERA_EXIT_DURATION_SECONDS : 0
    this.exitStartPosition.copy(this.camera.position)
    this.exitStartTarget.copy(this.currentTarget)
    this.exitStartFov = this.camera.fov
    this.exitStartRoll = this.currentRoll
    this.exitControlPosition.lerpVectors(this.exitStartPosition, CAMERA_EXIT_POSITION, 0.46)
    this.exitControlPosition.y += 2.2
  }

  update(delta: number): void {
    if (this.motionPhase === 'exit') {
      this.motionElapsed = Math.min(this.motionElapsed + delta, CAMERA_EXIT_DURATION_SECONDS)
      const progress = THREE.MathUtils.smootherstep(
        this.motionElapsed / CAMERA_EXIT_DURATION_SECONDS,
        0,
        1,
      )
      this.quadraticBezierVector(
        this.posePosition,
        this.exitStartPosition,
        this.exitControlPosition,
        CAMERA_EXIT_POSITION,
        progress,
      )
      this.poseTarget.lerpVectors(this.exitStartTarget, CAMERA_EXIT_TARGET, progress)
      this.applyPose(
        this.posePosition,
        this.poseTarget,
        THREE.MathUtils.lerp(this.exitStartFov, CAMERA_EXIT_FOV, progress),
        THREE.MathUtils.lerp(this.exitStartRoll, 0, progress),
      )
      return
    }

    const liveRoll = this.sampleLiveCamera(delta)
    if (this.motionPhase === 'intro' && !this.prefersReducedMotion) {
      this.motionElapsed += delta
      const linearProgress = THREE.MathUtils.clamp(
        (this.motionElapsed - CAMERA_INTRO_HOLD_SECONDS) / CAMERA_INTRO_MOVE_SECONDS,
        0,
        1,
      )
      const progress = THREE.MathUtils.smootherstep(linearProgress, 0, 1)
      this.quadraticBezierVector(
        this.posePosition,
        CAMERA_INTRO_POSITION,
        CAMERA_INTRO_CONTROL_POSITION,
        this.livePosition,
        progress,
      )
      this.poseTarget.lerpVectors(CAMERA_INTRO_TARGET, this.liveTarget, progress)
      this.applyPose(
        this.posePosition,
        this.poseTarget,
        THREE.MathUtils.lerp(CAMERA_INTRO_FOV, CAMERA_FINAL_FOV, progress),
        liveRoll * progress,
      )
      if (linearProgress >= 1) this.motionPhase = 'live'
      return
    }

    this.motionPhase = 'live'
    this.applyPose(this.livePosition, this.liveTarget, CAMERA_FINAL_FOV, liveRoll)
  }

  private swayWave(elapsed: number, period: number, phaseIndex: number): number {
    return Math.sin((elapsed * Math.PI * 2) / period + (CAMERA_SWAY_PHASES[phaseIndex] ?? 0))
  }

  private noiseSample(index: number, seed: number): number {
    const value = Math.sin((index + seed * 101.3) * 12.9898) * 43758.5453
    return (value - Math.floor(value)) * 2 - 1
  }

  private valueNoise(elapsed: number, interval: number, seed: number): number {
    const position = elapsed / interval
    const index = Math.floor(position)
    const fraction = position - index
    const blend = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10)
    return THREE.MathUtils.lerp(
      this.noiseSample(index, seed),
      this.noiseSample(index + 1, seed),
      blend,
    )
  }

  private sampleLiveCamera(delta: number): number {
    this.swayElapsed += delta
    const time = this.swayElapsed
    const strength = CAMERA_SWAY_STRENGTH
    const side = this.activeSide()
    const actionTargetOffset =
      side === 'blue'
        ? -CAMERA_ACTION_TARGET_OFFSET
        : side === 'red'
          ? CAMERA_ACTION_TARGET_OFFSET
          : 0
    if (actionTargetOffset !== this.actionTargetDestinationX) {
      this.actionTargetStartX = this.actionTargetOffsetX
      this.actionTargetDestinationX = actionTargetOffset
      this.actionTargetTransitionElapsed = 0
    }
    this.actionTargetTransitionElapsed = Math.min(
      this.actionTargetTransitionElapsed + delta,
      CAMERA_ACTION_TARGET_TRANSITION_SECONDS,
    )
    const actionProgress = THREE.MathUtils.smootherstep(
      this.actionTargetTransitionElapsed / CAMERA_ACTION_TARGET_TRANSITION_SECONDS,
      0,
      1,
    )
    this.actionTargetOffsetX = THREE.MathUtils.lerp(
      this.actionTargetStartX,
      this.actionTargetDestinationX,
      actionProgress,
    )

    this.livePosition.set(
      CAMERA_BASE_POSITION.x +
        (this.swayWave(time, 37, 0) * 0.045 +
          this.swayWave(time, 17, 1) * 0.014 +
          this.valueNoise(time, 7.5, 1) * 0.026) *
          strength,
      CAMERA_BASE_POSITION.y +
        (this.swayWave(time, 43, 2) * 0.018 +
          this.swayWave(time, 23, 3) * 0.007 +
          this.valueNoise(time, 9.5, 2) * 0.012) *
          strength,
      CAMERA_BASE_POSITION.z +
        (this.swayWave(time, 53, 4) * 0.025 +
          this.swayWave(time, 29, 5) * 0.01 +
          this.valueNoise(time, 11, 3) * 0.014) *
          strength,
    )
    this.liveTarget.set(
      CAMERA_BASE_TARGET.x +
        (this.swayWave(time, 41, 6) * 0.04 +
          this.swayWave(time, 19, 7) * 0.012 +
          this.valueNoise(time, 8.5, 4) * 0.028) *
          strength +
        this.actionTargetOffsetX,
      CAMERA_BASE_TARGET.y +
        (this.swayWave(time, 47, 8) * 0.014 + this.valueNoise(time, 10.5, 5) * 0.011) * strength,
      CAMERA_BASE_TARGET.z +
        (this.swayWave(time, 59, 9) * 0.02 + this.valueNoise(time, 12.5, 6) * 0.012) * strength,
    )
    return this.swayWave(time, 61, 10) * THREE.MathUtils.degToRad(0.025) * strength
  }

  private quadraticBezierVector(
    output: THREE.Vector3,
    start: THREE.Vector3,
    control: THREE.Vector3,
    end: THREE.Vector3,
    progress: number,
  ): void {
    const inverse = 1 - progress
    output.set(
      inverse * inverse * start.x +
        2 * inverse * progress * control.x +
        progress * progress * end.x,
      inverse * inverse * start.y +
        2 * inverse * progress * control.y +
        progress * progress * end.y,
      inverse * inverse * start.z +
        2 * inverse * progress * control.z +
        progress * progress * end.z,
    )
  }

  private applyPose(position: THREE.Vector3, target: THREE.Vector3, fov: number, roll = 0): void {
    this.camera.position.copy(position)
    this.camera.lookAt(target)
    this.camera.rotateZ(roll)
    this.currentTarget.copy(target)
    this.currentRoll = roll
    if (Math.abs(this.camera.fov - fov) > 0.0001) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
