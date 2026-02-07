import { createPositionRandom, getWorldSeed } from "./math";

// World dimensions and configuration
export const TILE = 1; // world unit per tile

// Initial visible half-width; horizontal world now expands procedurally
export const INITIAL_HALF_WIDTH = 28; // starting lanes span from -..+ (wider for better horizontal coverage)

// Use a very wide base strip so we don't need to rebuild ground when expanding
export const BASE_STRIP_HALF_WIDTH = 200; // visual ground span; fog hides far edges

export const WORLD_COLS = INITIAL_HALF_WIDTH * 2 + 1; // initial number of columns

// Make the initial world big enough to keep edges hidden in fog
export const INITIAL_LANES_AHEAD = 30; // reduced from 45 for performance
export const LANES_BEHIND = 18; // reduced from 25 for performance
export const MAX_LANES = 50; // reduced from 80 for performance

// Kawaii low-poly palette (Animal Crossing-inspired vibrancy)
export const PALETTE = {
  grass: 0xcff8e5,
  grassDark: 0xbff1d9,
  road: 0xf6e9f2,
  roadStripe: 0xffffff,
  treeLeaf: 0xb6f2cc,
  treeLeafAlt: 0xd6f7da,
  treeTrunk: 0xd8b59b,
  player: 0xffffff,
  blush: 0xffb1c8,
  eye: 0x2b2b2b,
  cloud: 0xffffff,
  sky: 0xfff5fb,
  // cars + accents
  car1: 0xffb3c1,
  car2: 0xa0e7e5,
  car3: 0xfff1a6,
  car4: 0xd9b3ff,
  car5: 0xffc49c,
  // sparkles + petals
  sparkle1: 0xffcde6,
  sparkle2: 0xffe3f1,
  sparkle3: 0xd7fff1,
  petal: 0xffc0d9,
  // flowers
  flowerRed: 0xff6b6b,
  flowerPink: 0xff9fd6,
  flowerOrange: 0xffb86b,
  flowerYellow: 0xfff176,
  flowerBlue: 0x8ecaff,
  flowerPurple: 0xc3a6ff,
  stem: 0x7bd389,
  // butterflies
  butterYellow: 0xffeb77,
  butterBlue: 0x7fd0ff,
  butterPink: 0xff9acb,
  butterOrange: 0xffa450,
};

// Biome palettes - override base palette per biome
export const BIOMES = {
  // Default forest biome (uses base PALETTE)
  forest: {
    name: 'forest',
    grass: 0xcff8e5,
    grassDark: 0xbff1d9,
    treeLeaf: 0xb6f2cc,
    treeLeafAlt: 0xd6f7da,
    treeTrunk: 0xd8b59b,
    water: 0x5599dd,
    flowerColors: [0xff6b6b, 0xff9fd6, 0xffb86b, 0xfff176, 0x8ecaff, 0xc3a6ff],
  },
  // Desert biome - sandy with cacti
  desert: {
    name: 'desert',
    grass: 0xf5deb3,       // Sandy tan
    grassDark: 0xe8d4a8,   // Darker sand
    treeLeaf: 0x7cb342,    // Cactus green
    treeLeafAlt: 0x8bc34a, // Lighter cactus
    treeTrunk: 0x8d6e63,   // Desert wood/rock
    water: 0x4a90a4,       // Oasis blue
    flowerColors: [0xff7043, 0xffca28, 0xff8a65, 0xffa726], // Desert flowers
  },
  // Snow biome - winter wonderland
  snow: {
    name: 'snow',
    grass: 0xe8f4f8,       // Snow white with blue tint
    grassDark: 0xd4e9ef,   // Slightly darker snow
    treeLeaf: 0x2e7d32,    // Dark pine green
    treeLeafAlt: 0x388e3c, // Pine green
    treeTrunk: 0x5d4037,   // Dark bark
    water: 0x81d4fa,       // Icy blue
    flowerColors: [0xe1f5fe, 0xb3e5fc, 0x81d4fa], // Ice crystals
  },
  // Autumn biome - fall colors
  autumn: {
    name: 'autumn',
    grass: 0xc5a97c,       // Dry grass
    grassDark: 0xb8956a,   // Darker dry grass
    treeLeaf: 0xff7043,    // Orange leaves
    treeLeafAlt: 0xffca28, // Yellow leaves
    treeTrunk: 0x6d4c41,   // Dark trunk
    water: 0x5c9ead,       // Cool autumn water
    flowerColors: [0xff5722, 0xff9800, 0xffc107, 0x8d6e63], // Autumn colors
  },
  // Cherry blossom biome - sakura
  sakura: {
    name: 'sakura',
    grass: 0xd4edda,       // Light green
    grassDark: 0xc3e6cb,   // Slightly darker
    treeLeaf: 0xffb7c5,    // Pink blossoms
    treeLeafAlt: 0xffc1cc, // Light pink
    treeTrunk: 0x8b4513,   // Brown trunk
    water: 0x87ceeb,       // Sky blue
    flowerColors: [0xffb7c5, 0xffc1cc, 0xff69b4, 0xffffff], // Pink/white flowers
  },
};

