import * as THREE from "three";
import { TILE } from "./constants";

/**
 * Continuous movement system with 360-degree control.
 * World remains tile-based, but player moves smoothly.
 */

/**
 * Movement mode configurations.
 * AI agents can use these presets or create custom configs.
 */
export const MovementModes = {
  walk: {
    speed: 4.5,           // Units per second
    acceleration: 28,     // How fast to reach speed
    friction: 18,         // How fast to stop
    gravity: 20,          // Fall speed
    turnSpeed: 12,        // Rotation speed (radians/sec)
  },
  run: {
    speed: 7,
    acceleration: 35,
    friction: 12,
    gravity: 20,
    turnSpeed: 10,
  },
  swim: {
    speed: 3,
    acceleration: 15,
    friction: 8,
    gravity: 2,
    turnSpeed: 8,
  },
  fly: {
    speed: 6,
    acceleration: 20,
    friction: 10,
    gravity: 0,
    turnSpeed: 10,
    verticalControl: true,
  },
};

/**
 * Create movement state object
 * @param {Object} config - Movement configuration
 * @returns {Object} Movement state
 */
export function createMovementState(config = MovementModes.walk) {
  return {
    // Position (continuous floats)
    x: 0,
    y: 0,
    z: 0,

    // Velocity
    vx: 0,
    vy: 0,
    vz: 0,

    // Input direction (normalized, from joystick/keyboard)
    inputX: 0,
    inputZ: 0,

    // Facing direction (radians)
    rotation: 0,
    targetRotation: 0,

    // Ground state
    grounded: true,
    groundHeight: 0,

    // Animation state
    isMoving: false,
    walkCycle: 0,      // For walk animation
    bobAmount: 0,      // Vertical bob while walking

    // Configuration
    config: { ...config },

    // Tile position (for world queries - derived from x,z)
    tileX: 0,
    tileZ: 0,
  };
}

/**
 * Set input direction (call each frame while input is active)
 * @param {Object} state - Movement state
 * @param {number} dx - X direction (-1 to 1)
 * @param {number} dz - Z direction (-1 to 1)
 */
export function setInput(state, dx, dz) {
  // Normalize if magnitude > 1
  const mag = Math.sqrt(dx * dx + dz * dz);
  if (mag > 1) {
    state.inputX = dx / mag;
    state.inputZ = dz / mag;
  } else {
    state.inputX = dx;
    state.inputZ = dz;
  }
}

/**
 * Clear input (call when joystick/keys released)
 * @param {Object} state - Movement state
 */
export function clearInput(state) {
  state.inputX = 0;
  state.inputZ = 0;
}

/**
 * Make the player jump (if grounded or very close to ground)
 * @param {Object} state - Movement state
 * @param {number} jumpForce - Initial upward velocity (default 8)
 * @returns {boolean} Whether jump was successful
 */
export function jump(state, jumpForce = 8) {
  // Allow jump if grounded OR very close to ground (coyote time tolerance)
  const nearGround = state.y - state.groundHeight < 0.15;
  if (state.grounded || nearGround) {
    state.vy = jumpForce;
    state.grounded = false;
    return true;
  }
  return false;
}

/**
 * Update movement physics
 * @param {Object} state - Movement state
 * @param {number} dt - Delta time in seconds
 * @param {Function} getGroundHeight - Function(x, z) => height
 * @param {Function} checkCollision - Function(x, z, vx, vz) => { blocked, slideX, slideZ }
 */
