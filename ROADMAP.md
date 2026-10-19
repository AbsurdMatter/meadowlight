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
8. Placement variation (deferred from session 1): random Y-rotation + slight
   height jitter + minimal tilt on new placements, F toggle with UI indicator,
   persisted; existing saves never re-randomized.
9. Collision-aware placement: per-type footprints block overlapping placement;
   the ghost shows the invalid state.
10. Reset button with confirmation dialog; resets world state and the
    localStorage save atomically.
11. Ambient notebook: lenient dismissal, season-aware fact variants, seen-fact
    tracking; notebook hub with learned facts and milestone states (locked
    milestones visible).
12. Deselect-first right click: right-click with a tool selected deselects the
    tool; right-click with no tool removes.

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
   postprocessing), morning/evening light warmth. Water rework: replace the
   rounded/oval pond plane with voxel water cubes consistent with the voxel
   style — no rounded edges, no clipped shoreline cutting through terrain;
   the water reads as boxes matching the terrain geometry. Gentle shimmer
   optional within the perf budget.
8. Palette grouped by type: Flowers (all six species), then Structures
   (hive, bee bath, bee hotel, hedge) — visual grouping with section labels.
9. Verify Definition of Done in AGENTS.md; tag `v0.1`.

Commit: "session 3: polish, audio, postcards — v0.1".

## De-scope order if time runs out

1. Ambient audio → move to post-v0.1
2. Postcard mode → move to post-v0.1
3. Rare pollinators → simplify to one species
4. Hedge/shelter voxels → keep static, drop mechanical wind-scoring

Never de-scope: freeform placement, bee simulation, notebook facts, seasons.

# v0.1 post-mortems (all three sessions):

### Session 1 — Voxel meadow (COMPLETE)
Delivered: Vite + TS + React + three.js (@react-three/fiber) scaffold; freeform
voxel terrain with golden-hour lighting; freeform placement with ghost preview
(zoom on left click, pan on right); six flower species (data in
src/data/plants.ts); InstancedMesh rendering per species-part (colors written
every frame — correctness over cleverness); animated sway via per-frame
instance matrices; background landscape (hills, forest, water) with warm fog;
drifting voxel clouds; clamped custom OrbitControls; localStorage save/load;
in-app perf harness (toggle key, 200-flower stress test — ~190fps observed);
test:smoke build gate (tsc + vite build); soft shadows, per-voxel color variation.
Post-review fixes: reversed pan, perf overlay R3F-hook crash, terrain
see-through holes, flower instancing regression.

Deferred to session 2: general placement variation — random Y-rotation +
slight height jitter (matching terrain) + minimal tilt (a few degrees), applied
on new placements only, toggleable with F with a UI indicator, persisted in
localStorage; existing saves never re-randomized.

### Session 2 — Pollinators (post-merge record)
Delivered: placement variation (rotation/height/tilt jitter, F toggle with UI
indicator, persisted), pollinator appeal engine, skep hive + bee bath + bee
hotel + hedges (milestone-unlocked), bee swarm foraging between placed flowers
(ID-targeted, re-resolved per frame from the placement store), season dial with
bloom succession, field notebook, milestone toasts, versioned additive save
migration (session-1 saves load without loss), collision-aware placement with
invalid ghost state, reset button with confirmation dialog, ambient notebook
with season-aware facts and seen-fact tracking, notebook hub with learned facts
and milestone states, deselect-first right-click input model.
Post-review fixes: stale-index bee targeting crash (bees held array indices;
now hold IDs re-resolved each frame), ghost/terrain parallax (flat-plane
raycast vs. rolling terrain — the offset was latent since session 1), notebook
handlers swallowing placement clicks (stopPropagation), stale ghost under UI
overlays (shared R3F pointer), right-click removal lost in the DOM-input
refactor, modal notebook requiring close-button dismissal, milestone
thresholds unreachable in normal play (toasts never fired in any real session),
dead notebook hub button (panel opened but rendered off-viewport: position:
absolute inside a corner wrapper — same bug class as the misplaced reset
dialog), acceptance-gate preview-kill exit race (scripted run now tears down
deterministically).
Lessons: never store array indices or raw object references as entity
references into mutable arrays; ghost preview and click placement must share
one resolution path; UI overlays must not capture pointer events that belong
to the canvas; a feature reported "delivered" must be observed firing, not
just implemented — milestone toasts existed in code and never fired once in
real play; verify the user-visible observable (click, then read rendered
geometry: present + in-viewport + visible), never a proxy like
innerHTML string-presence or handler invocation — the notebook hub passed
two proxy "verifications" while invisible below the fold.