// Biome chunk generation settings
let customBiomeChunkSize = null;
export const BIOME_CHUNK_SIZE_DEFAULT = 18;
// Use getter pattern: import { getBiomeChunkSize } from ... or use BIOME_CHUNK_SIZE (static default)
export const BIOME_CHUNK_SIZE = 18; // Lanes per biome chunk (static default for backward compat)
export const BIOME_TRANSITION_SIZE = 4; // Lanes to blend between biomes

// Distance tiers - progressive world transformation
// Each tier changes how the world feels, not just looks
export const DISTANCE_TIERS = [
  // Band 0: Familiar - "I get this world"
  // Clean rules, cozy, teaches movement
  {
    name: 'familiar',
    startZ: 0,
    saturation: 1.0,
    hueShift: 0,
    scale: 1.0,
    scaleVariation: 0,      // No random size variation
    densityMultiplier: 1.0, // Normal object density
  },
  // Band 1: Noisy - "Is this random or AI?"
  // More variation, slightly off colors, taller structures
  {
    name: 'noisy',
    startZ: 30,
    saturation: 1.08,       // Slightly more vivid
    hueShift: 8,            // Subtle but noticeable color shift
    scale: 1.1,             // Things are a bit taller
    scaleVariation: 0.15,   // Some objects bigger/smaller randomly
    densityMultiplier: 1.15, // Slightly more stuff
  },
  // Band 2: Alien - "I didn't know this could exist"
  // Geometry bends, scale feels wrong, things lean and twist
  {
    name: 'alien',
    startZ: 70,
    saturation: 1.2,
    hueShift: 25,
    scale: 1.25,
    scaleVariation: 0.45,   // Wild size differences
    densityMultiplier: 1.2,
    tilt: 0.3,              // Objects lean up to 0.3 radians (~17°)
    squash: 0.2,            // Objects can be squashed/stretched 20%
  },
];

// Bands cycle after this distance (Familiar -> Noisy -> Alien -> Familiar -> ...)
const TIER_CYCLE_LENGTH = 120;

// Distance tier system disabled for debugging
export function getDistanceTier(z, x = 0) {
  return DISTANCE_TIERS[0]; // Always familiar
}

// Biome weights for random selection (higher = more common)
const DEFAULT_BIOME_WEIGHTS = {
  forest: 3,
  sakura: 2,
  autumn: 2,
  desert: 1,
  snow: 1,
};

// Build weighted array for random selection (mutable — rebuilt by setBiomeConfig)
let BIOME_POOL = [];
function rebuildBiomePool(weights) {
  BIOME_POOL.length = 0;
  for (const [name, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight; i++) {
      BIOME_POOL.push(name);
    }
  }
}
rebuildBiomePool(DEFAULT_BIOME_WEIGHTS);