export function updateMovement(state, dt, getGroundHeight, checkCollision) {
  const { config } = state;
  const hasInput = state.inputX !== 0 || state.inputZ !== 0;

  // Target velocity based on input
  const targetVx = state.inputX * config.speed;
  const targetVz = state.inputZ * config.speed;

  // Accelerate toward target velocity or decelerate with friction
  if (hasInput) {
    state.vx = THREE.MathUtils.lerp(state.vx, targetVx, 1 - Math.exp(-config.acceleration * dt));
    state.vz = THREE.MathUtils.lerp(state.vz, targetVz, 1 - Math.exp(-config.acceleration * dt));
  } else {
    state.vx = THREE.MathUtils.lerp(state.vx, 0, 1 - Math.exp(-config.friction * dt));
    state.vz = THREE.MathUtils.lerp(state.vz, 0, 1 - Math.exp(-config.friction * dt));
  }

  // Clamp small velocities to zero
  if (Math.abs(state.vx) < 0.01) state.vx = 0;
  if (Math.abs(state.vz) < 0.01) state.vz = 0;

  // Proposed new position
  let newX = state.x + state.vx * dt;
  let newZ = state.z + state.vz * dt;

  // Collision detection
  if (checkCollision) {
    const collision = checkCollision(newX, newZ, state.vx, state.vz);
    if (collision.blocked) {
      // Apply slide if provided, otherwise stop
      if (collision.slideX !== undefined) {
        newX = state.x + collision.slideX * dt;
      } else {
        newX = state.x;
        state.vx = 0;
      }
      if (collision.slideZ !== undefined) {
        newZ = state.z + collision.slideZ * dt;
      } else {
        newZ = state.z;
        state.vz = 0;
      }
    }
  }

  // Apply position
  state.x = newX;
  state.z = newZ;

  // Update tile position (for world queries)
  state.tileX = Math.round(state.x / TILE);
  state.tileZ = Math.round(state.z / TILE);

  // Ground height
  if (getGroundHeight) {
    state.groundHeight = getGroundHeight(state.x, state.z);
  }

  // Gravity
  if (!state.grounded && config.gravity > 0) {
    state.vy -= config.gravity * dt;
  }

  // Apply vertical velocity
  state.y += state.vy * dt;

  // Ground collision
  const groundY = state.groundHeight;
  if (state.y <= groundY) {
    state.y = groundY;
    state.vy = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  // Rotation - face movement direction
  const speed = Math.sqrt(state.vx * state.vx + state.vz * state.vz);
  state.isMoving = speed > 0.1;

  if (state.isMoving) {
    state.targetRotation = Math.atan2(state.vx, state.vz);
  }

  // Smooth rotation
  let rotDiff = state.targetRotation - state.rotation;
  while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  state.rotation += rotDiff * Math.min(1, config.turnSpeed * dt);

  // Walk cycle animation
  if (state.isMoving) {
    state.walkCycle += speed * dt * 3; // Speed affects animation rate
    state.bobAmount = Math.sin(state.walkCycle * 2) * 0.04;
  } else {
    state.walkCycle = 0;
    state.bobAmount = Math.sin(performance.now() * 0.003) * 0.02; // Idle bob
  }
}

/**
 * Apply movement state to a Three.js object
 * @param {Object} state - Movement state
 * @param {THREE.Object3D} object - Object to update
 */
export function applyToObject(state, object) {
  object.position.x = state.x;
  object.position.y = state.y + 0.25 + state.bobAmount; // Base offset + bob
  object.position.z = state.z;
  object.rotation.y = state.rotation;

  // Walking animation - slight tilt and squash
  if (state.isMoving) {
    const tilt = Math.sin(state.walkCycle) * 0.08;
    const squash = 1 + Math.sin(state.walkCycle * 2) * 0.03;
    object.rotation.x = tilt * 0.5;
    object.rotation.z = -tilt * 0.3;
    object.scale.set(squash, 1 / squash, squash);
  } else {
    object.rotation.x = 0;
    object.rotation.z = 0;
    object.scale.set(1, 1, 1);
  }
}

/**
 * Apply ear animation based on movement
 * @param {Object} state - Movement state
 * @param {Object} ears - Ear objects { earL, earR }
 */
export function applyEarAnimation(state, ears) {
  if (!ears) return;

  if (state.isMoving) {
    const flop = Math.sin(state.walkCycle * 2) * 0.2;
    ears.earL.rotation.z = 0.15 + flop;
    ears.earR.rotation.z = -0.15 - flop;
  } else {
    const t = performance.now() * 0.004;
    ears.earL.rotation.z = 0.15 + Math.sin(t) * 0.06;
    ears.earR.rotation.z = -0.15 - Math.cos(t) * 0.06;
  }
}

/**
 * Reset movement state to origin
 * @param {Object} state - Movement state
 */
export function resetMovement(state) {
  state.x = 0;
  state.y = 0;
  state.z = 0;
  state.vx = 0;
  state.vy = 0;
  state.vz = 0;
  state.inputX = 0;
  state.inputZ = 0;
  state.rotation = 0;
  state.targetRotation = 0;
  state.grounded = true;
  state.isMoving = false;
  state.walkCycle = 0;
  state.tileX = 0;
  state.tileZ = 0;
}

/**
 * Apply distance tier modifiers to movement config
 * Call this when player enters a new distance tier
 * @param {Object} state - Movement state
 * @param {Object} tierModifiers - { gravityMult, speedMult } from tier
 * @param {Object} baseConfig - Original config to multiply against (default: walk)
 */
export function applyTierModifiers(state, tierModifiers, baseConfig = MovementModes.walk) {
  const gravityMult = tierModifiers.gravityMult || 1.0;
  const speedMult = tierModifiers.speedMult || 1.0;

  state.config.gravity = baseConfig.gravity * gravityMult;
  state.config.speed = baseConfig.speed * speedMult;

  // Store current multipliers for reference
  state.tierGravityMult = gravityMult;
  state.tierSpeedMult = speedMult;
}
