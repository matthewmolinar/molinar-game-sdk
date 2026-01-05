import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "./constants";
import { randFloat, randInt, choice } from "./math";

// Attach BufferGeometryUtils to THREE namespace for generated code
THREE.BufferGeometryUtils = BufferGeometryUtils;

// Colors for other players in multiplayer
const OTHER_PLAYER_COLORS = [
  0x7eb8da, // Light blue
  0xffa07a, // Light salmon
  0x98fb98, // Pale green
  0xdda0dd, // Plum
  0xf0e68c, // Khaki
];

/**
 * Create the kawaii bunny player character
 * @param {THREE.Material} playerMat - Material for the player body
 * @returns {THREE.Group} Player group with body, ears, and face
 */
export function createPlayer(playerMat) {
  const player = new THREE.Group();

  // Body - center at y=0.45 so bottom touches y=0
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), playerMat);
  body.position.set(0, 0.45, 0);
  body.castShadow = true;

  // Ears
  const earMat = playerMat;
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.12), earMat);
  earL.position.set(-0.18, 1.0, 0.15);
  const earR = earL.clone();
  earR.position.x = 0.18;

  // Face details
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.eye });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.18, 0.62, 0.46);
  eyeR.position.set(0.18, 0.62, 0.46);

  const blushMat = new THREE.MeshBasicMaterial({ color: PALETTE.blush });
  const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), blushMat);
  blushL.scale.set(1, 0.6, 0.8);
  blushL.position.set(-0.32, 0.5, 0.45);
  const blushR = blushL.clone();
  blushR.position.x = 0.32;

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), eyeMat);
  mouth.position.set(0, 0.5, 0.47);

  // Assemble
  player.add(body, earL, earR, eyeL, eyeR, blushL, blushR, mouth);
  player.userData.ears = { earL, earR };
  player.position.set(0, 0, 0);

  return player;
}

/**
 * Create another player's bunny for multiplayer
 * @param {number} colorIndex - Index into OTHER_PLAYER_COLORS (fallback)
 * @returns {THREE.Group} Player group with body, ears, and face
 */
export function createOtherPlayer(colorIndex = 0) {
  const color = OTHER_PLAYER_COLORS[colorIndex % OTHER_PLAYER_COLORS.length];
  const playerMat = new THREE.MeshLambertMaterial({ color });
  return createPlayer(playerMat);
}

/**
 * Create a player bunny with a specific color
 * @param {number|string} color - Hex color (0xffffff or "#ffffff")
 * @returns {THREE.Group} Player group with body, ears, and face
 */
export function createPlayerWithColor(color) {
  const playerMat = new THREE.MeshLambertMaterial({ color });
  const player = createPlayer(playerMat);
  // Store material reference for color updates
  player.userData.bodyMaterial = playerMat;
  return player;
}

/**
 * Update a player's body color
 * @param {THREE.Group} player - Player group created with createPlayerWithColor
 * @param {number|string} color - New hex color
 */
export function updatePlayerColor(player, color) {
  if (player.userData.bodyMaterial) {
    player.userData.bodyMaterial.color.set(color);
  }
}

/**
 * Execute accessory definition code to create a Three.js object
 * @param {string} code - The definition code from database
 * @returns {THREE.Object3D|null}
 */
function executeAccessoryDefinition(code) {
  if (!code) return null;

  try {
    let cleanCode = code.trim();

    const wrappedCode = `
      return (function(THREE) {
        ${cleanCode}
        if (typeof createObject === 'function') return createObject();
        if (typeof createAccessory === 'function') return createAccessory();
        return null;
      })(THREE);
    `;

    const factory = new Function('THREE', wrappedCode);
    return factory(THREE);
  } catch (e) {
    console.error('Failed to execute accessory code:', e);
    return null;
  }
}

/**
 * Add accessories to a player mesh
 * @param {THREE.Group} player - Player group
 * @param {string[]} accessoryIds - Array of accessory UUIDs
 * @param {Map|Object} accessoryRecords - Map or object of UUID -> database record with { id, definition, ... }
 */
export function addAccessoriesToPlayer(player, accessoryIds, accessoryRecords) {
  if (!player || !accessoryIds || !accessoryRecords) return;

  // Initialize accessories container if needed
  if (!player.userData.accessories) {
    player.userData.accessories = new Map();
  }

  // Convert to Map if object
  const recordsMap = accessoryRecords instanceof Map ? accessoryRecords : new Map(Object.entries(accessoryRecords));

  for (const id of accessoryIds) {
    // Skip if already has this accessory
    if (player.userData.accessories.has(id)) continue;

    const record = recordsMap.get(id);
    if (record?.definition) {
      try {
        const obj = executeAccessoryDefinition(record.definition);
        if (obj) {
          obj.userData.accessoryId = id;
          player.add(obj);
          player.userData.accessories.set(id, obj);
        }
      } catch (e) {
        console.error(`Failed to create accessory ${id}:`, e);
      }
    }
  }
}