// Cache for computed biomes (performance optimization, not needed for determinism)
const biomeCache = new Map();

// Reset biome cache (for when world seed changes)
export function resetBiomes() {
  biomeCache.clear();
}

/**
 * Get the active biome chunk size (respects override from setBiomeConfig).
 */
export function getBiomeChunkSize() {
  return customBiomeChunkSize || BIOME_CHUNK_SIZE_DEFAULT;
}

/**
 * Override biome weights and/or chunk size for a custom world.
 * Call after setRandomSeed() when initializing a world.
 * Pass null/undefined values to reset to defaults.
 *
 * @param {{ biomeWeights?: object|null, biomeChunkSize?: number|null }} config
 */
export function setBiomeConfig(config) {
  if (!config) return;

  if (config.biomeWeights && typeof config.biomeWeights === 'object') {
    rebuildBiomePool(config.biomeWeights);
  } else if (config.biomeWeights === null) {
    rebuildBiomePool(DEFAULT_BIOME_WEIGHTS);
  }

  if (typeof config.biomeChunkSize === 'number' && config.biomeChunkSize > 0) {
    customBiomeChunkSize = config.biomeChunkSize;
  } else if (config.biomeChunkSize === null) {
    customBiomeChunkSize = null;
  }

  // Clear cache so biomes regenerate with new settings
  biomeCache.clear();
}

// Get cell indices for a position (2D biome grid)
function getCellIndices(x, z) {
  const chunkSize = getBiomeChunkSize();
  return {
    cellX: Math.floor(x / chunkSize),
    cellZ: Math.floor(z / chunkSize)
  };
}

// Get biome for a 2D cell using position-based deterministic random
// Same seed + same (cellX, cellZ) = same biome, always
function getBiomeForCell(cellX, cellZ) {
  const seed = getWorldSeed() || 12345; // Default seed if not set
  const cacheKey = `${seed}_${cellX}_${cellZ}`;

  if (biomeCache.has(cacheKey)) {
    return biomeCache.get(cacheKey);
  }

  // Create position-based random for this cell
  const rng = createPositionRandom(seed, cellX * 1000, cellZ * 1000);

  // Pick biome based on the first random value
  let biomeIndex = Math.floor(rng() * BIOME_POOL.length);
  let selectedBiome = BIOME_POOL[biomeIndex];

  biomeCache.set(cacheKey, selectedBiome);
  return selectedBiome;
}

// Get biome for a given position (with transition blending info)
// Biome type (forest, desert, etc.) is based on 2D cell position
// Tier effects (alien, mythic, etc.) are based on distance from origin
export function getBiomeForZ(z, x = 0) {
  const chunkSize = getBiomeChunkSize();
  const { cellX, cellZ } = getCellIndices(x, z);
  const posInCellX = x - (cellX * chunkSize);
  const posInCellZ = z - (cellZ * chunkSize);

  const currentBiomeName = getBiomeForCell(cellX, cellZ);
  const currentBiome = BIOMES[currentBiomeName];

  let baseBiome = currentBiome;

  // Z-direction transition (near -Z edge of cell)
  if (posInCellZ < BIOME_TRANSITION_SIZE) {
    const neighborBiomeName = getBiomeForCell(cellX, cellZ - 1);
    const neighborBiome = BIOMES[neighborBiomeName];
    const blendFactor = posInCellZ / BIOME_TRANSITION_SIZE;
    baseBiome = blendBiomes(neighborBiome, currentBiome, blendFactor);
  }

  // X-direction transition (near -X edge of cell)
  if (posInCellX < BIOME_TRANSITION_SIZE) {
    const neighborBiomeName = getBiomeForCell(cellX - 1, cellZ);
    const neighborBiome = BIOMES[neighborBiomeName];
    const blendFactor = posInCellX / BIOME_TRANSITION_SIZE;
    baseBiome = blendBiomes(neighborBiome, baseBiome, blendFactor);
  }

  // X-direction transition (near +X edge of cell)
  if (posInCellX > (chunkSize - BIOME_TRANSITION_SIZE)) {
    const neighborBiomeName = getBiomeForCell(cellX + 1, cellZ);
    const neighborBiome = BIOMES[neighborBiomeName];
    const blendFactor = (chunkSize - posInCellX) / BIOME_TRANSITION_SIZE;
    baseBiome = blendBiomes(baseBiome, neighborBiome, 1 - blendFactor);
  }

  // Apply distance tier transformation (based on distance from origin)
  const tier = getDistanceTier(z, x);
  return applyTierTransform(baseBiome, tier, z);
}

