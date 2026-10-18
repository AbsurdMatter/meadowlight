# ROADMAP.md — Three-Session Plan (voxel-first)

Voxel is core, not a stretch goal. Each session ends with a committable,
working, beautiful build. Follow AGENTS.md workflow rules; never work ahead.

## Session 1 — Foundations: voxel world + planting

Goal: a warm voxel meadow you can plant flowers into, freeform.

1. Vite + TS + React + three.js (@react-three/fiber) project scaffold.
2. Voxel terrain: gently rolling meadow from instanced boxes, warm palette,
   golden-hour directional light, soft shadows, OrbitControls with gentle
   damping (minimum: this must already look pretty).
3. Freeform placement system: raycast to ground, no grid snap, place with
   click, rotate with R, delete with right-click. Ghost preview follows cursor.
4. Six flower species (lavender, clover, wild poppy, sunflower, wild thyme,
   forget-me-not), each a tiny procedural voxel sculpture (4–12 boxes) with
   per-species color, height, and gentle idle sway animation.
5. Procedural voxel sky + fog + honey-warm lighting presets.
6. Data-driven plant definitions in `src/data/plants.ts`.
7. Save/load placed items to localStorage.

Commit: "session 1: voxel meadow + freeform planting".

## Session 2 — Ecology: bees, hives, simulation, notebook

Goal: the meadow comes alive and teaches.

1. Pollinator appeal engine (`src/engine/pollinator.ts`): score per area from
   flower diversity, bloom-season coverage, water proximity, shelter — pure
   functions, unit-testable.
2. Skep-style voxel hive + bee bath. Hive glow/honey visible as health vibe;
   bees per hive scale with local appeal.
3. Bee simulation: adaptive swarm of instanced voxel bees foraging between
   flowers (steering behaviors, no pathfinding needed).
4. Season dial (spring → winter): bloom succession per species; winter shows
   the quiet clustered hive.
5. Field notebook: click any object → fact card from EDUCATION.md.
6. Milestone toasts (DESIGN.md list) — soft, dismissible, never blocking.
7. Bee hotel + hedge/shelter voxels, unlockable via milestones.

Commit: "session 2: ecology simulation + notebook + seasons".

## Session 3 — Polish & completeness

Goal: v0.1 done, demo-ready.

1. Bee hotel + wild-corner mechanic complete: solitary bees (different
   size/color) nest in hotels; wild corners unlock rare pollinators.
2. Save/load the full world (placement + milestones + season) to localStorage.
3. Postcard screenshot button (renderer.domElement → PNG download).
4. Ambient audio: soft generated wind + gentle bee buzz via WebAudio
   (volume follows bee count; off by default, one toggle).
5. Onboarding: 3-step gentle overlay ("plant a flower", "click it to learn",
   "come back tomorrow" vibe) — dismissible, never required.
6. Performance pass: instancing audit, adaptive bee cap, LOD for distant voxels.
7. Visual polish: grass movement, long shadows, subtle bloom (three.js
   postprocessing), morning/evening light warmth.
8. Verify Definition of Done in AGENTS.md; tag `v0.1`.

Commit: "session 3: polish, audio, postcards — v0.1".

## De-scope order if time runs out

1. Ambient audio → move to post-v0.1
2. Postcard mode → move to post-v0.1
3. Rare pollinators → simplify to one species
4. Hedge/shelter voxels → keep static, drop mechanical wind-scoring

Never de-scope: freeform placement, bee simulation, notebook facts, seasons.