/**
 * Remove all accessories from a player mesh
 * @param {THREE.Group} player - Player group
 */
export function clearPlayerAccessories(player) {
  if (!player || !player.userData.accessories) return;

  for (const [id, obj] of player.userData.accessories) {
    player.remove(obj);
    // Dispose geometries and materials
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }
  player.userData.accessories.clear();
}

/**
 * Update player accessories (removes old ones and adds new ones)
 * @param {THREE.Group} player - Player group
 * @param {string[]} accessoryIds - Array of accessory UUIDs
 * @param {Map|Object} accessoryRecords - Map or object of UUID -> database record
 */
export function updatePlayerAccessories(player, accessoryIds, accessoryRecords) {
  clearPlayerAccessories(player);
  addAccessoriesToPlayer(player, accessoryIds, accessoryRecords);
}

/**
 * Spawn sparkle particles at a position
 * @param {THREE.Scene} scene - Scene to add sparkles to
 * @param {number} px - X position
 * @param {number} py - Y position
 * @param {number} pz - Z position
 * @param {Array} sparkles - Array to track sparkle objects
 */
export function spawnSparkles(scene, px, py, pz, sparkles) {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const colors = [PALETTE.sparkle1, PALETTE.sparkle2, PALETTE.sparkle3];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    m.position.set(
      px + randFloat(-0.15, 0.15),
      py + 0.7 + randFloat(-0.05, 0.1),
      pz + randFloat(-0.1, 0.1)
    );
    m.rotation.set(randFloat(0, Math.PI), randFloat(0, Math.PI), randFloat(0, Math.PI));
    m.userData = {
      life: 0,
      vel: new THREE.Vector3(randFloat(-0.15, 0.15), randFloat(0.6, 1.0), randFloat(-0.05, 0.05)),
      spin: new THREE.Vector3(randFloat(-2, 2), randFloat(-2, 2), randFloat(-2, 2)),
    };
    sparkles.push(m);
    scene.add(m);
  }
}

/**
 * Create a Minecraft-style flat blocky cloud
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} z - Z position
 * @param {number} scale - Scale factor (default 1)
 * @returns {THREE.Group} Cloud group
 */
export function createCloud(x, y, z, scale = 1) {
  const g = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: PALETTE.cloud });
  const blockHeight = 0.4; // Thin flat clouds like Minecraft

  // Create a random blocky cloud shape using multiple boxes
  // Minecraft clouds are flat rectangular shapes
  const patterns = [
    // Pattern 1: Long cloud
    [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]],
    // Pattern 2: Square-ish cloud
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    // Pattern 3: L-shaped cloud
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 0]],
    // Pattern 4: Wide cloud
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1]],
  ];

  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const blockSize = 1.2;

  // Center the pattern
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [bx, bz] of pattern) {
    minX = Math.min(minX, bx);
    maxX = Math.max(maxX, bx);
    minZ = Math.min(minZ, bz);
    maxZ = Math.max(maxZ, bz);
  }
  const offsetX = (maxX - minX) / 2;
  const offsetZ = (maxZ - minZ) / 2;

  for (const [bx, bz] of pattern) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(blockSize, blockHeight, blockSize),
      cloudMat
    );
    block.position.set(
      (bx - offsetX) * blockSize,
      0,
      (bz - offsetZ) * blockSize
    );
    block.castShadow = false;
    block.receiveShadow = false;
    g.add(block);
  }

  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  return g;
}

// Building color palettes
const BUILDING_COLORS = {
  walls: [0xfff5e6, 0xffe4d4, 0xf5e6d3, 0xe8dcc8, 0xffeedd, 0xf0e0d0],
  roofs: [0xd45d5d, 0x7a9e7a, 0x6b8cae, 0x9b7ab8, 0xc49a6c, 0x8b6b5c],
  doors: [0x8b5a2b, 0x654321, 0x5c4033, 0x6b4423],
  windows: [0x87ceeb, 0xa5d8e6, 0x98d1e8],
};

/**
 * Create a small cabin/cottage
 * @param {number} width - Width of cabin (default 1.5)
 * @param {number} depth - Depth of cabin (default 1.5)
 * @returns {THREE.Group} Cabin group
 */
