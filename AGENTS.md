# AGENTS.md — Instructions for Mistral Code

## Project

Meadowlight is a cozy, educational voxel bee-farm building prototype.
Browser-based, fully client-side, no backend, no accounts.
The mood is "golden-hour meadow": warm, calm, gently educational.
Read `DESIGN.md` before making design decisions and `ROADMAP.md` to know
what belongs in the current session. Never work ahead of the session scope.

## Non-negotiables

- NO fail states, NO time pressure, NO negative feedback — ever.
  If the player does nothing, the meadow quietly thrives anyway.
- Voxel-first: everything is built from three.js box geometries (instanced
  where possible). No image assets, no downloaded models, no textures from
  the web. Colors and charm come from palette + composition + animation.
- Placement is freeform (no grid snapping). Slight overlap between items is
  fine and often looks good.
- Every gameplay mechanic must map to a real pollinator-ecology principle
  (see EDUCATION.md). If a mechanic can't be justified ecologically, cut it.
- All facts shown to players must come from EDUCATION.md (or be verified
  against a reliable source before adding). Warm phrasing, concrete numbers.

## Architecture

- TypeScript strict mode.
- Simulation is fully decoupled from rendering: pure, testable modules in
  `src/engine/` (fixed-timestep update), rendering reads world state from
  `src/render/`. Never import engine internals into render and vice versa;
  they communicate through the world-state store only.
- Prefer InstancedMesh for voxels, flowers, and bees. Target 60fps with
  300+ placed items on a mid-range laptop.
- Bee count must adapt to device performance (measure frame time, cap swarm).
- Keep all tuning values (colors, speeds, spawn rates) in `src/data/` files,
  never hardcoded inside components.

## Definition of done (end of session 3)

1. Voxel meadow with soft golden-hour lighting and gentle camera orbit.
2. Freeform placement of 6+ flower species, hive, bee bath, bee hotel,
   paths, and wild-corner patches — all voxel, all charming.
3. Pollinator appeal simulation: diversity + bloom succession + water +
   shelter drive bee population; bees visibly forage between flowers.
4. Season dial: bloom succession visible; single-species meadows show gaps.
5. Field notebook: click anything for a real, warm ecology fact.
6. Milestone unlocks appear as soft toasts, never modal blocks.
7. Save/load to localStorage; postcard screenshot button.
8. No console errors; verified by running the dev server.

## Workflow rules

- After completing each numbered session goal in ROADMAP.md, commit with a
  clear message referencing the goal (e.g. "session 2: seasonal bloom dial").
- If a goal proves unrealistic in the remaining session time, finish and
  polish what exists rather than leaving half-built features. A smaller,
  beautiful, working game always wins.
- Run the dev server and check the console before committing. Never commit
  a build that errors.
- Do not add features from future sessions early. Do not add features not
  listed in ROADMAP.md at all.
