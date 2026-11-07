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
   p
aths, and wild-corner patches — all voxel, all charming.
3. Pollinator appeal simulation: diversity + bloom succession + water +
   shelter drive bee population; bees visibly forage between flowers.
4. Season dial: bloom succession visible; single-species meadows show gaps.
5. Field notebook: click anything for a real, warm ecology fact.
6. Milestone unlocks appear as soft toasts, never modal blocks.
7. Save/load to localStorage; postcard screenshot button.
8. No console errors; verified by running the dev server.

### Final state (end of session 10, PR #57 head)

The session-3 DoD above is met and extended. Final state at the PR #57 head:

- Full gate suite **202 PASS / 0 FAIL** on a fresh dev server (committed
  runner `scripts/run-all-gates.ps1`, invoked per family; check-name
  consistency enforced by `gate-list-lint` in CI on every push).
- All invariants in-tree: engine unit suite (113 tests) covers the rim/ridge
  layout sweeps (#66/#83 class), the magnifier claim rules (#85), the
  postcard layout (#67), the seeding brake (#78); gate scripts parse-checked
  and linted in `test:smoke` (unit + tsc + vite build + gate lints).
- CI green on every commit of the branch (PR #57 runs all `success`).
- Every fix landed with a named commit and its issue closed with green
  evidence (the #59–#86 sweep plus #67/#76/#78 close-out fixes); the v4
  post-mortem with 13 lessons is posted on PR #57 under `## v4`.

### Session 11 DoD (v5 — the bee year, issue #91, kickoff)

The session-3 DoD and the session-10 final state above stand. Session 11
(branch `vibe/session11-beeyear`, master issue #91) is done when all of
the following hold:

1. Kickoff (R1): the suite re-verified at 202 PASS / 0 FAIL on the user's
   machine at the merged head (the first post-merge run doubles as the live
   Pages deploy check — eyeball the horizon once), this DoD and the
   check-writing canon below recorded in AGENTS.md, kickoff commit landed.
2. #87 the population curve (R2, propose-first — screenshots before any
   commit): winter keeps a lively visible cluster (never die-off), spring
   ramps as busy as summer; one shared population source read by the swarm
   and assertable by the gate (winter floor, spring slope, summer plateau);
   EDUCATION.md fact first if missing.
3. #88 solitary foraging (R3): solitary bees leave the hotel and forage all
   season; journal/magnifier claims follow the #85 ownership-first standard;
   EDUCATION.md foraging/nesting fact first.
4. #89 shorter seed codes (R4): deterministic + reversible + migration for
   existing codes (saved worlds keep loading); the postcard stamp reads
   pleasant (20 chars, not 212); fitSeedCode stays as the safety net.
5. #77 volunteer brake 40% (R5): maxVolunteerFraction 0.15 → 0.40, then the
   #87/#88 gates re-verified against the new volunteer rates.
6. Standing rules carry over unchanged: the committed runner on the user's
   machine is the verdict; propose-first for world look changes; one issue
   per cold start; a FAIL names its side (WORLD vs DETECTOR); fresh server
   before eyeball verdicts; stability-read probes; no new scope without an
   issue.

#### Final state (end of session 11, PR #93 head 3cd4783) — DoD COMPLETE

All six items above are met. R1–R5 plus #92/#94/#95 landed as named commits,
CI `smoke` green on every commit of the branch:

- R1 kickoff `5abbf29`: this DoD + the check-writing canon; #92 runner fix
  `de32f47` (PS 5.1-safe invocation block; user's PS 5.1 run = the verdict).
- R2 #87 `d231756`: bee-year curve at verdict B (winterFloor 0.45, rushing
  spring), one shared source, slope-gated (colony family 8/8).
- R3 #88 `aaed2b3`: solitary bees forage (same-frame steering root cause
  fixed), #85-standard claim checks green.
- R4 #89 `883158f`: ML2 codes (payload trim 8→5 chars/plant), ML1 migration,
  uniqueness + legacy round-trip green.
- R5 #77 `1aa2d93`: brake 0.15→0.40, gate intents moved via readback hooks.
- #95 `53c48b9` P panel wraps (no horizontal overflow, both viewports/locales);
  #94 `3cd4783` postcard carries no seed, share panel truncates preview with
  full code on copy.
- Acceptance recorded: user eyeballs (seasons, hotel, postcard, share panel,
  P panel) + committed runner full suite on Windows PowerShell 5.1 (exit 0,
  12 families). Issues closed with named evidence (#92/#87/#88/#89/#77 + the
  pre-v5 triage: #19/#20/#33/#39–#43/#47/#50/#51 closed, #44/#45/#46/#52/#54/
  #55/#56 tagged [session-12]); v5 post-mortem with 6 lessons on PR #93.

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

## Workflow & verification rules

### "Verified" means it ran, not that it compiled
"Done" and "verified" mean the app was launched in a browser and the feature was
observed working — NOT that the build compiled, types passed, or the dev server
started. Every user-facing feature must be confirmed visually/behaviorally before
reporting it complete. If a check cannot be run in this environment, say so
explicitly instead of claiming it passed.

### No silent visual regressions
Never trade visual quality for performance or refactoring. Any change to
rendering (instancing, materials, lighting, geometry) must preserve the prior
build's look: flower detail, shadows, sway animation, colors. Before a rendering
change, note the current visual state; after, compare and confirm nothing
regressed. If instancing loses per-instance color/shape/shadows, fix the
instancing — do not ship the regression.

### Branch & commi
t process
Work on a `vibe/sessionN-*` branch. Main receives changes only via pull request
after user verification. Commit in small, separately-describable units (core
work, tests, atmosphere — separate commits) and push each.

### Cross-platform scripts
All npm scripts must work on Windows (the user's machine). Spawn binaries
directly (e.g. `node_modules/typescript/bin/tsc`), never rely on shell PATH
resolution, Unix-only paths, or Unix-only flags.

### Dev-only UI hygiene
Dev overlays and debug tools must not affect the default experience: they mount
lazily (default OFF), are wrapped in an error boundary so a bug in them can
never blank the app, and never bind browser-reserved keys (F1–F12,
Ctrl/Ctrl+Shift combos). Verify the production build excludes them.

### Issue tracking: the repo is the backlog, not the chat
Bugs, verification gaps, and future ideas live in GitHub Issues — chat context is
not durable. At session start, read open issues and include any labeled for the
current session in your plan. At session end, report which issues you addressed,
fixed, or closed (with the commit/PR link). A bug found by the user in a browser
pass is filed as an issue containing the observable (how reproduced, what was
seen, what was expected) — work from the observable, never a proxy. New
session-scope bugs you find go into issues too, not just the report. Title
prefixes carry triage: [v0.1.1] = cheap patch candidate, [v2] = out of current
scope (do not implement), [blocker] = must land before merge.

### Interruption hygiene
When a task is aborted or redirected mid-flight, report the exact state the
repo was left in: partial installs, deleted files, uncommitted changes, and
anything added then abandoned.

### No rabbit holes
If a verification step requires installing system packages, native libraries,
or chasing environment dependencies (e.g. X11, browsers for headless testing),
stop and propose the simplest honest alternative (in-app harness, manual user
check) instead of
 continuing to install.

### Commit granularity is mandatory
Every session's work lands as multiple commits, each independently describable:
one commit per feature unit (e.g. placement variation, bee simulation, season
dial, notebook), not one mega-commit per session. A rule of thumb: if a commit
message needs "and" more than twice, split it. This keeps the PR reviewable,
makes regressions bisectable (`git bisect`), and lets a bad unit be reverted
without losing the session. A single "session 2" commit will be rejected —
restructure before pushing (see `git add -p` / interactive rebase).

### One input path per interaction
Placement, removal, and any click-driven feature must share a single resolution
path (resolvePlacement / one DOM input layer on the canvas). When adding UI,
never add competing pointer handlers or stopPropagation chains — they silently
swallow each other's events (this has broken both placement and right-click
removal once already). New overlays must not capture pointer events that belong
to the canvas.

### Reachability check for unlocks
Every milestone/unlock threshold must be reachable in normal play — trace a
realistic 10–20 minute session and confirm at least one unlock fires. An unlock
nobody can hit is a broken feature, not a tuned one. (Milestone toasts existed
in code for all of session 2 and never fired once in real play.)

### Features must be observed firing
"Implemented" and "works" are different claims: a feature that was coded but
never observed doing its user-visible thing (toast firing, overlay appearing,
audio playing) is NOT done. When you cannot observe it in this environment,
say so and put it on the user's manual checklist rather than reporting it as
working.

### Verify the observable, not a proxy
A UI feature is verified only when the harness checks what the user actually
experiences. For panels, toasts, and overlays that means reading rendered
geometry from the DOM: element present AND within the viewport AND visible —
nev
er string-presence in innerHTML, handler invocation, or absence of errors.
(The notebook hub shipped broken through two "verifications" that checked the
DOM for the panel's text while it rendered 850px below the fold:
position:absolute inside a small corner wrapper pushes children off-viewport —
anchor full-screen UI with position:fixed and read back its viewport rect.)

### Check enclosing headings when appending
When appending content under an existing heading (post-mortem sections, rule
lists, tables, docs of any kind), verify the heading still accurately names
the accumulated content — update the heading if the scope outgrew it.
Headings are load-bearing anchors (people link to them, agents navigate by
them); an append must never silently leave a stale label above grown content.
(A "Session 1 post-mortem" heading accumulated sessions 2 and 3 without anyone
updating it — caught by the user, not the process.)

### Comment authorship prefixes (session 9, user decision)
Every PR/issue comment starts with a role prefix on its FIRST line: the
coding agent writes **[AGENT]**, the supervising/architect agent writes
**[ARCHITECT]**. Both post under the same GitHub identity, so the prefix is
the only durable record of who said what — keep it on the first line so it
survives collapsed comment previews. Applies to all session comments from
session 9 round 2 onward; commits and issues keep their existing
conventions. The purpose is review forensics: when reading a session thread
later, the reader can tell implementation reports from verdict relays,
diagnoses, and process directives at a glance.

### Check-writing canon (session 11, issue #91)

- Toy fixtures pass vacuously — a check green on a 1-plant fixture says nothing about the real 24-plant payload (#67).
- A gate must measure the artifact the user receives — the exported JPG canvas, not the preview compose (#67).
- Green-without-a-named-reason is not closed — name the cause or harden the check (#84).
- Restart-before-verdict — stale HMR reads as a FAIL byte-identical to the pre-fix run (#65).

## Session 1 decisions (context for later sessions)
- Rendering: one InstancedMesh per species-part; instance colors are written
  every frame (correctness over cleverness — perf headroom is ~3x the budget).
- Sway: per-frame instance matrix updates; no per-object React state.
- Camera: custom OrbitControls implementation (drei was dropped); left-click
  zoom, right-click pan; clamped polar angle and distance.
- Placement variation: random rotation (Y) + slight height/tilt jitter on
  placement, toggleable with F (persisted; existing saves never re-randomized).
- Save schema lives in localStorage; keep it versioned and additive — session 2
  adds hives, milestones, season state to it.
- Perf: `npm run test:perf` in-app harness (toggle key), `npm run test:smoke`
  build gate; 60fps @ 200+ items budget.

## Session 2 decisions (context for later sessions)
- Input handling is DOM-level on the canvas, with a deselect-first right
  click: left = place (tool selected) / inspect (no tool); right = deselect
  the active tool first, and only with no tool selected doe
s right-click
  remove. preventDefault on contextmenu so the browser menu never appears.
  Ghost preview and click placement both resolve through the single
  resolvePlacement() (terrain ray-marched, so the ghost sits on the actual
  ground) — never add a second placement path.
- Pointer NDC is tracked from raw window pointermove events so the ghost keeps
  following the cursor across UI overlays (and hides when off-canvas).
- Bees target flower IDs, re-resolved from the placement store every frame —
  never array indices or raw object references into mutable arrays. A missing
  target re-targets or sends the bee home; nothing may throw from the frame
  loop.
- Occupancy: each placeable type has a footprint (radius/AABB, values in
  src/data/); overlapping placement is invalid and the ghost shows the invalid
  state, consistent with resolvePlacement().
- Reset clears world state AND the localStorage save atomically; the confirm
  dialog blocks placement input while open (modal input guard).
- Notebook fact cards are ambient, never modal: lenient dismissal (click
  outside, Escape, starting a placement), season-aware fact variants, and
  seen-fact tracking persisted in the save. Never hard-hide a fact — re-clicks
  must always show it; prefer unseen content and mark seen ones instead.
- The notebook hub (icon near the palette) shows all learned facts grouped by
  object and all milestones — locked milestones stay visible as gentle locked
  entries. Notebook opens only when no placement tool is selected
  (click-with-tool = planting, per standard builder UX).

## Session 7 decisions (context for later sessions)

- Pause fully freezes the world — simulation AND animation. There is no
  sim-frozen-but-animating state (user decision, PR #37). Implementation:
  ONE shared scaled dt (engine/scaledTime.ts) ticked from Sky.tsx's single
  time site, `dt * timeMultiplier()`, exactly 0 when paused. Every animation
  system (bees, visitors, fireflies, sway, rain, clouds, glow) c
onsumes
  `scaledDelta()`/`scaledElapsed()` from it — never R3F's raw delta or
  `clock.elapsedTime` for world motion. Perf/frame-time measurement is the
  one exception and stays RAW (a device's real frame cost must be observable
  even while the world is paused).
- Pause must be OBSERVABLE at a glance: the time-controls row dims and shows
  a "resting" state whenever paused. The paused/speed semantic lives in
  engine/timeControl.ts as the one named source; every surface (dial row,
  P panel, gates) renders from it.
- Colony force jumps (P panel / dial) KEEP THE EASE — a forced winter reads
  as the world settling into its cluster over a few seconds, never a step
  change (user decision, PR #37; the ease is the no-step-at-boundaries
  rationale applied to inspection too).