export function createCabin(width = 1.5, depth = 1.5, rng = null) {
  const g = new THREE.Group();
  const r = rng || (() => Math.random());
  const rchoice = (arr) => arr[Math.floor(r() * arr.length)];
  const height = 1.2 + r() * 0.4; // 1.2 to 1.6

  const wallColor = rchoice(BUILDING_COLORS.walls);
  const roofColor = rchoice(BUILDING_COLORS.roofs);
  const doorColor = rchoice(BUILDING_COLORS.doors);

  // Main structure
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color: wallColor })
  );
  walls.position.y = height / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;

  // Pitched roof
  const roofHeight = height * 0.5;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.75, roofHeight, 4),
    new THREE.MeshLambertMaterial({ color: roofColor })
  );
  roof.position.y = height + roofHeight / 2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.3, height * 0.5, 0.05),
    new THREE.MeshLambertMaterial({ color: doorColor })
  );
  door.position.set(0, height * 0.25, depth / 2 + 0.02);

  // Windows (one on each side)
  const windowMat = new THREE.MeshLambertMaterial({ color: rchoice(BUILDING_COLORS.windows) });
  const windowSize = Math.min(width, depth) * 0.25;
  const windowGeo = new THREE.BoxGeometry(windowSize, windowSize, 0.05);

  const windowL = new THREE.Mesh(windowGeo, windowMat);
  windowL.position.set(-width / 2 - 0.02, height * 0.6, 0);
  windowL.rotation.y = Math.PI / 2;

  const windowR = new THREE.Mesh(windowGeo, windowMat);
  windowR.position.set(width / 2 + 0.02, height * 0.6, 0);
  windowR.rotation.y = Math.PI / 2;

  g.add(walls, roof, door, windowL, windowR);
  return g;
}

/**
 * Create a house (larger than cabin, with chimney)
 * @param {number} width - Width of house (default 2.2)
 * @param {number} depth - Depth of house (default 2.0)
 * @param {function} [rng] - Optional random function for deterministic generation
 * @returns {THREE.Group} House group
 */
export function createHouse(width = 2.2, depth = 2.0, rng = null) {
  const g = new THREE.Group();
  const r = rng || (() => Math.random());
  const rchoice = (arr) => arr[Math.floor(r() * arr.length)];
  const height = 1.8 + r() * 0.6; // 1.8 to 2.4

  const wallColor = rchoice(BUILDING_COLORS.walls);
  const roofColor = rchoice(BUILDING_COLORS.roofs);
  const doorColor = rchoice(BUILDING_COLORS.doors);

  // Main structure
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color: wallColor })
  );
  walls.position.y = height / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;

  // Box roof (gabled)
  const roofHeight = height * 0.4;
  const roofGeo = new THREE.BoxGeometry(width + 0.3, roofHeight, depth + 0.3);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: roofColor }));
  roof.position.y = height + roofHeight / 2;
  roof.castShadow = true;

  // Roof peak
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry((width + 0.3) * 0.6, roofHeight * 0.6, 4),
    new THREE.MeshLambertMaterial({ color: roofColor })
  );
  peak.position.y = height + roofHeight + roofHeight * 0.3;
  peak.rotation.y = Math.PI / 4;
  peak.castShadow = true;

  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.6, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x8b4513 })
  );
  chimney.position.set(width * 0.25, height + roofHeight + 0.3, -depth * 0.2);
  chimney.castShadow = true;

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.25, height * 0.45, 0.05),
    new THREE.MeshLambertMaterial({ color: doorColor })
  );
  door.position.set(0, height * 0.22, depth / 2 + 0.02);

  // Windows
  const windowMat = new THREE.MeshLambertMaterial({ color: rchoice(BUILDING_COLORS.windows) });
  const windowGeo = new THREE.BoxGeometry(width * 0.2, height * 0.2, 0.05);

  // Front windows
  const winFL = new THREE.Mesh(windowGeo, windowMat);
  winFL.position.set(-width * 0.3, height * 0.6, depth / 2 + 0.02);
  const winFR = new THREE.Mesh(windowGeo, windowMat);
  winFR.position.set(width * 0.3, height * 0.6, depth / 2 + 0.02);

  // Side windows
  const winL = new THREE.Mesh(windowGeo, windowMat);
  winL.position.set(-width / 2 - 0.02, height * 0.6, 0);
  winL.rotation.y = Math.PI / 2;
  const winR = new THREE.Mesh(windowGeo, windowMat);
  winR.position.set(width / 2 + 0.02, height * 0.6, 0);
  winR.rotation.y = Math.PI / 2;

  g.add(walls, roof, peak, chimney, door, winFL, winFR, winL, winR);
  return g;
}