### Session 3 — Polish & v0.1 (post-merge record, PR #3, merge 460b97b)
Delivered: palette regroup (Flora & nature / Bee care) with voxel thumbnails
rendered from actual models; bee hotel + wild corner with solitary bees and
rare wool-carder pollinator; postcard capture (composer-aware PNG); ambient
WebAudio (wind + bee buzz, off by default, gesture-started); 3-step onboarding
(save v4, show-once); perf pass (sway LOD, gated instance-color writes); voxel
water rework; subtle bloom + warm morning/evening light; 260 grass tufts;
ghost fidelity fix (shared pending roll); save robustness (_backup, fresh boot
on corrupt/unknown); 13 engine unit tests wired into test:smoke; CI
(test:smoke on windows-latest, #5); embed/deploy readiness (vite base './',
og tags + og-image, README embed section).
Post-review fixes (the pond epic, #21–#29, four passes): floating demo flowers
and black water traced to drift/seeder systems not sharing interactive
placement's ground truth; water blackness traced to instance-color gating
(0f65b5b) silently dropping water depth-tints; shoreline grass fringe (#26)
and grass variety/allocation (#24–#27); final restructure by user decision —
pond relocated outside the editable meadow into the hills, meadow made the
terrain's low bowl (end of the separate-layer problem), flat single-level
water, neat grid-aligned shoreline (jittered style reverted as off-brand).
Lessons: visual bugs are verified visually — geometric surveys are supporting
evidence, never proof; an audit's definition of the observable must match the
user's, or perfect math answers the wrong question (cell-ownership vs
topmost-surface); perf optimizations that gate writes are prime suspects when
a visual feature silently dies; a vision-model readback of a screenshot is a
low-fidelity judge — the user's eye wins; when human eye, geometric audit, and
vision readback disagree, look at the ground truth (the mask) — the cell-map
overlay (#30) exists because of this; "it never touches the pond" is not the
same as "harmless" when a structural misalignment is the root cause.

---

# v2 — Meadowlight after v0.1 (sessions 4–6)

Goal: v0.1 proved the loop and the process; v2 makes Meadowlight worth
returning to and worth showing off. Working order by user decision: B → A → C.
Each session independently shippable; all AGENTS.md rules and CI carry over.
Deploy goes live at the END of session 6 — the first public look is the
completed v2.

## Session 4 (B) — Everything voxel, including the chrome

Theme: the deployed artifact's chrome matches its world. Zero gameplay code.

0. P-panel expansion first (#30): cell-map debug overlay (reads the same live
   data structures placement queries — never a re-derivation), save-state
   inspector, reload-current-save, live milestone checklist. Dev/test only.
1. Voxel design language for all chrome (#16): one shared token/theme module —
   font stack (Pixelify Sans, self-hosted woff2, no runtime font fetch),
   sizes, colors, borders — switchable centrally, never hardcoded per panel.
   Applied to notebook, reset dialog, palette, toasts, onboarding, ? popover.
2. Postcard stats strip (#18): nature planted, bee care put up, bee count,
   seasons passed — nature facts, not scores. og:image regenerated from a
   real-GPU screenshot once new chrome lands.
3. Embed final polish: verify at odd aspect ratios + iframe config; og tags
   absolute-URL-ready.

Success test: any dialog next to the meadow looks like one product.

## Session 5 (A) — The living world

Theme: a second visit looks different from the first. Splittable across two
nights; units independent.

1. Flower roster expansion (#8) first — unblocks session 6 recipes. Each
   species: model, bloom season, appeal, EDUCATION.md facts, thumbnail,
   reachability unit-tested (yearRoundBloom lesson).
2. Bushes & ambient scatter (#7) on gentler edges — shares the outskirts ring
   with grass drifts, interleaved not stacked.
3. Terrain shaping (#31): flatter pond neighborhood (water safely below banks
   everywhere), much gentler meadow rim; consider the second outer rim concept
   (hills out there, calmer middle with trees/pond/shrubs/rocks).
4. Voxel background (#6): graded sky, distant terrain variation, purposeful
   clouds.
5. Butterflies & hoverflies (#15): distinct species mapped to real pollinator
   principles.
6. Day/night cycle (#13): slow, golden-hour default, fireflies at dusk.
7. Weather (#14): rain = bees home, glistening flowers; cozy, no fail state.

Perf re-verified on real GPU (session-3 baseline: 93.8fps @ 229 items) — this
session adds scene content.
Success test: two screenshots of two visits show visibly different meadows.

## Session 6 (C) — Depth mechanics

Theme: the educational heart. Needs session 5's flower roster.

1. Garden recipes / companion planting (#9): positive bonuses for companions,
   neutral for others — antagonism must never read as punishment.
2. Honey harvesting (#11): comb cells visibly fill; full hive click gives a
   jar recorded in the notebook. Observation-and-reward, no economy.
3. Auto-advancing seasons (#12): ~10–15 min/season; save stores season
   position, paused while away; manual dial + P-harness jump retained.

Verification heaviest of the three: balance traces (companion garden gently
outperforms random), full loop traces, multi-session save round-trips with
mid-season saves.
Success test: a player who understands real companion planting does measurably
better than one who doesn't.

## Post-session-6: deploy (user-driven)

Build dist/, upload, point portfolio subdomain, HTTPS. First public look =
completed v2.

## Parked until world + chrome final

#19 mobile/PWA, #20 broader i18n & harness expansion beyond #30's scope.
