import * as THREE from "three";

/**
 * First-Person Camera (Iron Man suit)
 *
 * Extracted from camera.js (LOCKED) to keep the core camera module stable.
 * Provides enter/exit, mouse-look, and per-frame update for FP mode.
 */

// Pre-allocated scratch vectors to avoid per-frame allocations
const _targetPos = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

/**
 * Create first-person camera state
 */
export function createFirstPersonState() {
  return {
    enabled: false,
    yaw: 0,
    pitch: 0,
    transitionT: 0,
  };
}

/**
 * Update camera for first-person view.
 */
export function updateFirstPersonCamera(camera, playerPos, fpState, dt) {
  if (!fpState.enabled) return;

  const headY = playerPos.y + 1.0;
  fpState.transitionT = Math.min(fpState.transitionT + dt * 5, 1);
  // Use a fixed lerp factor for smooth ease-out, gated by transition progress
  const lerpFactor = 1 - Math.pow(0.001, dt);
  const t = fpState.transitionT < 1 ? lerpFactor : 1;

  _targetPos.set(playerPos.x, headY, playerPos.z);
  camera.position.lerp(_targetPos, t);

  const lookYaw = fpState.yaw;
  const lookPitch = THREE.MathUtils.clamp(fpState.pitch, -1.2, 1.2);

  _lookDir.set(
    Math.sin(lookYaw) * Math.cos(lookPitch),
    Math.sin(lookPitch),
    Math.cos(lookYaw) * Math.cos(lookPitch)
  );

  _lookTarget.copy(camera.position).add(_lookDir);
  camera.lookAt(_lookTarget);
  camera.rotation.z = 0;
}

/**
 * Apply mouse/touch look deltas to first-person state
 */
export function applyFirstPersonLook(fpState, deltaX, deltaY) {
  if (!fpState.enabled) return;
  const sensitivity = 0.003;
  fpState.yaw -= deltaX * sensitivity;
  fpState.pitch -= deltaY * sensitivity;
  fpState.pitch = THREE.MathUtils.clamp(fpState.pitch, -1.2, 1.2);
}

/**
 * Enter first-person mode
 */
export function enterFirstPerson(fpState, cameraState) {
  fpState.enabled = true;
  fpState.transitionT = 0;
  fpState.yaw = cameraState.orbitAngle + Math.PI;
  fpState.pitch = 0;
}

/**
 * Exit first-person mode
 */
export function exitFirstPerson(fpState) {
  fpState.enabled = false;
  fpState.transitionT = 0;
}
