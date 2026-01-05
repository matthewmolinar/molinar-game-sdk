# Molinar Game SDK

Core game SDK for Molinar 3D multiplayer games built with Three.js.

## Installation

```bash
npm install molinar-game-sdk three
```

## Usage

```javascript
import {
  // Controls
  screenToWorldDirection,
  joystickToScreenDirection,
  setupMobileStyles,

  // Movement
  createMovementState,
  setInput,
  clearInput,
  updateMovement,
  applyToObject,
  MovementModes,

  // Camera
  createCameraState,
  updateCamera,

  // Multiplayer
  setSupabaseClient,
  createMultiplayerManager,

  // Factories
  createPlayer,

  // Constants
  PALETTE,
  TILE,
} from 'molinar-game-sdk';

// Initialize Supabase for multiplayer
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
setSupabaseClient(supabase);

// Create multiplayer manager
const multiplayer = createMultiplayerManager('my-game-room');

// Create movement state
const movementState = createMovementState(MovementModes.walk);

// Handle joystick input (camera-relative)
const handleJoystickMove = (dx, dy) => {
  const cameraAngle = cameraState.orbitAngle;
  const dir = screenToWorldDirection(dx, dy, cameraAngle);
  setInput(movementState, dir.dx, dir.dz);
};
```

## Modules

- **controls** - Camera-relative input handling
- **movement** - Physics-based movement with walk/run/swim/fly modes
- **camera** - Third-person camera with orbit and zoom
- **multiplayer** - Supabase Realtime player synchronization
- **factories** - Player and object creation
- **constants** - Color palettes, biomes, tile sizes
- **math** - Random utilities with seeding

## License

MIT