/**
 * Create a tall building/tower
 * @param {number} width - Width of building (default 1.8)
 * @param {number} depth - Depth of building (default 1.8)
 * @param {number} floors - Number of floors (default random 2-4)
 * @param {function} [rng] - Optional random function for deterministic generation
 * @returns {THREE.Group} Building group
 */
export function createTower(width = 1.8, depth = 1.8, floors = null, rng = null) {
  const g = new THREE.Group();
  const r = rng || (() => Math.random());
  const rchoice = (arr) => arr[Math.floor(r() * arr.length)];
  floors = floors || (2 + Math.floor(r() * 3)); // 2 to 4
  const floorHeight = 1.2;
  const height = floors * floorHeight;

  const wallColor = rchoice(BUILDING_COLORS.walls);
  const roofColor = rchoice(BUILDING_COLORS.roofs);

  // Main structure
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color: wallColor })
  );
  walls.position.y = height / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;

  // Flat roof with edge
  const roofBase = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.15, 0.15, depth + 0.15),
    new THREE.MeshLambertMaterial({ color: roofColor })
  );
  roofBase.position.y = height + 0.075;
  roofBase.castShadow = true;

  g.add(walls, roofBase);

  // Windows for each floor
  const windowMat = new THREE.MeshLambertMaterial({ color: rchoice(BUILDING_COLORS.windows) });
  const windowGeo = new THREE.BoxGeometry(width * 0.2, floorHeight * 0.4, 0.05);

  for (let f = 0; f < floors; f++) {
    const floorY = f * floorHeight + floorHeight * 0.6;

    // Front windows (skip ground floor - door is there)
    if (f > 0) {
      const winF = new THREE.Mesh(windowGeo, windowMat);
      winF.position.set(0, floorY, depth / 2 + 0.02);
      g.add(winF);
    }

    // Back windows
    const winB = new THREE.Mesh(windowGeo, windowMat);
    winB.position.set(0, floorY, -depth / 2 - 0.02);
    g.add(winB);

    // Side windows
    const winL = new THREE.Mesh(windowGeo, windowMat);
    winL.position.set(-width / 2 - 0.02, floorY, 0);
    winL.rotation.y = Math.PI / 2;
    g.add(winL);

    const winR = new THREE.Mesh(windowGeo, windowMat);
    winR.position.set(width / 2 + 0.02, floorY, 0);
    winR.rotation.y = Math.PI / 2;
    g.add(winR);
  }

  // Door on ground floor
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.25, floorHeight * 0.6, 0.05),
    new THREE.MeshLambertMaterial({ color: rchoice(BUILDING_COLORS.doors) })
  );
  door.position.set(0, floorHeight * 0.3, depth / 2 + 0.02);
  g.add(door);

  return g;
}

/**
 * Create a random building (cabin, house, or tower)
 * @param {function} [rng] - Optional random function for deterministic generation
 * @returns {THREE.Group} Building group
 */
export function createRandomBuilding(rng = null) {
  const types = ['cabin', 'cabin', 'house', 'house', 'tower'];
  const type = rng ? types[Math.floor(rng() * types.length)] : choice(types);
  switch (type) {
    case 'cabin': return createCabin(1.5, 1.5, rng);
    case 'house': return createHouse(2.2, 2.0, rng);
    case 'tower': return createTower(1.8, 1.8, null, rng);
    default: return createCabin(1.5, 1.5, rng);
  }
}

/**
 * Create a collectible coin (Mario/Zelda style, shiny!)
 * @param {string} type - "gold", "silver", or "gem" (default "gold")
 * @returns {THREE.Group} Coin group with spinning animation data
 */