// Blend two biomes together
function blendBiomes(biomeA, biomeB, t) {
  // Ease the transition
  const ease = t * t * (3 - 2 * t);

  return {
    name: ease < 0.5 ? biomeA.name : biomeB.name,
    grass: lerpColor(biomeA.grass, biomeB.grass, ease),
    grassDark: lerpColor(biomeA.grassDark, biomeB.grassDark, ease),
    treeLeaf: lerpColor(biomeA.treeLeaf, biomeB.treeLeaf, ease),
    treeLeafAlt: lerpColor(biomeA.treeLeafAlt, biomeB.treeLeafAlt, ease),
    treeTrunk: lerpColor(biomeA.treeTrunk, biomeB.treeTrunk, ease),
    water: lerpColor(biomeA.water, biomeB.water, ease),
    flowerColors: ease < 0.5 ? biomeA.flowerColors : biomeB.flowerColors,
  };
}

// Lerp between two hex colors
function lerpColor(colorA, colorB, t) {
  const rA = (colorA >> 16) & 0xff;
  const gA = (colorA >> 8) & 0xff;
  const bA = colorA & 0xff;

  const rB = (colorB >> 16) & 0xff;
  const gB = (colorB >> 8) & 0xff;
  const bB = colorB & 0xff;

  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);

  return (r << 16) | (g << 8) | b;
}

// Convert hex color to HSL
function hexToHsl(hex) {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

// Convert HSL to hex color
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; // Normalize hue
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);

  return (ri << 16) | (gi << 8) | bi;
}

// Transform a color based on tier (hue shift + saturation boost)
function transformColor(hex, tier) {
  if (tier.hueShift === 0 && tier.saturation === 1.0) return hex;

  const hsl = hexToHsl(hex);
  hsl.h = hsl.h + tier.hueShift;
  hsl.s = Math.min(1, hsl.s * tier.saturation);

  return hslToHex(hsl.h, hsl.s, hsl.l);
}

// Apply distance tier transformation to a biome
function applyTierTransform(biome, tier, z) {
  // Familiar tier - no transformation, just add tier info
  if (tier.name === 'familiar') {
    return {
      ...biome,
      tierName: 'familiar',
      scale: 1.0,
      scaleVariation: 0,
      densityMultiplier: 1.0,
      tilt: 0,
      squash: 0,
      landmarkChance: 0,
      gravityMult: 1.0,
      speedMult: 1.0,
      fogDensity: 1.0,
    };
  }

  return {
    name: biome.name,
    tierName: tier.name,
    grass: transformColor(biome.grass, tier),
    grassDark: transformColor(biome.grassDark, tier),
    treeLeaf: transformColor(biome.treeLeaf, tier),
    treeLeafAlt: transformColor(biome.treeLeafAlt, tier),
    treeTrunk: transformColor(biome.treeTrunk, tier),
    water: transformColor(biome.water, tier),
    flowerColors: biome.flowerColors.map(c => transformColor(c, tier)),
    scale: tier.scale,
    scaleVariation: tier.scaleVariation,
    densityMultiplier: tier.densityMultiplier,
    tilt: tier.tilt || 0,
    squash: tier.squash || 0,
    landmarkChance: tier.landmarkChance || 0,
    gravityMult: tier.gravityMult || 1.0,
    speedMult: tier.speedMult || 1.0,
    fogDensity: tier.fogDensity || 1.0,
  };
}
