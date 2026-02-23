/**
 * Molinar Game SDK
 * Core game functionality for Molinar 3D games
 *
 * This SDK provides:
 * - Controls: Camera-relative input handling (joystick, keyboard, touch)
 * - Movement: Physics-based movement system with multiple modes
 * - Camera: Third-person camera with orbit, zoom, follow
 * - Multiplayer: Supabase Realtime-based player sync
 * - Factories: Player and object creation
 * - Constants: Palettes, biomes, tiles
 * - Math: Random, seeding, utilities
 */

// Controls - input handling and direction conversion
export {
  screenToWorldDirection,
  keyCodeToScreenDirection,
  touchDeltaToScreenDirection,
  joystickToScreenDirection,
  createTouchState,
  getPinchDistance,
  isDoubleTap,
  setupMobileStyles,
  restoreMobileStyles,
} from './controls.js';

// Movement - physics-based movement system
export {
  createMovementState,
  setInput,
  clearInput,
  jump,
  updateMovement,
  applyToObject,
  applyEarAnimation,
  resetMovement,
  applyTierModifiers,
  MovementModes,
} from './movement.js';

// Camera - third-person camera system
export {
  createCameraState,
  updateCamera,
  applyOrbit,
  handlePinchZoom,
  normalizeAngle,
} from './camera.js';

// First-person camera (Iron Man suit)
export {
  createFirstPersonState,
  updateFirstPersonCamera,
  applyFirstPersonLook,
  enterFirstPerson,
  exitFirstPerson,
} from './firstPersonCamera.js';

// Multiplayer - Supabase Realtime player sync
export {
  setSupabaseClient,
  createMultiplayerManager,
} from './multiplayer.js';

// Factories - player and object creation
export {
  createPlayer,
  createOtherPlayer,
  createPlayerWithColor,
  updatePlayerColor,
  addAccessoriesToPlayer,
  updatePlayerAccessories,
  spawnSparkles,
  createCloud,
  createCoin,
  createLilypad,
  createBridge,
  createFence,
  createFenceCorner,
  createGate,
  createCabin,
  createHouse,
  createTower,
  createRandomBuilding,
} from './factories.js';

// Constants - palettes, biomes, tiles
export {
  PALETTE,
  TILE,
  BIOMES,
  INITIAL_HALF_WIDTH,
  getBiomeForZ,
  resetBiomes,
  getDistanceTier,
} from './constants.js';

// Math utilities
export {
  randFloat,
  randInt,
  choice,
  heightAtZ,
  setRandomSeed,
  setWorldSeed,
  resetRandom,
  createPositionRandom,
  getWorldSeed,
} from './math.js';

// Shell Bridge - secure communication with Game Clips shell
// Handles auth, coins signaling, input from parent
export {
  initShellBridge,
  getShellBridge,
  useShellBridge,
  setShellSupabase,
} from './shell-bridge.js';