export function createCoin(type = "gold") {
  const g = new THREE.Group();

  if (type === "gem") {
    // Gem is a diamond/crystal shape - shiny and sparkly
    const gemMat = new THREE.MeshPhongMaterial({
      color: 0xff69b4,
      emissive: 0x330011,
      shininess: 100,
      specular: 0xffffff,
    });
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      gemMat
    );
    gem.castShadow = true;

    // Inner glow
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff99cc,
      transparent: true,
      opacity: 0.4,
    });
    const glow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      glowMat
    );
    g.add(glow, gem);
  } else {
    // Gold/silver coins - shiny metallic
    const isGold = type !== "silver";
    const color = isGold ? 0xffd700 : 0xc0c0c0;
    const emissive = isGold ? 0x332200 : 0x111111;
    const specular = isGold ? 0xffffaa : 0xffffff;

    // Main coin disc - shiny material
    const coinMat = new THREE.MeshPhongMaterial({
      color,
      emissive,
      shininess: 80,
      specular,
    });
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.08, 24),
      coinMat
    );
    coin.rotation.z = Math.PI / 2;
    coin.castShadow = true;

    // Embossed star on both faces
    const starColor = isGold ? 0xffaa00 : 0x888888;
    const starMat = new THREE.MeshPhongMaterial({
      color: starColor,
      emissive: isGold ? 0x221100 : 0x050505,
      shininess: 60,
    });

    // Front star
    const star = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.02, 6),
      starMat
    );
    star.rotation.z = Math.PI / 2;
    star.position.x = 0.04;

    // Back star
    const star2 = star.clone();
    star2.position.x = -0.04;

    g.add(coin, star, star2);
  }

  // Store animation data
  g.userData = {
    type: 'coin',
    coinType: type,
    baseY: 0,
    spinSpeed: 2.5 + Math.random() * 0.5,
    bobSpeed: 2 + Math.random(),
    bobAmount: 0.1,
    collected: false,
  };

  return g;
}

/**
 * Create a fence post
 * @returns {THREE.Mesh} Fence post mesh
 */
function createFencePost() {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.7, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x8b7355 })
  );
  post.position.y = 0.35;
  post.castShadow = true;
  post.receiveShadow = true;
  return post;
}

/**
 * Create a fence segment (one tile wide)
 * @param {string} style - "wood" or "picket" (default "wood")
 * @returns {THREE.Group} Fence segment group
 */
export function createFence(style = "wood") {
  const g = new THREE.Group();
  const woodColor = 0x8b7355;
  const woodLight = 0xa08060;

  if (style === "picket") {
    // White picket fence
    const picketMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
    const picketCount = 5;
    const spacing = 0.8 / picketCount;

    for (let i = 0; i < picketCount; i++) {
      const picket = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, 0.04),
        picketMat
      );
      picket.position.set((i - (picketCount - 1) / 2) * spacing, 0.3, 0);
      picket.castShadow = true;
      g.add(picket);

      // Pointed top
      const point = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.1, 4),
        picketMat
      );
      point.position.set((i - (picketCount - 1) / 2) * spacing, 0.65, 0);
      point.rotation.y = Math.PI / 4;
      g.add(point);
    }

    // Horizontal rails
    const railMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.03), railMat);
    rail1.position.set(0, 0.2, 0);
    const rail2 = rail1.clone();
    rail2.position.y = 0.45;
    g.add(rail1, rail2);
  } else {
    // Rustic wood fence
    const postL = createFencePost();
    postL.position.x = -0.4;
    const postR = createFencePost();
    postR.position.x = 0.4;

    // Horizontal planks
    const plankMat = new THREE.MeshLambertMaterial({ color: woodLight });
    const plank1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.1, 0.05),
      plankMat
    );
    plank1.position.set(0, 0.25, 0);
    plank1.castShadow = true;

    const plank2 = plank1.clone();
    plank2.position.y = 0.5;

    g.add(postL, postR, plank1, plank2);
  }

  return g;
}

/**
 * Create a fence corner post (taller, decorative)
 * @returns {THREE.Group} Corner post group
 */
export function createFenceCorner() {
  const g = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.85, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x7a6550 })
  );
  post.position.y = 0.425;
  post.castShadow = true;

  // Cap on top
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.08, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x6b5845 })
  );
  cap.position.y = 0.89;
  cap.castShadow = true;

  g.add(post, cap);
  return g;
}

/**
 * Create a gate (openable fence segment)
 * @returns {THREE.Group} Gate group
 */
export function createGate() {
  const g = new THREE.Group();
  const woodColor = 0x8b7355;

  // Gate posts (slightly taller)
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b5845 });
  const postL = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.9, 0.15),
    postMat
  );
  postL.position.set(-0.45, 0.45, 0);
  postL.castShadow = true;

  const postR = postL.clone();
  postR.position.x = 0.45;

  // Gate door (cross-braced)
  const gateMat = new THREE.MeshLambertMaterial({ color: 0xa08060 });
  const gateFrame = new THREE.Group();

  // Vertical bars
  const barL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), gateMat);
  barL.position.set(-0.3, 0.35, 0);
  const barR = barL.clone();
  barR.position.x = 0.3;

  // Horizontal bars
  const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.04), gateMat);
  hBar1.position.set(0, 0.2, 0);
  const hBar2 = hBar1.clone();
  hBar2.position.y = 0.5;

  // Diagonal brace
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.03), gateMat);
  brace.position.set(0, 0.35, 0.01);
  brace.rotation.z = Math.atan2(0.3, 0.6);

  gateFrame.add(barL, barR, hBar1, hBar2, brace);
  g.add(postL, postR, gateFrame);

  return g;
}

