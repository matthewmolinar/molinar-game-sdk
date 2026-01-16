# Molinar Game SDK - Agent Instructions

## CRITICAL: Locked Files

**The following files are LOCKED and must NEVER be modified:**

| File | Status | Reason |
|------|--------|--------|
| `src/controls.js` | LOCKED | Production-tested input handling |
| `src/movement.js` | LOCKED | Production-tested physics system |
| `src/camera.js` | LOCKED | Production-tested camera system |
| `src/math.js` | LOCKED | Production-tested deterministic RNG |
| `src/constants.js` | LOCKED | Production-tested world config |
| `src/multiplayer.js` | LOCKED | Production-tested realtime sync |

**These modules have 100% parity with the 3d_world_template and are working in production games. ANY modification will break games.**

## Allowed Modifications

Only these files can be modified:

- `src/factories.js` - ADD new factory functions (do not modify existing)
- `src/index.js` - ADD new exports for new functions (do not remove existing)

## Source of Truth

When adding factory functions, copy EXACTLY from:
`/Users/molinar/molinar_workspace/molinar/3d_world_template/libs/game/factories.js`

Do NOT:
- "Improve" the code
- Refactor variable names
- Add TypeScript types
- Change function signatures
- Add comments beyond what exists

## Project Structure

```
molinar-game-sdk/
├── src/
│   ├── index.js       # Main exports (ADD only)
│   ├── controls.js    # LOCKED
│   ├── movement.js    # LOCKED
│   ├── camera.js      # LOCKED
│   ├── multiplayer.js # LOCKED
│   ├── factories.js   # ADD functions here
│   ├── constants.js   # LOCKED
│   └── math.js        # LOCKED
├── package.json
├── prd.json           # Ralph task list
├── progress.txt       # Ralph learnings
└── scripts/ralph/     # Ralph automation
```

## Factory Function Pattern

All factory functions should:
1. Return a `THREE.Group` object
2. Use colors from `PALETTE` in constants.js
3. Match the exact signature from 3d_world_template

Example:
```javascript
export function createCabin(width, depth, rng) {
  const group = new THREE.Group();
  // ... geometry creation
  return group;
}
```

## Testing Integration

To test SDK changes with 3d_world_template:
1. In 3d_world_template/package.json, add: `"molinar-game-sdk": "file:../molinar-game-sdk"`
2. Run `npm install` in 3d_world_template
3. Import from `molinar-game-sdk` or `molinar-game-sdk/factories`
4. Run `npm run build` to verify

## Why These Constraints Exist

Previous agent iterations broke production games by "improving" the controls, movement, or camera systems. These systems are tightly integrated and any change to input handling, physics constants, or camera behavior breaks the user experience.

The SDK's job is to provide IDENTICAL behavior to 3d_world_template's libs/game/. It is not a place for innovation - it's a place for standardization.
