/**
 * Seeded random number generator (mulberry32)
 * Used for deterministic world generation in multiplayer
 */
let seededRandom = Math.random; // Default to Math.random
let globalWorldSeed = null; // Store the world seed for position-based random

/**
 * Create a seeded PRNG using mulberry32 algorithm
 * @param {number} seed - The seed value
 * @returns {function} A function that returns random numbers 0-1
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash function to combine seed with position
 * Uses a simple but effective hash combining technique
 * @param {number} seed - World seed
 * @param {number} x - X position
 * @param {number} z - Z position
 * @returns {number} Combined hash value
 */
function hashPosition(seed, x, z) {
  // Convert to integers and combine with prime multipliers
  const ix = Math.floor(x) | 0;
  const iz = Math.floor(z) | 0;
  let h = seed | 0;
  h = Math.imul(h ^ ix, 0x85ebca6b);
  h = Math.imul(h ^ iz, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0; // Ensure positive
}

/**
 * Create a position-based PRNG
 * Same seed + same position = same random sequence, regardless of generation order
 * @param {number} seed - World seed
 * @param {number} x - X position
 * @param {number} z - Z position
 * @returns {function} A function that returns random numbers 0-1
 */
export function createPositionRandom(seed, x, z) {
  const hash = hashPosition(seed, x, z);
  return mulberry32(hash);
}

/**
 * Get the global world seed
 * @returns {number|null} The world seed or null if not set
 */
export function getWorldSeed() {
  return globalWorldSeed;
}

/**
 * Set the global seed for random generation
 * Call this before generating the world to ensure all players get the same world
 * @param {number} seed - The seed value
 */
export function setRandomSeed(seed) {
  globalWorldSeed = seed;
  seededRandom = mulberry32(seed);
}

/**
 * Reset to using Math.random (non-deterministic)
 */
export function resetRandom() {
  globalWorldSeed = null;
  seededRandom = Math.random;
}

/**
 * Get the current random function
 * @returns {function} The current random function
 */
export function getRandom() {
  return seededRandom();
}

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random float between min and max
 */
export function randFloat(min, max) {
  return seededRandom() * (max - min) + min;
}

/**
 * Generate a random integer between min and max
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer between min and max
 */
export function randInt(min, max) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 * @param {Array} arr - Array to choose from
 * @returns {*} Random element from the array
 */
export function choice(arr) {
  return arr[Math.floor(seededRandom() * arr.length)];
}

/**
 * Calculate terrain height at a given Z coordinate using smooth pseudo-noise
 * @param {number} z - Z coordinate
 * @returns {number} Height value at that Z position
 */
export function heightAtZ(z) {
  const f1 = 0.18, f2 = 0.043, f3 = 0.071;
  const n = Math.sin(z * f1) * 0.6 + Math.cos(z * f2) * 0.3 + Math.sin(z * f3 + 1.3) * 0.2;
  return n * 0.55;
}