/**
 * Create a lilypad for crossing water
 * @param {number} size - Size of lilypad (default 0.8)
 * @returns {THREE.Group} Lilypad group
 */
export function createLilypad(size = 0.8) {
  const g = new THREE.Group();

  // Lilypad base (flat cylinder)
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.5, size * 0.5, 0.08, 12),
    new THREE.MeshLambertMaterial({ color: 0x4a8f4a })
  );
  pad.position.y = 0.04;
  pad.receiveShadow = true;

  // Add a small notch (characteristic lilypad shape)
  const notch = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.15, 0.1, size * 0.3),
    new THREE.MeshLambertMaterial({ color: 0x5599dd }) // Water color to "cut out"
  );
  notch.position.set(size * 0.35, 0.04, 0);

  // Optional flower on some lilypads
  if (Math.random() < 0.3) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshLambertMaterial({ color: choice([0xff9ecf, 0xffffff, 0xffeb7a]) })
    );
    flower.scale.set(1, 0.6, 1);
    flower.position.set(randFloat(-0.1, 0.1), 0.15, randFloat(-0.1, 0.1));
    g.add(flower);
  }

  g.add(pad, notch);
  return g;
}

/**
 * Create a wooden bridge segment
 * @param {number} width - Width of bridge (default 1.2)
 * @param {number} length - Length of bridge (default 1.0)
 * @returns {THREE.Group} Bridge group
 */
export function createBridge(width = 1.2, length = 1.0) {
  const g = new THREE.Group();
  const woodColor = 0xb8956e;
  const woodDark = 0x8b7355;

  // Bridge planks
  const plankCount = 5;
  const plankWidth = length / plankCount;
  const plankMat = new THREE.MeshLambertMaterial({ color: woodColor });

  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, plankWidth * 0.85),
      plankMat
    );
    plank.position.set(0, 0.15, (i - (plankCount - 1) / 2) * plankWidth);
    plank.receiveShadow = true;
    plank.castShadow = true;
    g.add(plank);
  }

  // Side rails
  const railMat = new THREE.MeshLambertMaterial({ color: woodDark });
  const railL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.3, length),
    railMat
  );
  railL.position.set(-width / 2 + 0.04, 0.3, 0);
  railL.castShadow = true;

  const railR = railL.clone();
  railR.position.x = width / 2 - 0.04;

  // Support posts
  const postGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  const posts = [
    [-width / 2 + 0.05, 0.25, -length / 2 + 0.1],
    [-width / 2 + 0.05, 0.25, length / 2 - 0.1],
    [width / 2 - 0.05, 0.25, -length / 2 + 0.1],
    [width / 2 - 0.05, 0.25, length / 2 - 0.1],
  ];

  for (const [px, py, pz] of posts) {
    const post = new THREE.Mesh(postGeo, railMat);
    post.position.set(px, py, pz);
    post.castShadow = true;
    g.add(post);
  }

  g.add(railL, railR);
  return g;
}

/**
 * Create a butterfly with animated wings
 * @param {number} color - Color hex value for wings
 * @returns {THREE.Group} Butterfly group with wings and body
 */
export function createButterfly(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3026 })
  );
  const wingMat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });
  const wingGeo = new THREE.BoxGeometry(0.22, 0.14, 0.01);
  const wL = new THREE.Mesh(wingGeo, wingMat);
  const wR = new THREE.Mesh(wingGeo, wingMat);
  wL.position.set(-0.12, 0.02, 0);
  wR.position.set(0.12, 0.02, 0);
  g.add(body, wL, wR);
  g.userData = {
    wL,
    wR,
    t: randFloat(0, 1000),
    baseY: randFloat(1.2, 2.2),
    radius: randFloat(1.2, 2.6)
  };
  return g;
}

/**
 * Create a portal (blue or orange) - glowing oval standing on ground
 * @param {string} color - 'blue' or 'orange'
 * @returns {THREE.Group} Portal group with glow effects
 */
