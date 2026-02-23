import * as THREE from "three";

/**
 * Camera system with orbit controls, zoom, and player following.
 * Handles spherical coordinate positioning around player.
 */

/**
 * Normalize angle to [-π, π] range
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Create camera state object
 * @param {Object} options - Camera options
 * @returns {Object} Camera state
 */
export function createCameraState(options = {}) {
  return {
    orbitAngle: options.orbitAngle ?? 0,       // Horizontal orbit angle in radians
    orbitPitch: options.orbitPitch ?? 0.3,     // Vertical pitch (0 = level, positive = looking down)
    zoom: options.zoom ?? 0.75,                 // Zoom level (smaller = closer)
    zoomMin: options.zoomMin ?? 0.5,           // Min zoom (closest)
    zoomMax: options.zoomMax ?? 1.2,           // Max zoom (farthest) - allows wider FOV
  };
}

/**
 * Calculate camera position and look target based on orbit state
 * @param {THREE.Vector3} playerPos - Player position
 * @param {Object} cameraState - Camera state object
 * @returns {Object} { position: THREE.Vector3, lookAt: THREE.Vector3 }
 */
export function calculateCameraTransform(playerPos, cameraState) {
  const { orbitAngle, orbitPitch, zoom } = cameraState;
  const baseDist = 8.0 * zoom;

  // Spherical coordinates: pitch affects Y and horizontal distance
  const horizontalDist = Math.cos(orbitPitch) * baseDist;
  const verticalDist = Math.sin(orbitPitch) * baseDist + 2.5 * zoom;

  // Camera orbits around player based on orbitAngle and pitch
  const camOffsetX = Math.sin(orbitAngle) * horizontalDist;
  const camOffsetZ = -Math.cos(orbitAngle) * horizontalDist;
  const camOffsetY = verticalDist;

  const position = new THREE.Vector3(
    playerPos.x + camOffsetX * 0.55,
    playerPos.y + camOffsetY,
    playerPos.z + camOffsetZ
  );

  // Look at player (slightly ahead in camera's forward direction)
  const lookAheadDist = 2.0 * zoom;
  const lookAt = new THREE.Vector3(
    playerPos.x - Math.sin(orbitAngle) * lookAheadDist,
    playerPos.y + 0.5,
    playerPos.z + Math.cos(orbitAngle) * lookAheadDist
  );

  return { position, lookAt };
}

// Smoothed Y position for camera (reduces jitter from player bobbing)
let smoothedPlayerY = 0;

/**
 * Update camera position smoothly following player
 * @param {THREE.Camera} camera - Three.js camera
 * @param {THREE.Vector3} playerPos - Player position
 * @param {Object} cameraState - Camera state object
 * @param {number} dt - Delta time
 */
export function updateCamera(camera, playerPos, cameraState, dt) {
  // Smooth out the player Y to reduce camera jitter from bobbing
  // Use a slower lerp for Y to dampen the hop animation
  smoothedPlayerY = THREE.MathUtils.lerp(smoothedPlayerY, playerPos.y, 0.08);

  // Create a smoothed position for camera calculations
  const smoothedPos = new THREE.Vector3(playerPos.x, smoothedPlayerY, playerPos.z);
  const { position, lookAt } = calculateCameraTransform(smoothedPos, cameraState);

  camera.position.lerp(position, 1 - Math.pow(0.001, dt));
  camera.rotation.z = Math.sin(performance.now() * 0.0015 + playerPos.x) * 0.015;
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
}

/**
 * Apply orbit rotation to camera state
 * @param {Object} cameraState - Camera state object
 * @param {number} deltaAngle - Change in horizontal angle
 * @param {number} deltaPitch - Change in vertical pitch
 */
export function applyOrbit(cameraState, deltaAngle, deltaPitch) {
  cameraState.orbitAngle = normalizeAngle(cameraState.orbitAngle + deltaAngle);
  cameraState.orbitPitch = THREE.MathUtils.clamp(
    cameraState.orbitPitch + deltaPitch,
    0.1,  // ~6° minimum
    1.2   // ~69° maximum
  );
}

/**
 * Apply zoom to camera state
 * @param {Object} cameraState - Camera state object
 * @param {number} deltaZoom - Change in zoom
 */
export function applyZoom(cameraState, deltaZoom) {
  cameraState.zoom = THREE.MathUtils.clamp(
    cameraState.zoom + deltaZoom,
    cameraState.zoomMin,
    cameraState.zoomMax
  );
}

/**
 * Handle pinch zoom gesture
 * @param {Object} cameraState - Camera state object
 * @param {number} startDist - Initial pinch distance
 * @param {number} currentDist - Current pinch distance
 * @param {number} startZoom - Zoom value when pinch started
 */
export function handlePinchZoom(cameraState, startDist, currentDist, startZoom) {
  if (currentDist > 0.0001) {
    // Pinch out (bigger distance) => zoom in (smaller camZoom)
    const factor = startDist / currentDist;
    cameraState.zoom = THREE.MathUtils.clamp(
      startZoom * factor,
      cameraState.zoomMin,
      cameraState.zoomMax
    );
  }
}

// ── First-Person Camera (Iron Man suit) ───────────────────────────

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
export function updateFirstPersonCamera(camera, playerPos, fpState, playerRotation, dt) {
  if (!fpState.enabled) return;

  const headY = playerPos.y + 1.0;
  fpState.transitionT = Math.min(fpState.transitionT + dt * 5, 1);
  const t = fpState.transitionT;

  const targetPos = new THREE.Vector3(playerPos.x, headY, playerPos.z);
  camera.position.lerp(targetPos, t);

  const lookYaw = fpState.yaw;
  const lookPitch = THREE.MathUtils.clamp(fpState.pitch, -1.2, 1.2);

  const lookDir = new THREE.Vector3(
    Math.sin(lookYaw) * Math.cos(lookPitch),
    Math.sin(lookPitch),
    Math.cos(lookYaw) * Math.cos(lookPitch)
  );

  const lookTarget = new THREE.Vector3().copy(camera.position).add(lookDir);
  camera.lookAt(lookTarget);
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
