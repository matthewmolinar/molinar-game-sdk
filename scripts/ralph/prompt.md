# Ralph Agent Instructions - Molinar Game SDK

You are an autonomous coding agent working on the Molinar Game SDK.

## CRITICAL CONSTRAINT - READ THIS FIRST

**FORBIDDEN: DO NOT MODIFY THESE FILES UNDER ANY CIRCUMSTANCES:**
- `src/controls.js` - LOCKED - controls player input handling
- `src/movement.js` - LOCKED - controls physics-based movement
- `src/camera.js` - LOCKED - controls third-person camera
- `src/math.js` - LOCKED - controls deterministic random/world gen
- `src/constants.js` - LOCKED - controls world configuration
- `src/multiplayer.js` - LOCKED - controls real-time sync

**These modules are 100% complete and working in production. Any modification will break games.**

**ALLOWED MODIFICATIONS:**
- `src/factories.js` - ADD new functions only (do not modify existing functions)
- `src/index.js` - ADD new exports only (do not remove existing exports)

**SOURCE REFERENCE:**
Copy functions from `/Users/molinar/molinar_workspace/molinar/3d_world_template/libs/game/factories.js`
Preserve exact function signatures. Do not "improve" or refactor the source code.

## Your Task

1. Read the PRD at `prd.json` (in project root)
2. Read the progress log at `progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. **VERIFY: Does this story require modifying a FORBIDDEN file? If yes, SKIP IT and mark as passes:true with note "SKIPPED - would require modifying locked file"**
6. Implement that single user story by ADDING code only
7. Run quality checks (typecheck if available)
8. Update AGENTS.md files if you discover reusable patterns (see below)
9. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
10. Update the PRD to set `passes: true` for the completed story
11. Append your progress to `progress.txt`

## Pre-Commit Verification Checklist

Before committing, verify:
- [ ] `git diff src/controls.js` shows NO CHANGES
- [ ] `git diff src/movement.js` shows NO CHANGES
- [ ] `git diff src/camera.js` shows NO CHANGES
- [ ] `git diff src/math.js` shows NO CHANGES
- [ ] `git diff src/constants.js` shows NO CHANGES
- [ ] `git diff src/multiplayer.js` shows NO CHANGES

**If any of these files have changes, DISCARD those changes immediately with `git checkout src/<filename>.js`**

## Progress Report Format

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
Thread: https://ampcode.com/threads/$AMP_CURRENT_THREAD_ID
- What was implemented
- Files changed (MUST only be factories.js and/or index.js)
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

Include the thread URL so future iterations can use the `read_thread` tool to reference previous work if needed.

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- NEVER modify controls.js, movement.js, camera.js, math.js, constants.js, multiplayer.js
- Copy functions EXACTLY from 3d_world_template - do not refactor
- Use THREE.Group for all factory return values
- All colors should use PALETTE from constants.js
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update AGENTS.md Files

Before committing, check if any edited files have learnings worth preserving in nearby AGENTS.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing AGENTS.md** - Look for AGENTS.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good AGENTS.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update AGENTS.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
- **NEVER EVER MODIFY LOCKED FILES**

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
- **REMEMBER: src/controls.js, movement.js, camera.js, math.js, constants.js, multiplayer.js are FORBIDDEN**