export function createPortal(color = 'blue') {
  const g = new THREE.Group();

  // Portal colors
  const portalColors = {
    blue: { main: 0x00bfff, glow: 0x87ceeb, inner: 0x001830 },
    orange: { main: 0xff8c00, glow: 0xffa500, inner: 0x301800 },
  };

  const colors = portalColors[color] || portalColors.blue;

  // Outer ring - glowing edge
  const outerRingGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 32);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: colors.main,
    transparent: true,
    opacity: 0.9,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = Math.PI / 2; // Stand upright

  // Inner ring - secondary glow
  const innerRingGeo = new THREE.TorusGeometry(1.0, 0.08, 8, 32);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: colors.glow,
    transparent: true,
    opacity: 0.7,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2;

  // Portal surface - the "hole" you walk through
  const surfaceGeo = new THREE.CircleGeometry(0.95, 32);
  const surfaceMat = new THREE.MeshBasicMaterial({
    color: colors.inner,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = Math.PI / 2;

  // Swirl effect inside portal
  const swirlGeo = new THREE.RingGeometry(0.3, 0.8, 32, 1);
  const swirlMat = new THREE.MeshBasicMaterial({
    color: colors.main,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const swirl = new THREE.Mesh(swirlGeo, swirlMat);
  swirl.rotation.x = Math.PI / 2;

  // Glow particles around the portal
  const particleCount = 8;
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({
        color: colors.glow,
        transparent: true,
        opacity: 0.6,
      })
    );
    const angle = (i / particleCount) * Math.PI * 2;
    particle.position.set(
      Math.cos(angle) * 1.3,
      0,
      Math.sin(angle) * 1.3
    );
    particle.userData.angle = angle;
    particle.userData.baseRadius = 1.3;
    particles.push(particle);
    g.add(particle);
  }

  // Assemble
  g.add(outerRing, innerRing, surface, swirl);

  // Rotate to stand upright (portal faces along Z axis)
  g.rotation.x = -Math.PI / 2;

  // Position so bottom of portal touches ground
  g.position.y = 1.2;

  // Store references for animation
  g.userData = {
    type: 'portal',
    color,
    outerRing,
    innerRing,
    swirl,
    particles,
    time: 0,
  };

  return g;
}

/**
 * Animate a portal (call each frame)
 * @param {THREE.Group} portal - Portal created with createPortal
 * @param {number} dt - Delta time in seconds
 */
export function animatePortal(portal, dt) {
  if (!portal.userData || portal.userData.type !== 'portal') return;

  portal.userData.time += dt;
  const t = portal.userData.time;

  // Rotate swirl
  if (portal.userData.swirl) {
    portal.userData.swirl.rotation.z = t * 2;
  }

  // Pulse outer ring
  if (portal.userData.outerRing) {
    const pulse = 1 + Math.sin(t * 3) * 0.05;
    portal.userData.outerRing.scale.setScalar(pulse);
  }

  // Animate particles
  if (portal.userData.particles) {
    portal.userData.particles.forEach((p, i) => {
      const angle = p.userData.angle + t * 1.5;
      const radius = p.userData.baseRadius + Math.sin(t * 4 + i) * 0.1;
      p.position.set(
        Math.cos(angle) * radius,
        Math.sin(t * 3 + i * 0.5) * 0.2,
        Math.sin(angle) * radius
      );
      p.material.opacity = 0.4 + Math.sin(t * 5 + i) * 0.2;
    });
  }
}

/**
 * Create POCHI Installation - An ancient AI facility building
 * Portal Operations Core: Holistic Intelligence
 *
 * A large structure that's been here for centuries - overgrown but still functioning
 */
export function createPochiPlatform() {
  const installation = new THREE.Group();

  // Ancient stone/concrete colors
  const stoneColor = 0x4a4a4a;
  const mossColor = 0x3d5c3d;
  const metalColor = 0x2c3e50;
  const glowOrange = 0xff8c00;
  const glowBlue = 0x00bfff;

  // Main building base - large hexagonal foundation
  const foundationGeo = new THREE.CylinderGeometry(4, 4.5, 1, 6);
  const foundationMat = new THREE.MeshLambertMaterial({ color: stoneColor });
  const foundation = new THREE.Mesh(foundationGeo, foundationMat);
  foundation.position.y = 0.5;
  installation.add(foundation);

  // Stepped platform layers (ancient temple style)
  const step1Geo = new THREE.CylinderGeometry(3.5, 4, 0.6, 6);
  const step1 = new THREE.Mesh(step1Geo, foundationMat);
  step1.position.y = 1.3;
  installation.add(step1);

  const step2Geo = new THREE.CylinderGeometry(3, 3.5, 0.5, 6);
  const step2 = new THREE.Mesh(step2Geo, foundationMat);
  step2.position.y = 1.85;
  installation.add(step2);

  // Central tower
  const towerGeo = new THREE.CylinderGeometry(2, 2.5, 4, 8);
  const towerMat = new THREE.MeshLambertMaterial({ color: metalColor });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = 4.1;
  installation.add(tower);

  // Core housing (where POCHI's "eye" lives)
  const housingGeo = new THREE.SphereGeometry(1.8, 32, 32);
  const housingMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.y = 6.5;
  installation.add(housing);

  // The Eye - POCHI's core
  const coreGeo = new THREE.SphereGeometry(1.2, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({
    color: glowOrange,
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 6.5;
  installation.add(core);

  // Pupil
  const pupilGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.set(0, 6.5, 0.8);
  installation.add(pupil);

  // Orbital rings around the eye
  const ring1Geo = new THREE.TorusGeometry(1.5, 0.08, 8, 32);
  const ring1Mat = new THREE.MeshBasicMaterial({
    color: glowOrange,
    transparent: true,
    opacity: 0.7,
  });
  const ring = new THREE.Mesh(ring1Geo, ring1Mat);
  ring.position.y = 6.5;
  ring.rotation.x = Math.PI / 2;
  installation.add(ring);

  const ring2Geo = new THREE.TorusGeometry(2.0, 0.06, 8, 32);
  const ring2Mat = new THREE.MeshBasicMaterial({
    color: glowBlue,
    transparent: true,
    opacity: 0.5,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.position.y = 6.5;
  ring2.rotation.x = Math.PI / 3;
  ring2.rotation.z = Math.PI / 4;
  installation.add(ring2);

  // Antenna array on top
  const antennaBaseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
  const antennaMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
  const antennaBase = new THREE.Mesh(antennaBaseGeo, antennaMat);
  antennaBase.position.y = 8.0;
  installation.add(antennaBase);

  const antennaGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 8);
  const antenna = new THREE.Mesh(antennaGeo, antennaMat);
  antenna.position.y = 9.25;
  installation.add(antenna);

  // Blinking tip
  const tipGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const tipMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 1,
  });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.y = 10.4;
  installation.add(tip);

  // Side pillars (ancient supports)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 5, 8);
    const pillar = new THREE.Mesh(pillarGeo, foundationMat);
    pillar.position.set(
      Math.cos(angle) * 3.2,
      3,
      Math.sin(angle) * 3.2
    );
    installation.add(pillar);

    // Pillar top decoration
    const capGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.4, 8);
    const cap = new THREE.Mesh(capGeo, foundationMat);
    cap.position.set(
      Math.cos(angle) * 3.2,
      5.7,
      Math.sin(angle) * 3.2
    );
    installation.add(cap);
  }

  // Moss/overgrowth patches (showing age)
  const mossMat = new THREE.MeshLambertMaterial({ color: mossColor });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const mossGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.2, 6, 6);
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(
      Math.cos(angle) * (3.8 + Math.random() * 0.5),
      0.3 + Math.random() * 0.3,
      Math.sin(angle) * (3.8 + Math.random() * 0.5)
    );
    moss.scale.y = 0.4;
    installation.add(moss);
  }

  // Store references for animation
  installation.userData = {
    type: 'pochi',
    core,
    pupil,
    ring,
    ring2,
    tip,
    time: 0,
  };

  // Enable shadows
  installation.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return installation;
}

