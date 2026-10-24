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

# Session post-mortems

## v0.1 (sessions 1–3)

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

## v2 (sessions 4–6)

### Session 4 — Chrome & tooling (post-merge record, PR #32, merge f49c462)
Delivered: token/theme module + self-hosted Pixelify Sans (zero runtime font fetch); full chrome restyle (one font/border/palette across notebook, reset, palette, toasts, onboarding, popover, dial, header); typography weight hierarchy from tokens (weightHeading/weightEmphasis/headingStyle); postcard stats strip as organized list (warm, never scores); composed postcard (parchment, honey border, "Greetings from Meadowlight", stats on the card, layout computed from measured font metrics); embed polish verified at 4 odd ratios in iframes; P-panel expansion (#30): cell-map overlay (classified by the exact groundAt()/isBuildable() queries — placement-box AND, not kind alone), save-state inspector, honest reload-from-save (real load path, no save first), live milestone checklist; dev tooling excluded from prod build (lazy dev-gate); WebGL context-leak fix (one shared thumbnail renderer); reload given observable feedback (console + toast) and the <3s autosave test window documented in the tooltip.
Post-review fixes: reload button was window.location.reload() (beforeunload save overwrote the blob being tested); cell-map overlay leaked into dist and the first classification mislabeled hills plantable (groundAt kind is 'meadow' on all dry land; the placement-box AND is the truth); postcard caption band fixed at 170px clipped the fourth stat on real GPU (headless has no font rasterizer — invisible text cannot fail a pixel check; layout now derived from measureText().actualBoundingBox, unit-tested); "Too many active WebGL contexts" traced NOT to the postcard path but to palette thumbnails creating a renderer each (StrictMode double-mount -> 22 contexts past the ~16 cap; renderer.dispose() does not release the context — the canvas holds it until GC).
Lessons: measure, don't assume, font metrics in canvas layouts — and when the harness can't rasterize fonts, unit-test the layout math instead; renderer.dispose() does not release a WebGL context — share one renderer per batch, and audit the real suspects before assuming the obvious one; silent success is a bug in dev tooling — a correct no-op reload read as broken (actions need observable feedback); window.location.reload() fires beforeunload -> save(), so a reload button implemented as page reload can never test save integrity; the headless harness's limits are findings to document, not gaps to paper over; user real-GPU review caught all three pre-merge-candidate bugs (clipping, context leak, silent reload) — the eyeball gate is load-bearing.

### Session 5 — The living world (PR #35, merge 7e36213)
Delivered: flower roster 6->10 (crocus makes all-four-seasons reachable; borage/aster facts verified against sources); terrain shaping #31 (flat pond plateau, water 0.27u below banks everywhere; gentler rim then bowl lift to 0.9 after user composition verdicts; one shared shapedHeight() for oracle + renderer; distant ridge re-anchored to terrain, sunk 4.5u below anchor, hills' own palette after two rounds of floating-boxes fixes — "reads as clouds/mist" was a redesign request, not tuning); placeable Berry Bush + ambient bushlets (seeded per-instance rotation + scale jitter); banded voxel sky + composed clouds; butterflies + hoverflies on the fixed #34 steering with wildDebug telemetry; 12-min day/night cycle (golden-hour default, fireflies at dusk); gentle rain (bees home, petals glisten, audio hushes; appeal byte-identical dry vs wet — no fail state by test); P-panel trigger suite (rain, time-of-day overrides with hold/resume, firefly force) wired through the test hook; corner-overhang placement refusal via the raw cell hit.
Post-review fixes (the user real-GPU loop caught six): ghost voxel unparked (gated instanced meshes left mounted); ridge anchoring, then ridge bottoms (visual legibility is the acceptance criterion — distant terrain must read as terrain in the hills' language); bush rotation; bees-stuck regression — isDaylight used sunElevation>0.05, reading the golden-hour default (0.82) as night, so the swarm homed from every boot and survived reload while the panel printed day; fixed as the palette's own lit window (dawn 0.22 -> dusk 0.88, epsilon-tolerant, ONE shared source for bees/panel/save — two definitions of "day" is how the panel and the bees disagreed); corner placement — the raycast CLAMPED hits into the placement box, silently misclassifying overhang cells as valid; now the raw cell hit is checked against the same isPlantableCell query the cell-map overlay uses (one source, no divergence). The trigger suite found a behavioral gap on its own: bees never homed at night (rain-homing existed, day/night never touched bee behavior) — fixed per real colonies, count untouched, no punishment.
Lessons: state semantics need ONE shared definition — the panel said day while bees said night because two modules each defined it (same class as session-4's reload round-trip bug); instrument the RAW query, not a clamped/projection one (the raycast clamp made overlay, ghost, and placement disagree while each was locally "right"); a trigger suite pays for itself by exposing behavioral holes the feature gates can't see (night-homing found while verifying the triggers); gates go stale against feature commits — fix the detector, never bend behavior to a stale detector; the custom OrbitControls re-asserts the camera every frame, so proposal screenshots need a working camera path (an honest environment finding, not a "no difference" shrug); terrain acceptance is the user's composition verdict, not slope numbers; taste-first held through three terrain rounds — proposal screenshots before commit, per change; camera-path tooling is part of the proposal workflow now.

### Session 6 — Depth mechanics (post-merge record, PR #36)

Delivered: auto-advancing seasons (save v6 additive seasonProgress, ONE
advance site shared with the day clock, override dial = P-panel force
path, boundary interpretation has one home in advanceSeasons); garden
recipes (5 verified companion pairs, strictly additive — non-recipes
neutral by test, discovery toast + notebook section with cozy locked
entries, save v6 foundRecipes); honey (comb fills from observed foraging
effort, comb-as-filling-jar glow — honey voxels GROW with fill, harvest
via the hive popup and the P panel through one shared harvestHoney,
ceremony dip + fact toast on both); the hive popup itself (warm
fill-state lines, the gentle not-yet read, ground-truth hive
resolution); time controls (pause + 1x/2x/4x/8x above the season dial,
"morning" jump reusing the existing force paths, not persisted — reload
resumes natural); corner classification fix (the exact rendered hills
layout in one shared hillsLayout.ts consumed by renderer AND classifier,
hillsCover ANDed into isPlantableCell — the deterministic census caught
a fast-reject diagonal bug a sampled matrix missed); terrain retunes
(edge-anchored shallow bowl, 0.2u step, rim palette bridge with per-cell
dither, fog 34/120); bare-minimum deploy (Pages workflow, default URL;
subdomain + og:image documented post-deploy).

Perf (user real-GPU stress): PASS — 183.4fps @ 221 items (avg 5.45ms,
p95 8.3ms, max 11.1ms, budget 20ms); vs the session-3 93.8fps @ 229
baseline the safe claim is no regression with comfortable headroom at
every percentile (environments differ; not 2x). Session 6's full stack
added no measurable frame cost under load.

Lessons: the state-source pattern ran through the whole session —
isDaylight (s5) -> popup/panel hive disagreement -> wrong-hive comb
attribution (first hiveCombs entry) -> duplicate state strings -> a
seasonal fact stored as an evergreen base; the one-source rule now
includes auditing EVERY UI surface that renders a semantic (predicate,
string, and attribution). Sandbox-edit loss: a change not present in
the committed tree does not exist — commit messages describe intent,
not contents; after any history rewrite the full gate suite re-runs
before any state claim (the reflog audit showed identical trees — the
edit was lost BEFORE staging; a commit described a hunk it never
contained, and a default-camera-only gate passed it). Camera-coupling:
a world-anchored popup is camera-state-dependent by definition — test
matrices must include the ZOOM EXTREMES, not just the default camera;
a span-based lift shrinks with distance while the popup's pixel height
doesn't (clearance collapsed at zoom-out), and the x-clamp must use
the popup's full rendered width (the extended matrix caught a ~23px
edge overflow the default-camera check couldn't see); a second offset
source in the style layer silently overrides the projection (removed —
the projection is the single anchor source). Corner geometry: radial
hills vs square placement box — the standing fix is classification-
level footprint checks reading the renderer's own placement data. Gate
infrastructure under SwiftShader: long in-page evaluates die silently
('page closed', three different symptoms = the rabbit-hole signature)
— node-side scans (one evaluate per pixel), fresh pages per case,
deterministic classification census over sampled click matrices, and
skip-honestly instead of flake; R3F ThreeEvent raycasts don't fire
headless at all (canvas events verified arriving) — store-driven
verification + real-DOM button clicks, with the canvas-click flow on
the user's manual list. Terrain-retune tail: every profile change
carries dependent visuals tuned to the old profile (the brown rim band
was tuned for the ~1u bowl; the base hive fact carried seasonal copy;
fog was tuned to the pre-retune composition).

Post-merge polish backlog (user decisions): popup anchor jitter during
camera rotation (candidates: recompute on the damped camera only or
temporal smoothing; round the projected position to whole pixels for
the pixel-font chrome; batch the anchor update with the camera-asserted
frame); habitat corners — scenery covering the unplantable corner folds
(session 7's scenery unit, on the v3 roadmap).

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
completed v2. (Session 6 landed the bare-minimum Pages workflow + default URL;
the subdomain/CNAME + og:image origin swap are the documented post-deploy
steps.)

## Parked until world + chrome final

#19 mobile/PWA, #20 broader i18n & harness expansion beyond #30's scope.

---

## v3 (session 7)

### Session 7 — Seed & life (post-merge record, PR #37, merge c30081a)
Delivered: self-seeding (U1 — one seededHash source; worldSeed/seedingEpoch
join dayPhase/season as named state, save v7 additive with v6 blobs deriving
a stable per-blob seed; one seeding site riding the season-boundary
crossings; roster-compatible neighbors, per-season caps asserted on the
DELTA, and the cumulative 15% volunteer brake — pause-not-remove, planting
resumes it); seasonal wild visitors (U2 — early-spring queen bumbles on
crocuses, evening lavender moths, the summer firefly bloom COMPOSING with
the dusk fireflies (one system), autumn hoverfly stragglers; trigger-first
held — no spawn force exists; the visitor-window log, one entry per window,
persisted and rendered in the notebook); bee lifecycles gently (U3 — the
colony breath: one population semantic with an eased live state, so
populations never step at boundaries; the popup, notebook, and P inspector
render one colonyReadback; the decline-framing scan is a permanent unit
test — winter reads "clustered snug around the queen… 21°C"); pond, tree &
habitat-corner scenery (U4 + revision — fold scenery sits only on cells the
classifier proves unplantable; the named fringeCells() organic extension
(4.5u band, ground-oracle dry-land check, seeded soft falloff); the pond
edge retuned to CLUSTER-FIRST (seeded centers, tight 3–5 member groups,
calm gaps — controlled variance, never jitter); trees re-sited beside the
pond with the canopy-footprint water exclusion + pondClearance; dragonflies
over the pond on the shared scaled clock); night sky & cloud translucency
(U5 — 120-star dome at 3600s barely-perceptible drift, visibility through
the ONE shared lit-window predicate in engine/nightSky.ts (the same
DAYLIGHT constants as isDaylight), winter-brightest; composed clouds
softened to 0.55). The animation-dt fix unit: ONE shared scaled dt
(engine/scaledTime) ticked at Sky's single time site — the sim scaled but
ten animation consumers read raw delta, and pause was an invisible state;
full freeze is now named in AGENTS.md with an observable resting indicator.
Perf: user real-GPU, 27/27 behavioral gate checks green end-to-end.
Detector-only rounds throughout — three rounds of FAILs where the BEHAVIOR
was verified correct and only probes were fixed (cumulative-count vs delta
sampling; a probe inheriting the previous check's resetWorld; a threshold
reading the curve at p=0.1 mid-ease; a detector sampling before a 0.25s CSS
opacity transition began — and unpausing before reading).
Lessons: stale probe worlds — a check that inherits a prior check's world
tests the prior check's residue; probes must build their own fixtures and
read ground truth (the saved blob), never in-memory proxies. Detectors race
real UI: a re-render cadence plus a CSS transition means a "present" element
can still be mid-transition — wait past tick+transition and read before
mutating. Detector thresholds must sample a curve at a representative point
(p=0.1 sits on the wake ramp by design; assert at p=0.5) and, when a value
lags its target, assert convergence through the shared site rather than
inventing a second path to blame. The dependent-rule oracle audit miss:
fringeCells() got the ground-oracle dry-land check, the tree cluster rule
didn't — trees rendered in the pond; EVERY ground-touching rule needs the
oracle, and a rule-family change demands auditing the family, not the
touched file. RNG sequence parity: when a restructure moves or skips rolls,
two copies of "the same" deterministic layout drift apart — the tree layout
now has ONE source (engine/treeLayout.ts) that the renderer and the unit
test consume, so the test asserts the same trees the player sees. The
sandbox render limit held all session: no browser launch (glib), so
behavioral gates ran on the user's real machine while unit tests stayed
agent-side — the split worked, and the gates' honest failures were worth
the round-trips. Port-default foot-guns: gate and shots scripts now fail
with a clean "[GATE]/[SHOTS] dev server not reachable at <url>" + exit 2
instead of a raw ERR_CONNECTION_REFUSED stack. Taste-first proposals held:
one-constant retunes (star drift/density, cloud opacity, fold fill, brake
share) with NO gate pinning of taste values; proposal flags in data with
user-run capture scripts (the OrbitControls-proof manual-camera path) when
the sandbox cannot render; vision-model readbacks of screenshots stayed
overruled by the user's direct eye (session-3 rule, twice).
Deferred (carried on v3, never dropped): N1 natural seasonally-weighted
rain, N2 pollinator-visit seeding precondition, N3 magnifying-glass
inspector; deploy (Pages one-click ready; the user's subdomain, later
session). The U4 tree proposal resolved as the decided layout (canopy-
footprint exclusion, cb44aa5).

# v3 — The meadow grows (proposed, sessions 7–8)

Goal: v2 made the world alive, deep, and public; v3 makes the meadow grow on
its own and lets meadows travel between people. Same constitution: cozy,
educational, no fail states, voxel language, one shared source per semantic.
Session-7 planning refines this against the real deployed meadow.

## Session 7 — Seed & life (world deepening)

1. Self-seeding (#new): flowers occasionally volunteer a seedling in a nearby
   plantable cell — rare, capped per region, roster-compatible neighbors;
   seedlings clearable, never reading as "weeds." Tuning in src/data/; gate:
   no invasive growth pattern across an accelerated 4-season run (the v2
   speed control is the verification instrument).
2. Seasonal wild visitors (#new): extend the butterfly/hoverfly pattern —
   evening lavender moths, spring queen bumbles on crocus, summer firefly
   blooms, autumn hoverfly stragglers. Notebook records who visited when.
   Same trigger-suite rule: conditions force-able from day one; no direct
   spawn-force masking the natural condition.
3. Bee lifecycles, gently (#new): hive population breathes with the seasons —
   colony grows in spring, winter cluster (the EDUCATION.md winter-cluster
   fact earns its visual). Hard constraint: winter reads as winter, never as
   loss or decline.
4. Pond & tree habitat scenery (#new): dragonflies over the pond, pond-edge
   plants (forget-me-not already in roster), cozy ground detail around trees,
   and habitat corners — scenery (bush clusters, rocks, a log, fern-like
   detail) covering the corner fold regions where the hills intrude into the
   placement box and nothing can be planted (user decision, session 6): the
   unplantable folds read as intentional wild corners, never empty seams.
   Scenery first; no placement mechanics in scope. Facts verified, in-file
   sources.
5. Night sky & cloud translucency (#new): (a) clouds more translucent —
   softly veiled, never blocking the view, never gone (the session-5
   legibility criterion, in reverse); (b) stars at night, composed with the
   day/night grade through the same palette-lit window logic (ONE shared
   phase source, epsilon-tolerant boundaries), brightest in winter's long
   nights. Trigger-first: force-night/evening gates assert star visibility
   per phase. Eyeball: translucency feel, star density/drift.

Success test: a returning spring visitor finds their meadow changed but
never diminished — new seedlings they didn't plant, queens on the crocuses,
the hive waking — and the night sky gives the slow phases something to look at.

### Session 7 deferred scope (carried, not dropped — the repo is the backlog)

- N1 — natural, seasonally-weighted rain: rain currently toggles/holds
  via the P panel (the session-5 trigger suite); a natural weather driver
  is planned v3 work.
- N2 — pollinator-visit seeding precondition: visitors' presence as a
  precondition (or gentle boost) to volunteer seeding — the two living
  systems currently roll independently.
- N3 — magnifying-glass inspector: an inspect-mode zoom for close reads of
  small visitors (moth, hoverfly) and the winter cluster; a chrome nicety.

## Session 8 — Sharing & the wider door

6. Seed codes (#new): a seed string captures species + positions
   (deterministic from the seeded placement hash, NOT the save — season,
   jars, notebook stay local). Input at the world's front door: "start from a
   friend's seed" in the reset/new-meadow flow. Output: gentle "share this
   meadow's seed" near the postcard. Gate: same seed -> same layout across
   reloads and machines; unknown-version seed -> fresh world + preserved
   backup (the corrupt-blob pattern, applied to seeds).
7. i18n (#19 partially, #20): Slovenian first — the deployed meadow greets
   its actual audience. All copy through the existing copy modules; no
   hardcoded strings.

Success test: a friend's meadow grows the same from the seed code, and a
Slovenian visitor reads every line in their own words.

### Session 8 — Sharing & the wider door (post-merge record, PR #38, merge 4827293)
Delivered: unified magnifier inspection (flowers + wildlife + structures
through ONE kind-enum entry; ownership-first claim rules in
data/magnifierKinds — isMeshOwnedEntry/isClaimableEntry/meshMayClaim
distance-overtake WITHIN kind classes only; the defined glass interaction
grammar: click 1 dismisses card glass-stays-armed, click 2 disarms, toast
announces every state), butterfly refinements (colors/bodies/translucency),
natural seasonally-weighted precipitation (winter = snow, matte via Lambert —
unlit material read as glow), SEASON_SECONDS 720→540 (25% seasons, with the
hardcoded-literal audit), placement batching, dock/corner/onboarding anchor
geometry (hint renders ABOVE the dock), glass cursor (own SVG magnifier,
honey-accent locked state), removal refusals by construction (isRemovalRefused:
zoom OR armed glass; glass consumes its right-click), 14-check magnifier gate
(honest: real pointer paths, real event types — contextmenu not synthetic
button-2, three-click sequences, self-built fixtures, walk-until-the-resolver-
agrees targeting, exact-identity acceptance predicates), diff-style perf gate
(PASS 62.6 fps steady, machine-relative, phase split), v4 issues #39–47 seeded.
Lessons (canonize): (1) READ-green/RUN-green cuts BOTH ways — gates that
wrote stores directly, and gate-passes-world-fails (mesh races invisible to
per-check fresh-state; event-type divergence: a check proves the path it
drives, only the user's hand proves the path that exists). (2) Sequence-aware
checks: single-click passed while the two-click race lived in click #2 —
state machines, not snapshots. (3) Ownership first, distance second: a
visitor may never overtake a mesh-owned entry. (4) A stale dev server fakes
regressions — restart-before-verdict is the user's standing protocol. (5) CI
green while the gate script couldn't execute (queenPos ReferenceError) — gate
scripts get syntax-checked like code. (6) Tooltips and glass: one inspection
surface; the hive click is the HARVEST ceremony (production, not inspection)
and stays. (7) The notebook's fact-seeing migrated to the glass card —
seenFacts is a second v4 seam. (8) The resolver-inside-Canvas /
card-outside split (R3F hooks only inside). (9) Wrong-hive attribution class:
read the CLICKED instance, not entry[0] (session-6 lesson held). (10) Honest
out in checks: a walk that exhausts FAILS with a placement finding, never
loosens its predicate.

## Carry-overs standing

One shared source per semantic (seed hash joins dayPhase/season as named
state with exactly one definition); raw-query placement for anything that
checks cells; trigger-first; save v7 additive; tuning in src/data/;
taste-first with proposal screenshots for anything visual.

## ROADMAP # v4 — the meadow others meet

Theme: the meadow becomes the public portfolio artifact. The v3 door
(share-ready deploy) opens onto v4's question — what does a FIRST-TIME
visitor experience, and what does a returning one keep? Four units,
dependency-ordered; O1–O3 have no interdependencies beyond order and
can interleave. The v3 tail (CNAME, og:image, README screenshot) rides
the deploy, not this section.

### O1 — Onboarding / first-run experience (#39)

Seeded starter patch (a few flowers + a hive already placed, so the
meadow is alive on frame one), timed notebook nudges, the season dial
introduced in-fiction. Tutorial lives inside the fiction: the notebook
"notices" things, never a modal wall of text.

Constraints inherited: the onboarding hint renders ABOVE the palette
dock, never overlapping it or the corner controls (#6384003544 — the
anchor is the dock's top edge); one input path (nudges write the same
state the player's own actions write).

### O2 — Journal as first-sighting collection (#40)

The unified inspection entry (v3's landing: flowers and wildlife flow
through the ONE shared kind-enum entry into the ONE card) feeds a
permanent sighting log — inspecting gains purpose, seasons gain a goal
("seen in every season"). One source: the fact store + the kind enum;
the journal adds no new facts and no new state shapes, only a record of
what the glass has shown.

### O3 — Audio presence (#41)

Ambient bed, bee hum, rain cued from the N1 weather clock — audio reads
the same natural-condition sources the visuals do (one clock, one
truth). Self-hosted assets (the font rule applies to sound). Off by
default; the existing corner audio toggle stays the single switch.

### O4 — Touch / mobile (#42)

Pointer→touch translation, tap-to-inspect for the glass (hover has no
touch equivalent — tap is the inspect affordance), narrow-frame QA.
The bottom dock is already the mobile pattern (#6384003544 geometry:
one unwrapped corner row, reserved lanes that never overlap at any
viewport width). Finishes parked #33.

### O5 — Keyboard shortcuts (#43, user-specified)

WASD camera / Q-E rotate / R reset (inline confirm modal, never instant
— Esc dismisses) / I inspector / J journal / ESC cancel-anything.
Conventions: one input path (keys drive the SAME stores the pointer
drives — I toggles the glass's magnifierOn, J the hub's open state;
aria-pressed syncs both ways), keys ignored while typing, held-repeat
for movement vs single-fire toggles, preventDefault on consumed keys,
discoverability via O1 or a "?" hint. The ESC semantics table lives in
one place; the gate asserts I/J/ESC. Pure input translation onto
existing stores — no new clocks, no new state.

Success test: a stranger opens the deployed link, is greeted by a
living meadow, learns it in three gentle nudges, and — on a phone,
one-handed — can plant, inspect, and keep a sightings journal.