/**
 * Animate POCHI platform
 */
export function animatePochiPlatform(platform, dt, playerPos = null) {
  if (!platform.userData || platform.userData.type !== 'pochi') return;

  platform.userData.time += dt;
  const t = platform.userData.time;

  // Pulse the core
  if (platform.userData.core) {
    const pulse = 0.9 + Math.sin(t * 2) * 0.1;
    platform.userData.core.material.opacity = pulse;
  }

  // Rotate rings
  if (platform.userData.ring) {
    platform.userData.ring.rotation.z = t * 0.5;
  }
  if (platform.userData.ring2) {
    platform.userData.ring2.rotation.z = -t * 0.3;
  }

  // Blink antenna tip
  if (platform.userData.tip) {
    const blink = Math.sin(t * 4) > 0.7 ? 1 : 0.2;
    platform.userData.tip.material.opacity = blink;
  }

  // Track player with pupil
  if (platform.userData.pupil && playerPos) {
    const dx = playerPos.x - platform.position.x;
    const dz = playerPos.z - platform.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      // Look towards player (limited range)
      const maxOffset = 0.2;
      const nx = (dx / dist) * Math.min(maxOffset, dist * 0.05);
      const nz = (dz / dist) * Math.min(maxOffset, dist * 0.05);
      platform.userData.pupil.position.x = nx;
      platform.userData.pupil.position.z = 0.35 + nz;
    }
  }
}
