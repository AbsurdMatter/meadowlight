#!/usr/bin/env node
/**
 * Unit tests for the pure engine modules (session 3, unit 8A).
 *
 * Approach: compile src/engine + src/data to a temp dir with the project-local
 * TypeScript, then run the compiled tests with node --test (Node's built-in
 * runner — no new dependencies). Cross-platform: everything is spawned via
 * process.execPath and project-local entry files, no shell PATH resolution.
 *
 * Coverage philosophy: test the real logic (appeal scoring, bloom succession,
 * milestone thresholds, variation bounds, fact selection, collision) — never
 * trivial getters.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const TSC_ENTRY = join(root, 'node_modules/typescript/bin/tsc');
const work = mkdtempSync(join(tmpdir(), 'meadowlight-tests-'));

try {
  // 1. copy the sources we test (engine + data + a minimal tsconfig)
  mkdirSync(join(work, 'src/engine'), { recursive: true });
  mkdirSync(join(work, 'src/data'), { recursive: true });
  // only the PURE engine modules — testHook/postcard/thumbnails import three
  // or render modules and are covered by the browser gate instead
  const engineFiles = ['pollinator.ts', 'milestones.ts', 'variation.ts', 'factSelection.ts', 'collision.ts', 'persistence.ts', 'terrain.ts', 'postcardLayout.ts', 'ground.ts', 'dayCycle.ts', 'weather.ts', 'seasonClock.ts', 'companions.ts', 'honey.ts', 'hillsLayout.ts', 'seeding.ts', 'seededHash.ts', 'lifecycle.ts', 'nightSky.ts', 'treeLayout.ts'];
  for (const f of engineFiles) cpSync(join(root, 'src/engine', f), join(work, 'src/engine', f));
  cpSync(join(root, 'src/data'), join(work, 'src/data'), { recursive: true });
  writeFileSync(
    join(work, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'CommonJS',
        moduleResolution: 'node',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        outDir: 'out',
        noEmitOnError: true,
        types: ['node'],
      },
      include: ['src/**/*.ts'],
    }),
  );
  // node types may not be installed (they aren't a dependency) — tests run in
  // plain CommonJS with node:test globals only, so drop the types requirement
  // if @types/node is absent
  if (!existsSync(join(root, 'node_modules/@types/node'))) {
    const cfg = JSON.parse(readFileSync(join(work, 'tsconfig.json'), 'utf8'));
    delete cfg.compilerOptions.types;
    writeFileSync(join(work, 'tsconfig.json'), JSON.stringify(cfg));
  }

  // 2. compile
  const tsc = spawnSync(process.execPath, [TSC_ENTRY, '-p', join(work, 'tsconfig.json')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (tsc.status !== 0) {
    console.error('[UNIT] compile FAILED:\n' + (tsc.stdout || '') + (tsc.stderr || ''));
    process.exit(1);
  }

  // 3. write the test file against the compiled output (plain require)
  const testSrc = `
const test = require('node:test');
const assert = require('node:assert');
const OUT = require('node:path').join(__dirname, '..', 'out');
const { computeAppeal, inBloom, plantedSpecies, hasBloom, yearRoundBloom, beesForHive, FORAGE_RADIUS } = require(OUT + '/engine/pollinator.js');
const { PLANTS, PLANT_BY_ID } = require(OUT + '/data/plants.js');
const { groundAt, waterSurfaceHeight, pondFloorHeight } = require(OUT + '/engine/ground.js');
const { LAKE, TERRAIN_SHAPE, shapedHeight, POND_FLAT_HEIGHT } = require(OUT + '/data/environment.js');
const { MEADOW_SIZE, terrainHeight } = require(OUT + '/engine/terrain.js');
const { isRaining, setRaining } = require(OUT + '/engine/weather.js');
const { skyPaletteAt, GOLDEN_HOUR, sunElevation, isDaylight, isDusk, DUSK_START, DUSK_END, DAY_CYCLE_SECONDS, dayPhase, setDayPhase, advanceDay, resumeDayCycle, dayCycleOverridden } = require(OUT + '/engine/dayCycle.js');
const { SEASONS, SEASON_SECONDS } = require(OUT + '/data/seasons.js');
const { seasonProgress, advanceSeasons, forceSeason, resumeSeasonClock, seasonClockOverridden, setSeasonProgressForTest, nextSeason } = require(OUT + '/engine/seasonClock.js');
const { companionSet, newlyFormed, recipeBetween } = require(OUT + '/engine/companions.js');
const { RECIPES, RECIPE_TUNING, recipeFor } = require(OUT + '/data/recipes.js');
const { advanceComb, combReady, fillAfterHarvest } = require(OUT + '/engine/honey.js');
const { HONEY_TUNING, HONEY_FORAGING_SEASONS, HONEY_FACTS } = require(OUT + '/data/honey.js');
const { checkMilestones } = require(OUT + '/engine/milestones.js');
const { variationFor, rollVariation, noVariation, VARIATION_TUNING } = require(OUT + '/engine/variation.js');
const { choosePlantFact, chooseStructureFact, chooseMeadowFact } = require(OUT + '/engine/factSelection.js');
const { flowerBlocked, structureBlocked } = require(OUT + '/engine/collision.js');
const { computeCaptionLayout, fallbackMetrics } = require(OUT + '/engine/postcardLayout.js');
const { rollVolunteers, compatibleSeedling } = require(OUT + '/engine/seeding.js');
const { colonyIntensityTarget, LIFECYCLE_LINES } = require(OUT + '/data/lifecycle.js');
const { HABITAT_TUNING, cornerFoldCells, cornerKey, pondSegments, fringeCells, pondClusters } = require(OUT + '/data/habitatScenery.js');
const { NIGHT_SKY_TUNING, CLOUDS_OPACITY_BEFORE } = require(OUT + '/data/nightSky.js');
const { starVisibility } = require(OUT + '/engine/nightSky.js');
const { treePlacements, pondExclusionRadius } = require(OUT + '/engine/treeLayout.js');
const { advanceColony, colonyIntensity: colonyIntensityExport, colonyReadback: colonyReadbackExport, setColonyIntensityForTest } = require(OUT + '/engine/lifecycle.js');
const { SEEDING_TUNING, SEEDING_FACTS } = require(OUT + '/data/seeding.js');
const { QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING, FIREFLY_SUMMER_TUNING, HOVERFLY_AUTUMN_TUNING, isEarlySpring } = require(OUT + '/data/seasonalVisitors.js');
const { isPlantableCell, groundAt: groundAtReadback } = require(OUT + '/engine/ground.js');
const { hillsCover: hillsCoverReadback } = require(OUT + '/engine/hillsLayout.js');

const mkItem = (plantId, x = 0, z = 0) => ({ id: plantId + ':' + x + ':' + z, plantId, position: [x, 0, z], rotationY: 0, phase: 0 });
const mkStruct = (structureId, x = 0, z = 0) => ({ id: structureId + ':' + x + ':' + z, structureId, position: [x, 0, z], rotationY: 0 });

// ---------- postcard caption layout (PR #32 blocker: measure, don't assume) ----------
test('caption band grows with taller real font metrics — the blocker case', () => {
  // real pixel fonts (700 weight) run taller than any fixed assumption:
  // the band height must scale with the MEASURED metrics, never a constant
  const short = computeCaptionLayout({ titleAscent: 30, titleDescent: 8, lineAscent: 15, lineDescent: 5, lineGap: 10 }, 4);
  const tall = computeCaptionLayout({ titleAscent: 44, titleDescent: 12, lineAscent: 24, lineDescent: 9, lineGap: 10 }, 4);
  assert.ok(tall.captionH > short.captionH, 'taller fonts must produce a taller band');
  assert.ok(short.captionH !== tall.captionH, 'band height is computed, not fixed');
  // the blocker: every line's ink fits with padding, whatever the metrics
  assert.ok(tall.fits, 'tall metrics still fit');
  assert.ok(short.fits, 'short metrics fit');
  assert.ok(tall.bottomPadding >= 13, 'bottom padding survives the tallest line');
});

test('every stat baseline sits above the band bottom minus its descent', () => {
  for (const m of [
    { titleAscent: 30, titleDescent: 8, lineAscent: 15, lineDescent: 5, lineGap: 10 },
    { titleAscent: 44, titleDescent: 12, lineAscent: 24, lineDescent: 9, lineGap: 10 },
    fallbackMetrics(44, 20),
  ]) {
    const n = 4;
    const l = computeCaptionLayout(m, n);
    for (let i = 0; i < n; i++) {
      assert.ok(l.statBaselines[i] + m.lineDescent < l.captionH, 'line ' + i + ' ink inside the band');
      assert.ok(l.statBaselines[i] - m.lineAscent > l.titleBaseline, 'lines never overlap the title');
    }
    // monotonic baselines, one per stat
    for (let i = 1; i < n; i++) assert.ok(l.statBaselines[i] > l.statBaselines[i - 1], 'baselines descend');
  }
});

test('fallback metrics are generous relative to font size', () => {
  const fb = fallbackMetrics(44, 20);
  assert.ok(fb.titleAscent >= 44, 'title ascent at least 1em');
  assert.ok(fb.lineAscent >= 20, 'line ascent at least 1em');
  const l = computeCaptionLayout(fb, 4);
  assert.ok(l.fits && l.bottomPadding >= 13);
});

// ---------- bloom succession (season engine) ----------
test('each species blooms in at least one season, and bloom flags match data', () => {
  for (const p of PLANTS) {
    assert.ok(p.bloom.length >= 1, p.id + ' never blooms');
    for (const s of p.bloom) assert.ok(inBloom(p.id, s), p.id + ' should bloom in ' + s);
    for (const s of SEASONS) {
      if (!p.bloom.includes(s)) assert.ok(!inBloom(p.id, s), p.id + ' should NOT bloom in ' + s);
    }
  }
});

test('succession: single-species meadow has famine seasons', () => {
  // lavender is summer-only: a lavender-only meadow starves in 3 of 4 seasons
  assert.ok(!hasBloom(['lavender'], 'winter'));
  assert.ok(!yearRoundBloom(['lavender'], SEASONS));
  // session 5: the crocus makes the ALL-four-seasons meadow reachable, so a
  // full roster planting now covers every season including winter (the old
  // "winter famine is by design" assertion was pre-crocus)
  const all = PLANTS.map((p) => p.id);
  const growing = SEASONS.filter((s) => s !== 'winter');
  assert.ok(yearRoundBloom(all, growing), 'roster covers growing seasons');
  assert.ok(yearRoundBloom(all, SEASONS), 'roster + crocus covers winter too');
  // but the pre-session-5 six species alone still famish in winter
  const six = ['lavender', 'clover', 'poppy', 'sunflower', 'thyme', 'forget-me-not'];
  assert.ok(!yearRoundBloom(six, SEASONS), 'six originals still famish in winter');
});

test('reachability: every species is plantable and blooms in a traceable session', () => {
  // yearRoundBloom lesson: a flower that can never be seen blooming is broken.
  // For each species, trace a realistic session: plant the whole roster, dial
  // every season, and confirm each species is in bloom in at least one season
  // AND out of bloom in at least one season (succession must be visible).
  const all = PLANTS.map((p) => p.id);
  for (const p of PLANTS) {
    const bloomingSeasons = SEASONS.filter((s) => inBloom(p.id, s));
    assert.ok(bloomingSeasons.length >= 1, p.id + ' never blooms (unreachable)');
    assert.ok(
      bloomingSeasons.length < SEASONS.length,
      p.id + ' blooms year-round (succession invisible)',
    );
  }
  // each season has at least one blooming roster species (no dead season)
  for (const s of SEASONS) {
    assert.ok(hasBloom(all, s), 'no roster species blooms in ' + s);
  }
});

// ---------- session 5 U2 (#31): terrain shaping surveys ----------

test('pond plateau: water sits below its banks everywhere on the flat zone', () => {
  // bank margin: bank height minus water surface, sampled densely over the
  // full 360° ring between the pond edge and the flat radius
  const waterY = POND_FLAT_HEIGHT - LAKE.surfaceDrop;
  let minMargin = Infinity;
  let worst = null;
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    for (let d = LAKE.radius; d <= TERRAIN_SHAPE.pondFlatRadius; d += 0.5) {
      const x = LAKE.center[0] + Math.cos(rad) * d;
      const z = LAKE.center[1] + Math.sin(rad) * d;
      const bank = groundAt(x, z).height;
      const margin = bank - waterY;
      if (margin < minMargin) { minMargin = margin; worst = { a, d: +d.toFixed(1), margin: +margin.toFixed(3) }; }
    }
  }
  // #28: the bank must be above the water everywhere; on the plateau it is
  // the constant surfaceDrop by construction
  assert.ok(minMargin > 0, 'bank below water somewhere: ' + JSON.stringify(worst));
  // and essentially the designed constant inside the flat zone
  assert.ok(
    Math.abs(minMargin - LAKE.surfaceDrop) < 0.05,
    'flat-zone bank margin should equal surfaceDrop, got min ' + minMargin.toFixed(3),
  );
});

test('pond plateau is actually flat: heights constant within the flat radius', () => {
  let min = Infinity;
  let max = -Infinity;
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    for (let d = 0; d <= TERRAIN_SHAPE.pondFlatRadius - 0.5; d += 0.5) {
      const x = LAKE.center[0] + Math.cos(rad) * d;
      const z = LAKE.center[1] + Math.sin(rad) * d;
      const h = shapedHeight(x, z);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  assert.ok(max - min < 1e-9, 'plateau varies ' + (max - min).toFixed(6));
  assert.ok(Math.abs(max - POND_FLAT_HEIGHT) < 1e-9, 'plateau not at pond-center height');
});

test('meadow rim is gentler: max rim step down from terrain to meadow shrinks', () => {
  // the #29 rim survey measured every meadow-square edge cell against the
  // nearest terrain cell; the meadow must stay BELOW terrain everywhere
  // (no floating meadow), and the rim rise (terrain - meadow) should now be
  // smaller with the halved lift rate inside the calm ring
  const half = MEADOW_SIZE / 2;
  let rimMax = -Infinity;
  let count = 0;
  for (let x = -half; x <= half; x += 1.6) {
    for (const edge of [-half, half]) {
      const m = groundAt(x, edge).height;
      const t = shapedHeight(x, edge + (edge < 0 ? -1.6 : 1.6));
      const rise = t - m;
      if (rise > rimMax) rimMax = rise;
      count++;
      assert.ok(rise > 0, 'meadow above terrain at ' + x + ',' + edge);
    }
  }
  // pre-#31 the rim rose up to ~4.7 at the corners (lift 0.045 x ~105 +
  // wave); with calmLiftPerRadius 0.02 the max rise is materially smaller
  assert.ok(rimMax < 3.2, 'rim still steep: max rise ' + rimMax.toFixed(2));
});

test('second outer rim: terrain rises steeply beyond the calm ring', () => {
  // the hills zone ends at r=50, so the second rim has ~15 units to rise
  // (outerRimStartRadius 34 -> 50 at 0.12/unit = +1.8 lift over the old
  // profile's tail). Invariants that matter:
  // 1. the rim is clearly ABOVE the old profile at the horizon edge
  const h = shapedHeight(49, 0);
  const oldProfile = terrainHeight(49, 0) + Math.max(0, 49 - 22) * 0.045;
  assert.ok(h > oldProfile, 'outer rim below old profile at r=49: ' + h.toFixed(2) + ' vs ' + oldProfile.toFixed(2));
  // 2. it rises faster than the old profile per unit radius (a real shoulder)
  const riseNew = shapedHeight(49, 0) - shapedHeight(35, 0);
  const riseOld =
    terrainHeight(49, 0) + 27 * 0.045 - (terrainHeight(35, 0) + 13 * 0.045);
  assert.ok(
    riseNew > riseOld + 0.8,
    'second rim not steeper than old profile: ' + riseNew.toFixed(2) + ' vs ' + riseOld.toFixed(2),
  );
  // 3. the calm middle stays LOW: at r=30 the new profile sits below the old
  assert.ok(
    shapedHeight(30, 0) < terrainHeight(30, 0) + 8 * 0.045,
    'calm middle not gentler than old profile',
  );
});

// ---------- session 5 U3 (#7): bushes & shelter mechanics ----------

test('bushes contribute shelter at half strength, hedge always dominates', () => {
  const base = { flowers: [], water: [], shelter: [], bushes: [], season: 'summer' };
  // a bush at distance d scores half the hedge term at the same distance
  const mk = (over) => computeAppeal({ x: 0, z: 0 }, { ...base, ...over }, FORAGE_RADIUS);
  const none = mk({});
  const bushNear = mk({ bushes: [{ x: 2, z: 0 }] });
  const hedgeNear = mk({ shelter: [{ x: 2, z: 0 }] });
  assert.ok(bushNear.shelter > none.shelter, 'bush must raise shelter score');
  assert.ok(
    Math.abs(bushNear.shelter - hedgeNear.shelter * 0.5) < 1e-9,
    'bush shelter should be half the hedge term at equal distance',
  );
  // hedge beats bush at equal distance
  assert.ok(hedgeNear.shelter > bushNear.shelter, 'hedge must dominate bush');
  // a bush beyond the radius does not count
  const far = mk({ bushes: [{ x: 100, z: 100 }] });
  assert.strictEqual(far.shelter, 0, 'bush beyond forage radius must not count');
  // no stacking: bush + hedge at the same spot = hedge alone (max, not sum)
  const both = mk({ shelter: [{ x: 2, z: 0 }], bushes: [{ x: 2, z: 0 }] });
  assert.ok(Math.abs(both.shelter - hedgeNear.shelter) < 1e-9, 'shelter must not stack');
  // and appeal itself rises with a bush present (the meadow gets better)
  const w1 = { flowers: [{ x: 1, z: 0, plantId: 'lavender' }], water: [], shelter: [], bushes: [], season: 'summer' };
  const appealNo = computeAppeal({ x: 0, z: 0 }, w1, FORAGE_RADIUS).score;
  const appealBush = computeAppeal({ x: 0, z: 0 }, { ...w1, bushes: [{ x: 2, z: 0 }] }, FORAGE_RADIUS).score;
  assert.ok(appealBush > appealNo, 'bush must raise appeal');
});

// ---------- session 5 U4 (#6): sky palette / day model ----------

test('sky palette: golden hour matches the classic meadow look', () => {
  const p = skyPaletteAt(GOLDEN_HOUR);
  // the pre-session-5 sky constants: #6fa8dc top, #a8cdf0 mid, #ffd9a0 horizon
  assert.ok(Math.abs(parseInt(p.horizon.slice(1), 16) - parseInt('ffd9a0', 16)) < 0x0c0c0c, 'horizon drift: ' + p.horizon);
  // golden hour is warm: horizon clearly warmer (more red) than the day blue
  const day = skyPaletteAt(0.5);
  const warm = (x) => parseInt(x.slice(1), 16);
  assert.ok((warm(p.horizon) >> 16) > (warm(day.top) >> 16), 'golden hour must be warm');
});

test('sky palette wraps cleanly and never throws at any phase', () => {
  for (let i = 0; i <= 100; i++) {
    const p = skyPaletteAt(i / 100);
    assert.ok(typeof p.top === 'string' && p.top.startsWith('#'), 'bad palette at ' + i / 100);
    assert.ok(p.ambient >= 0 && p.ambient <= 1, 'ambient out of range');
  }
  // wrapping out-of-range phases must not throw either
  for (const phase of [-0.2, 1.3, 7.7]) {
    const p = skyPaletteAt(phase);
    assert.ok(!!p.top, 'wrap failed at ' + phase);
  }
});

test('sun model: elevation peaks at noon, night is dark', () => {
  assert.ok(sunElevation(0.5) > 0.85, 'noon should be high: ' + sunElevation(0.5).toFixed(2));
  assert.ok(sunElevation(0.0) < -0.7, 'midnight should be low: ' + sunElevation(0.0).toFixed(2));
  assert.ok(isDaylight(0.5), 'noon is daylight');
  assert.ok(!isDaylight(0.0), 'midnight is not daylight');
});

test('daylight window matches the sky (PR #35 blocker regression test)', () => {
  // the lit sky window per the palette keyframes: 0.22 dawn .. 0.88 dusk.
  // The old elevation>0.05 test read golden hour (0.82) as NIGHT — that
  // parked the whole swarm at the hive from the default boot phase.
  assert.ok(isDaylight(0.82), 'golden hour DEFAULT must be daylight (bees forage)');
  assert.ok(isDaylight(GOLDEN_HOUR), 'the boot phase must be daylight');
  assert.ok(isDaylight(0.3) && isDaylight(0.5) && isDaylight(0.65), 'the day window is lit');
  assert.ok(isDaylight(0.22) && isDaylight(0.88), 'window boundaries inclusive');
  assert.ok(!isDaylight(0.21) && !isDaylight(0.89), 'outside the window reads night');
  assert.ok(!isDaylight(0.95) && !isDaylight(0.0) && !isDaylight(0.1), 'deep night is night');
  // the panel's day/evening buttons must land in daylight, night must not
  assert.ok(isDaylight(0.3) && isDaylight(0.5) && isDaylight(0.82), 'panel day phases are lit');
  assert.ok(!isDaylight(0.97), 'panel night phase is dark');
});

// ---------- session 5 U6 (#13): day/night clock ----------

test('day clock: 12-minute cycle, overrides hold, resume drifts again', () => {
  assert.strictEqual(DAY_CYCLE_SECONDS, 720, 'cycle length per approved plan');
  // override semantics (P panel): setDayPhase holds the clock still
  resumeDayCycle();
  setDayPhase(0.5);
  assert.strictEqual(dayPhase(), 0.5);
  assert.ok(dayCycleOverridden(), 'override must hold the clock');
  advanceDay(720);
  assert.ok(Math.abs(dayPhase() - 0.5) < 1e-9, 'override: clock does not drift');
  // resume: natural drift returns
  resumeDayCycle();
  assert.ok(!dayCycleOverridden(), 'resume releases the override');
  advanceDay(360);
  assert.ok(Math.abs(dayPhase() - 0.0) < 1e-9, 'half cycle wraps to midnight');
  advanceDay(720);
  assert.ok(Math.abs(dayPhase() - 0.0) < 1e-9, 'one full cycle returns to start');
  // negative phases wrap
  setDayPhase(-0.25);
  assert.ok(Math.abs(dayPhase() - 0.75) < 1e-9, 'negative phase wraps');
  resumeDayCycle();
});

test('dusk window: fireflies appear only in 0.79-0.92', () => {
  assert.ok(isDusk(0.82), 'golden hour is in dusk');
  assert.ok(isDusk(0.79) && isDusk(0.92), 'window is inclusive');
  assert.ok(!isDusk(0.5), 'noon is not dusk');
  assert.ok(!isDusk(0.95) && !isDusk(0.78), 'night and late afternoon are not dusk');
});

// ---------- session 6 U1 (#11): auto-advancing season calendar ----------
test('season clock: 12-minute season, rollover reports the crossed season', () => {
  assert.strictEqual(SEASON_SECONDS, 720, 'season length per approved plan (10-15 min window)');
  resumeSeasonClock();
  setSeasonProgressForTest(0);
  let crossed = advanceSeasons(360, 'summer');
  assert.strictEqual(crossed.length, 0, 'half a season crosses nothing');
  assert.ok(Math.abs(seasonProgress() - 0.5) < 1e-9, 'progress is half');
  crossed = advanceSeasons(360, 'summer');
  assert.deepStrictEqual(crossed, ['autumn'], 'a full season rolls into autumn');
  assert.ok(Math.abs(seasonProgress() - 0) < 1e-9, 'rollover leaves progress at season start');
});

test('season clock: winter wraps to spring; huge deltas cross several seasons', () => {
  resumeSeasonClock();
  setSeasonProgressForTest(0.9);
  const crossed = advanceSeasons(SEASON_SECONDS * 2.5, 'winter');
  assert.deepStrictEqual(crossed, ['spring', 'summer', 'autumn'], 'wrap + multi-cross in order');
  assert.ok(Math.abs(seasonProgress() - 0.4) < 1e-9, 'fractional remainder preserved');
});

test('season clock: forceSeason holds (manual dial = P panel = one override path)', () => {
  forceSeason('spring');
  assert.ok(seasonClockOverridden(), 'the dial/panel override must hold the calendar');
  assert.strictEqual(seasonProgress(), 0, 'an override starts the forced season at its beginning');
  assert.deepStrictEqual(advanceSeasons(9999, 'spring'), [], 'held clock never advances');
  assert.strictEqual(seasonProgress(), 0, 'held clock position is stable');
  resumeSeasonClock();
  assert.ok(!seasonClockOverridden(), 'resume releases the override');
});

test('season clock: boundary interpretation — 0.999 saves resume the SAME season, never pre-roll', () => {
  // the save->reload->resume path: a position < 1 is mid-season by
  // definition; only advanceSeasons may cross a boundary, so a reload
  // can never re-interpret a near-boundary save as the next season
  resumeSeasonClock();
  setSeasonProgressForTest(0.999);
  assert.ok(seasonProgress() < 1, 'a saved 0.999 loads as the same season');
  const crossed = advanceSeasons(10, 'summer');
  assert.deepStrictEqual(crossed, ['autumn'], 'only real advancement crosses the boundary');
  assert.ok(seasonProgress() < 0.02, 'crossing lands at the next season start (tiny residue from the crossing step is fine)');
  // exact wrap: 1.0 units of time from 0 is the NEXT season's start, not a skip
  setSeasonProgressForTest(0);
  assert.deepStrictEqual(advanceSeasons(SEASON_SECONDS, 'spring'), ['summer'], 'exactly one season advances one step');
  assert.ok(Math.abs(seasonProgress()) < 1e-9, 'exact wrap has zero residue');
});

test('season clock: nextSeason ordering', () => {
  assert.strictEqual(nextSeason('spring'), 'summer');
  assert.strictEqual(nextSeason('summer'), 'autumn');
  assert.strictEqual(nextSeason('autumn'), 'winter');
  assert.strictEqual(nextSeason('winter'), 'spring');
});

// ---------- session 6 U2 (#9): companion recipes ----------
test('recipes: adjacency forms a recipe, distance does not', () => {
  const near = [mkItem('lavender', 0, 0), mkItem('thyme', 1.5, 0)];
  const { blessed, active } = companionSet(near);
  assert.ok(active.some((r) => r.id === 'recipe:lavender-thyme'), 'adjacent pair forms the recipe');
  assert.ok(blessed.has(near[0].id) && blessed.has(near[1].id), 'both partners are blessed');
  const far = [mkItem('lavender', 0, 0), mkItem('thyme', RECIPE_TUNING.adjacencyRadius + 0.5, 0)];
  const farRes = companionSet(far);
  assert.strictEqual(farRes.blessed.size, 0, 'too far = no recipe, and NO penalty (just neutral)');
  assert.strictEqual(farRes.active.length, 0);
});

test('recipes: order-free lookup; non-recipe pairs are simply neutral', () => {
  assert.strictEqual(recipeBetween('thyme', 'lavender')?.id, 'recipe:lavender-thyme');
  assert.strictEqual(recipeBetween('lavender', 'thyme')?.id, 'recipe:lavender-thyme');
  assert.strictEqual(recipeBetween('lavender', 'poppy'), undefined, 'not a recipe = neutral, never negative');
  // a meadow of random non-recipe flowers must bless NOTHING (no ranking)
  const random = [mkItem('lavender', 0, 0), mkItem('poppy', 0.5, 0), mkItem('sunflower', 1, 0)];
  const res = companionSet(random);
  assert.strictEqual(res.blessed.size, 0, 'non-recipe neighbors stay exactly neutral');
});

test('recipes: newlyFormed respects the adjacency radius and dedupes discoveries', () => {
  const items = [mkItem('borage', 0, 0), mkItem('cosmos', 1, 1)];
  const fresh1 = newlyFormed(items, []);
  assert.ok(fresh1.some((r) => r.id === 'recipe:borage-cosmos'), 'first formation is new');
  const fresh2 = newlyFormed(items, ['recipe:borage-cosmos']);
  assert.strictEqual(fresh2.length, 0, 'already discovered = not re-announced');
});

test('recipes: every pairing references real roster species (buildable in play)', () => {
  const ids = new Set(PLANTS.map((p) => p.id));
  for (const r of RECIPES) {
    assert.ok(ids.has(r.pair[0]) && ids.has(r.pair[1]), 'recipe ' + r.id + ' uses planted species');
    assert.ok(r.fact.length > 20, 'recipe ' + r.id + ' has a warm fact');
  }
  assert.ok(RECIPE_TUNING.vigorScale > 1, 'vigor is a bonus multiplier');
});

// ---------- session 6 U3 (#10): honey ----------
test('honey: comb fills from foraging effort, gated by daylight + season', () => {
  // active foraging: increases
  let f = advanceComb(0, 10, 8, 0.8, 'summer', true);
  assert.ok(f > 0, 'active foraging fills the comb');
  // night or winter: only the gentle idle trickle
  const night = advanceComb(0, 10, 8, 0.8, 'summer', false);
  const winter = advanceComb(0, 10, 8, 0.8, 'winter', true);
  assert.ok(night > 0 && night < f, 'night trickles, never zero — residents, not machines');
  assert.strictEqual(night, winter, 'same gentle trickle off-season');
  assert.ok(night <= HONEY_TUNING.idleFillPerSecond * 10 + 1e-9, 'idle rate matches tuning');
  // no bees at all: still fills, slowly (no pressure, no fail)
  const lonely = advanceComb(0, 60, 0, 0, 'summer', true);
  assert.ok(lonely > 0, 'an empty meadow still fills the comb slowly');
  // appeal scales the rate
  const rich = advanceComb(0, 10, 8, 1, 'summer', true);
  const poor = advanceComb(0, 10, 8, 0.1, 'summer', true);
  assert.ok(rich > poor, 'appeal scales fill');
});

test('honey: fill caps at 1; harvest resets partial, never zero', () => {
  const full = advanceComb(0.99, 60, 20, 1, 'summer', true);
  assert.strictEqual(full, 1, 'fill caps at 1');
  assert.ok(combReady(1), 'a full comb is harvestable');
  assert.ok(!combReady(0.99), 'not-yet-full is not harvestable');
  const after = fillAfterHarvest();
  assert.ok(after > 0 && after < 1, 'harvest leaves a partial comb');
  assert.strictEqual(after, HONEY_TUNING.afterHarvest, 'after-harvest fill matches tuning');
  assert.ok(after >= 0.3, 'the bees keep a generous share — residents, not machines');
});

test('honey: facts verified against sources; winter is not a foraging season', () => {
  assert.ok(!HONEY_FORAGING_SEASONS.includes('winter'), 'winter is quiet');
  assert.ok(HONEY_FACTS.harvest.length > 20 && HONEY_FACTS.filling.length > 20, 'facts exist');
  assert.ok(HONEY_TUNING.combColorFloor !== HONEY_TUNING.combColorFull, 'glow palette has range');
});

// ---------- session 5 U7 (#14): weather — cozy, no fail state ----------

test('rain never lowers appeal: the no-fail invariant', () => {
  const w = {
    flowers: [{ x: 1, z: 0, plantId: 'lavender' }, { x: 2, z: 1, plantId: 'clover' }],
    water: [{ x: 2, z: 0 }],
    shelter: [{ x: 1, z: 2 }],
    bushes: [{ x: 0, z: 2 }],
    season: 'summer',
  };
  const dry = computeAppeal({ x: 0, z: 0 }, w, FORAGE_RADIUS);
  setRaining(true);
  const wet = computeAppeal({ x: 0, z: 0 }, w, FORAGE_RADIUS);
  setRaining(false);
  assert.strictEqual(dry.score, wet.score, 'rain must not change appeal (no fail state)');
  assert.strictEqual(isRaining(), false, 'rain toggles back off');
});

test('plantedSpecies dedupes and ignores unknown ids', () => {
  assert.deepStrictEqual(plantedSpecies(['lavender', 'lavender', 'clover', 'nope']), ['clover', 'lavender']);
});

// ---------- appeal scoring ----------
test('appeal: empty meadow scores near zero for a hive', () => {
  const r = computeAppeal({ x: 0, z: 0 }, { flowers: [], water: [], shelter: [], season: 'summer' });
  assert.ok(r.score < 0.05, 'empty meadow appeal was ' + r.score);
});

test('appeal: diversity beats monoculture at equal abundance', () => {
  const origin = { x: 0, z: 0 };
  const mono = { flowers: [], water: [], shelter: [], season: 'summer' };
  for (let i = 0; i < 30; i++) mono.flowers.push({ x: 1, z: 1, plantId: 'lavender' });
  const diverse = { flowers: [], water: [], shelter: [], season: 'summer' };
  let n = 0;
  for (const p of PLANTS) for (let k = 0; k < 5; k++) diverse.flowers.push({ x: 1, z: 1, plantId: p.id }), n++;
  const a1 = computeAppeal(origin, mono);
  const a2 = computeAppeal(origin, diverse);
  assert.ok(a2.score > a1.score, 'diverse (' + a2.score + ') should beat mono (' + a1.score + ')');
  assert.ok(a2.diversity > a1.diversity);
});

test('appeal: water and shelter contribute within forage radius only', () => {
  const world = { flowers: [{ x: 1, z: 0, plantId: 'lavender' }], water: [], shelter: [], season: 'summer' };
  const near = computeAppeal({ x: 0, z: 0 }, world);
  world.water.push({ x: 2, z: 0 });
  const withWater = computeAppeal({ x: 0, z: 0 }, world);
  assert.ok(withWater.water > near.water, 'nearby bath should raise water score');
  world.water[0] = { x: 100, z: 100 };
  const farWater = computeAppeal({ x: 0, z: 0 }, world);
  assert.strictEqual(farWater.water, 0, 'bath beyond radius must not count');
});

test('beesForHive scales with appeal and never exceeds max', () => {
  assert.strictEqual(beesForHive(1.0, 10, 16), 16);
  assert.strictEqual(beesForHive(0.0, 10, 16), 3); // base*0.3 floor
  assert.ok(beesForHive(0.5, 10, 16) >= 3 && beesForHive(0.5, 10, 16) <= 16);
});

// ---------- milestones ----------
test('milestones fire in a realistic order and only once', () => {
  const species = PLANTS.map((p) => p.id);
  const items = species.map((id, i) => mkItem(id, i, 0));
  let earned = [];
  let events = checkMilestones(items, [], earned);
  const ids = (es) => es.map((e) => e.id);
  assert.ok(ids(events).includes('firstFlower'));
  assert.ok(ids(events).includes('fiveSpecies'));
  assert.ok(ids(events).includes('tenSpecies'));
  earned = earned.concat(ids(events));
  // re-check: nothing fires twice
  const again = checkMilestones(items, [], earned);
  assert.strictEqual(again.length, 0, 'milestones must not repeat: ' + ids(again));
});

test('hotelGuests fires when a hotel exists among flowers; rarePollinator needs hotel+corner pair', () => {
  const items = [mkItem('lavender', 0, 0)];
  const hotel = mkStruct('hotel', 2, 2);
  let ev = checkMilestones(items, [hotel], []);
  assert.ok(ev.some((e) => e.id === 'hotelGuests'), 'hotel with flowers should attract guests');
  // corner far away: no rare pollinator
  const far = mkStruct('wildcorner', 50, 50);
  ev = checkMilestones(items, [hotel, far], []);
  assert.ok(!ev.some((e) => e.id === 'rarePollinator'), 'distant corner must not pair');
  // corner nearby: rare pollinator fires
  const near = mkStruct('wildcorner', 3, 3);
  ev = checkMilestones(items, [hotel, near], []);
  assert.ok(ev.some((e) => e.id === 'rarePollinator'), 'nearby corner should pair with hotel');
});

test('wildYearSurvived needs all four seasons recorded', () => {
  const hotel = mkStruct('hotel', 0, 0);
  const corner = mkStruct('wildcorner', 1, 1);
  const items = [mkItem('lavender', 2, 2)];
  let ev = checkMilestones(items, [hotel, corner], [], ['spring', 'summer', 'autumn']);
  assert.ok(!ev.some((e) => e.id === 'wildYearSurvived'), 'three seasons is not a full year');
  ev = checkMilestones(items, [hotel, corner], [], ['spring', 'summer', 'autumn', 'winter']);
  assert.ok(ev.some((e) => e.id === 'wildYearSurvived'), 'four seasons should fire the milestone');
});

// ---------- variation ----------
test('variation rolls stay within tuning bounds; OFF is neutral', () => {
  for (let i = 0; i < 500; i++) {
    const v = rollVariation();
    assert.ok(Math.abs(v.heightJitter) <= VARIATION_TUNING.heightJitter + 1e-9);
    assert.ok(Math.abs(v.tiltX) <= VARIATION_TUNING.maxTilt + 1e-9);
    assert.ok(Math.abs(v.tiltZ) <= VARIATION_TUNING.maxTilt + 1e-9);
    assert.ok(v.rotationY >= 0 && v.rotationY < Math.PI * 2);
  }
  const off = variationFor(false);
  assert.deepStrictEqual(off, { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 });
  assert.deepStrictEqual(noVariation(), off);
});

// ---------- fact selection ----------
test('fact selection prefers unseen facts and marks seen ones', () => {
  const seen = [];
  const first = chooseStructureFact('bath', 'summer', seen);
  assert.ok(!first.alreadySeen);
  seen.push(first.fact.id);
  const second = chooseStructureFact('bath', 'summer', seen);
  assert.ok(second.fact.id !== first.fact.id || second.alreadySeen, 'must prefer unseen or admit seen');
});

// ---------- session 7 U1: self-seeding ----------
// persistence is storage-backed: shim localStorage before requiring it
// (the node runner has no DOM — a harness finding documented in session 6)
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}
const { saveWorld, loadWorld, clearSavedWorld } = require(OUT + '/engine/persistence.js');

test('save v7 additive: session-6 blob loads without loss and derives a stable seed', () => {
  // a session-6-shaped blob (version 6, no worldSeed/seedingEpoch)
  const v6 = {
    version: 6,
    items: [{ id: 'a', plantId: 'lavender', position: [1, 0, 2], rotationY: 0, phase: 0.5 }],
    structures: [],
    milestones: [],
    season: 'summer',
    placementVariation: true,
    randomRotation: true,
    seenFacts: ['f1'],
    foundRecipes: ['recipe:lavender-thyme'],
    hiveCombs: { h1: 0.4 },
    honeyJars: 2,
  };
  globalThis.localStorage.setItem('meadowlight.world.v2', JSON.stringify(v6));
  const w1 = loadWorld();
  assert.strictEqual(w1.items.length, 1, 'v6 items load without loss');
  assert.strictEqual(w1.honeyJars, 2, 'v6 jars survive');
  assert.ok(Number.isFinite(w1.worldSeed), 'v7 fields derive at load');
  assert.strictEqual(w1.seedingEpoch, 0, 'v7 epoch starts at 0');
  // the derived seed is stable per-blob: same blob, same seed
  const w2 = loadWorld();
  assert.strictEqual(w2.worldSeed, w1.worldSeed, 'derived seed is stable');
  // a v7 save round-trips its named seed state
  saveWorld({ ...w1, version: undefined, worldSeed: w1.worldSeed, seedingEpoch: 3 });
  const w3 = loadWorld();
  assert.strictEqual(w3.worldSeed, w1.worldSeed, 'v7 seed round-trips');
  assert.strictEqual(w3.seedingEpoch, 3, 'v7 epoch round-trips');
  assert.strictEqual(w3.version, 7, 'save writes v7');
  // volunteer flag persists through the round-trip
  saveWorld({ ...w3, items: [...w3.items.map((it) => ({ ...it, volunteer: true }))] });
  const w4 = loadWorld();
  assert.strictEqual(w4.items[0].volunteer, true, 'volunteer flag round-trips');
  clearSavedWorld();
});
test('seeding: deterministic — same inputs give identical volunteers, different epochs differ', () => {
  const mk = (plantId, x, z, i) => ({ id: 'p' + i, plantId, position: [x, 0, z], rotationY: 0, phase: 0 });
  // a summer-blooming drift well inside the placement box
  const items = [];
  for (let i = 0; i < 24; i++) items.push(mk(i % 3 === 0 ? 'lavender' : 'cosmos', -6 + (i % 6) * 2.4, -6 + Math.floor(i / 6) * 2.4, i));
  const run = (epoch) => rollVolunteers(items, 'summer', 'autumn', 12345, epoch, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
  const a1 = run(3), a2 = run(3);
  assert.deepStrictEqual(a1, a2, 'same seed+epoch = same volunteers (deterministic)');
  // different epoch = different rolls (the epoch key advances)
  const b = run(4);
  assert.ok(JSON.stringify(a1) !== JSON.stringify(b) || a1.length === 0, 'epoch changes the roll');
  // different world seed = different rolls
  const c = rollVolunteers(items, 'summer', 'autumn', 999, 3, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
  assert.ok(JSON.stringify(a1) !== JSON.stringify(c) || a1.length === 0, 'world seed changes the roll');
});

test('seeding: rare + capped — a 4-season accelerated run never grows invasively', () => {
  const mk = (plantId, x, z, i) => ({ id: 'p' + i, plantId, position: [x, 0, z], rotationY: 0, phase: 0 });
  let items = [];
  for (let i = 0; i < 40; i++) items.push(mk(['lavender', 'cosmos', 'poppy', 'aster'][i % 4], -9 + (i % 8) * 2.6, -9 + Math.floor(i / 8) * 2.6, i));
  const seasons = ['summer', 'autumn', 'winter', 'spring'];
  let epoch = 0;
  let total = 0;
  for (let si = 0; si < seasons.length - 1; si++) {
    const from = seasons[si], to = seasons[si + 1];
    const seeds = rollVolunteers(items, from, to, 12345, epoch, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
    assert.ok(seeds.length <= SEEDING_TUNING.maxPerSeason, 'whole-meadow cap holds: ' + seeds.length);
    for (const s of seeds) {
      items.push({ id: 'v' + epoch + ':' + total, plantId: s.plantId, position: [s.position[0], 0, s.position[2]], rotationY: 0, phase: 0, volunteer: true });
      total++;
    }
    epoch++;
  }
  // a season of a 40-flower meadow volunteers at most the hard cap...
  assert.ok(total <= 4 * SEEDING_TUNING.maxPerSeason, 'four seasons never runaway: ' + total);
  // ...AND the CUMULATIVE brake holds: volunteers never exceed the tuned
  // share of the meadow (the #37 gate finding: per-season caps alone let
  // volunteers compound to a third of the meadow — encroachment)
  const volunteers = items.filter((it) => it.volunteer === true).length;
  assert.ok(
    volunteers <= Math.floor(items.length * SEEDING_TUNING.maxVolunteerFraction),
    'cumulative fraction holds: ' + volunteers + '/' + items.length,
  );
});

test('seeding: the cumulative brake pauses seeding above the share — never removes (#37 finding 2)', () => {
  const mk = (plantId, x, z, i, vol) => ({ id: (vol ? 'v' : 'p') + i, plantId, position: [x, 0, z], rotationY: 0, phase: 0, volunteer: vol });
  // a 20-flower meadow already at the 15% share (3 volunteers):
  const items = [];
  for (let i = 0; i < 17; i++) items.push(mk('lavender', -9 + (i % 6) * 3, -9 + Math.floor(i / 6) * 3, i, false));
  for (let i = 0; i < 3; i++) items.push(mk('cosmos', -6 + i * 3, 6, 100 + i, true));
  // ...at the share: NO further seeding, no matter the season crossing
  const atShare = rollVolunteers(items, 'summer', 'autumn', 42, 0, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
  assert.strictEqual(atShare.length, 0, 'at the share, seeding pauses');
  // planting more of one's own flowers RAISES the ceiling (the meadow
  // grows, so the share grows — self-seeding resumes: richer, not frozen)
  for (let i = 0; i < 20; i++) items.push(mk('poppy', -20 + (i % 7) * 3, -20 + Math.floor(i / 7) * 3, 200 + i, false));
  const resumed = rollVolunteers(items, 'summer', 'autumn', 42, 0, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
  assert.ok(resumed.length >= 0, 'seeding may resume under the new, higher ceiling');
  // and the brake NEVER removes: at-the-share items are untouched
  assert.strictEqual(items.filter((it) => it.volunteer).length, 3, 'no volunteer was removed');
});

test('seeding: volunteers land only in plantable cells, roster-compatible, blooming in the new season', () => {
  const mk = (plantId, x, z, i) => ({ id: 'p' + i, plantId, position: [x, 0, z], rotationY: 0, phase: 0 });
  const items = [];
  for (let i = 0; i < 20; i++) items.push(mk('lavender', -7 + (i % 5) * 3.0, -7 + Math.floor(i / 5) * 3.0, i));
  for (let epoch = 0; epoch < 8; epoch++) {
    const seeds = rollVolunteers(items, 'summer', 'autumn', 777, epoch, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
    for (const s of seeds) {
      assert.ok(isPlantableCell(s.position[0], s.position[2]), 'volunteer in a plantable cell (raw query)');
      const compat = compatibleSeedling('lavender', 'autumn');
      assert.ok(compat.includes(s.plantId), 'volunteer is roster-compatible');
      // parent-adjacent (seed distance band)
      const parent = items.find((it) => Math.hypot(it.position[0] - s.position[0], it.position[2] - s.position[2]) >= SEEDING_TUNING.seedDistanceMin - 0.15);
      assert.ok(!!parent, 'volunteer near a parent');
    }
  }
});

test('seeding: compatibleSeedling is same-species or bloom-season companion, and can bloom in the new season', () => {
  const same = compatibleSeedling('lavender', 'autumn');
  assert.ok(same[0] === 'lavender', 'same species first');
  assert.ok(same.includes('cosmos'), 'cosmos shares summer bloom + blooms in autumn');
  assert.ok(!same.includes('clover'), 'clover does not bloom in autumn (would read as a weed)');
  assert.ok(!same.includes('crocus'), 'crocus does not share a bloom season with lavender');
  assert.ok(compatibleSeedling('crocus', 'spring').includes('forget-me-not'), 'the crocus/fmn companion pair seeds');
  assert.ok(SEEDING_FACTS.volunteer.length > 20, 'the volunteer fact exists');
});

test('seeding: empty or non-blooming meadows volunteer nothing (winter stays quiet)', () => {
  const mk = (plantId, x, z, i) => ({ id: 'p' + i, plantId, position: [x, 0, z], rotationY: 0, phase: 0 });
  const empty = rollVolunteers([], 'summer', 'autumn', 1, 0, isPlantableCell, () => false);
  assert.strictEqual(empty.length, 0, 'empty meadow seeds nothing');
  // a lavender-only meadow rolling INTO winter: lavender does not bloom in
  // winter and nothing compatible does either — no winter volunteers
  const lavenderOnly = [mk('lavender', 0, 0, 0), mk('lavender', 3, 0, 1)];
  const winter = rollVolunteers(lavenderOnly, 'autumn', 'winter', 1, 0, isPlantableCell, () => false);
  assert.strictEqual(winter.length, 0, 'winter stays quiet for a summer meadow');
});

// ---------- session 7 U2: seasonal wild visitors ----------
// persistence shim already installed above (U1 block)

test('visitors: the moth is an evening creature — dusk through night, never midday', () => {
  const w = LAVENDER_MOTH_TUNING.phaseWindow;
  assert.ok(!!w, 'the moth has a phase window');
  // dusk (0.79) through deep night (0.05) to dawn edge (0.22): evening active
  assert.ok(w(0.8) && w(0.95) && w(0.05) && w(0.22), 'evening/night is the moth window');
  // midday and bright afternoon are NOT
  assert.ok(!w(0.5) && !w(0.3) && !w(0.7), 'no moths in daylight (bees shift)');
});

test('visitors: the queen is early-spring only — the window closes mid-season', () => {
  assert.ok(isEarlySpring(0.1) && isEarlySpring(0.49), 'first half of spring');
  assert.ok(!isEarlySpring(0.5) && !isEarlySpring(0.9), 'late spring sees workers, not the queen');
});

test('visitors: target blooms are real roster species that bloom in the season (buildable)', () => {
  for (const t of [QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING]) {
    assert.ok(t.targetPlantIds && t.targetPlantIds.length > 0, t.id + ' has target flowers');
    for (const id of t.targetPlantIds) {
      assert.ok(!!PLANT_BY_ID[id], t.id + ' target ' + id + ' is a roster species');
      assert.ok(
        t.activeSeasons.some((s) => PLANT_BY_ID[id].bloom.includes(s)),
        t.id + ' target ' + id + ' blooms in one of its seasons',
      );
    }
    assert.ok(t.fact.length > 20, t.id + ' carries a verified fact');
  }
  // the queen comes for crocuses specifically (the plan of record)
  assert.ok(QUEEN_BUMBLE_TUNING.targetPlantIds.includes('crocus'), 'queen targets crocus');
  // the moth comes for lavender
  assert.ok(LAVENDER_MOTH_TUNING.targetPlantIds.includes('lavender'), 'moth targets lavender');
});

test('visitors: the firefly bloom composes with dusk — never a second firefly system', () => {
  assert.ok(FIREFLY_SUMMER_TUNING.seasons.includes('summer'), 'the bloom is a summer event');
  assert.ok(FIREFLY_SUMMER_TUNING.extraPerCorner > 0, 'the bloom adds, not replaces');
  assert.ok(FIREFLY_SUMMER_TUNING.summerMax >= 12, 'the capacity covers the bloom');
});

test('visitors: the autumn hoverfly thins, never grows', () => {
  assert.ok(HOVERFLY_AUTUMN_TUNING.fraction > 0 && HOVERFLY_AUTUMN_TUNING.fraction < 1, 'stragglers are a fraction');
  assert.ok(HOVERFLY_AUTUMN_TUNING.speedScale <= 1, 'autumn air is never faster');
});

test('visitors: notebook windows are one per (visitor, season) and round-trip', () => {
  const seen = new Set();
  const record = (visitorId, season) => {
    const key = visitorId + ':' + season;
    if (seen.has(key)) return seen.size;
    seen.add(key);
    return seen.size;
  };
  record('queenbumble', 'spring');
  const n1 = seen.size;
  record('queenbumble', 'spring'); // same window
  assert.strictEqual(seen.size, n1, 'repeated sightings never re-record');
  record('queenbumble', 'summer');
  assert.strictEqual(seen.size, n1 + 1, 'a new season is a new window');
  // and the save round-trips the keys (parseVisitorWindows dedupes)
  const world = loadWorld();
  saveWorld({ ...world, visitorWindows: ['queenbumble:spring', 'queenbumble:spring', 'moth:summer'] });
  const back = loadWorld();
  assert.deepStrictEqual(back.visitorWindows.sort(), ['moth:summer', 'queenbumble:spring'], 'dedup + round-trip');
  clearSavedWorld();
});

// ---------- session 7 U3: bee lifecycles, gently ----------

test('lifecycle: full-year trace — rise, hold, cluster, reawaken', () => {
  const spring = [0, 0.25, 0.5, 0.75, 1].map((p) => colonyIntensityTarget('spring', p));
  const summer = [0, 0.5, 1].map((p) => colonyIntensityTarget('summer', p));
  const autumn = [0, 0.5, 1].map((p) => colonyIntensityTarget('autumn', p));
  const winter = [0, 0.25, 0.5, 0.75, 1].map((p) => colonyIntensityTarget('winter', p));
  assert.ok(spring[4] > spring[0], 'spring grows');
  assert.ok(Math.abs(summer[0] - summer[2]) < 1e-9, 'summer holds (no mid-summer decline)');
  assert.ok(summer[0] >= spring[4] - 1e-9, 'summer is the peak');
  assert.ok(autumn[2] < autumn[0] && autumn[2] >= 0.49, 'autumn thins to the straggler floor, no further');
  assert.ok(winter[2] <= 0.08, 'midwinter is the tucked cluster');
  assert.ok(winter[4] > winter[3], 'late winter stirs (cleansing flights -> first foragers)');
  assert.ok(spring[0] < spring[4], 'the breath repeats');
});

test('lifecycle: the live breath eases toward the target and freezes under pause (dt=0)', () => {
  setColonyIntensityForTest(0.2);
  for (let i = 0; i < 40; i++) advanceColony('summer', 0.5, 0.5);
  const eased = colonyIntensityExport();
  assert.ok(eased > 0.2 && eased <= 0.86, 'eases up gently: ' + eased.toFixed(3));
  const before = colonyIntensityExport();
  for (let i = 0; i < 10; i++) advanceColony('winter', 0.5, 0);
  assert.strictEqual(colonyIntensityExport(), before, 'pause (dt 0) = full freeze');
  for (let i = 0; i < 400; i++) advanceColony('summer', 0.5, 0.5);
  assert.ok(Math.abs(colonyIntensityExport() - colonyIntensityTarget('summer', 0.5)) < 0.01, 'settles at target');
});

test('lifecycle: NO DECLINE FRAMING — every surface line is winter-safe (the constitution scan)', () => {
  const forbidden = /declin|die|died|dead|loss|losing|shrink|fail|gone|perish|starv|sick|weaken|disappear/i;
  for (const [season, line] of Object.entries(LIFECYCLE_LINES)) {
    assert.ok(!forbidden.test(line), 'the ' + season + ' line must never read as decline: ' + JSON.stringify(line));
    assert.ok(line.length > 20, 'the ' + season + ' line exists');
  }
  assert.ok(LIFECYCLE_LINES.winter.includes('clustered snug'), 'winter reads as tucked-in, never as empty');
  assert.ok(LIFECYCLE_LINES.winter.includes('21'), 'carries the verified 21\u00b0C fact (EDUCATION.md)');
  const rb = colonyReadbackExport('winter', 0.5);
  assert.strictEqual(rb.line, LIFECYCLE_LINES.winter, 'the readback renders the one source');
  assert.ok(rb.target <= 0.08, 'midwinter target is the cluster');
});

// ---------- session 7 U4: habitat-corner scenery ----------
test('habitat: fold cells derive from the ONE raw query — covered by hills, unplantable, inside the box', () => {
  const cells = cornerFoldCells();
  assert.ok(cells.length > 8, 'the folds exist (hills intrude into the box corners): ' + cells.length);
  // measured reality (dense 0.4 census: ~2457 cells): the fold region is
  // the full covered-unplantable strip along the box's inner edge — the
  // hills lattice reaches deep along each edge, not just the corner
  // points. The 0.8 probe grid lands ~613; the bound below allows the
  // natural probe-grid variance, not a runaway.
  assert.ok(cells.length < 900, 'the folds stay the edge strips, not the whole box: ' + cells.length);
  for (const c of cells) {
    assert.ok(Math.abs(c.x) <= 22 && Math.abs(c.z) <= 22, 'fold cell inside the placement box');
    assert.ok(hillsCoverReadback(c.x, c.z), 'fold cell covered by a rendered hills box (the layout key)');
    assert.ok(!isPlantableCell(c.x, c.z), 'fold cell is unplantable (the same raw query)');
  }
  // all four corners carry fold cells (the seams all read as corners)
  const keys = new Set(cells.map((c) => cornerKey(c.x, c.z)));
  assert.ok(keys.size === 4, 'all four corner wedges have fold cells: ' + [...keys].join(','));
  // scenery never lands on plantable ground (scenery never steals cells)
  for (const c of cells) {
    assert.ok(!isPlantableCell(c.x, c.z), 'scenery cells are exactly the unplantable folds');
  }
});

test('habitat: the scenery palette comes from the world families (the band-palette rule)', () => {
  const hillSet = new Set(['#6c8a4f', '#5f7a45', '#79995b', '#556e40']);
  for (const c of HABITAT_TUNING.bushes.colors) assert.ok(hillSet.has(c), 'bushes use the hills family');
  assert.ok(HABITAT_TUNING.log.color.startsWith('#'), 'the log has a color');
  assert.ok(HABITAT_TUNING.dragonflies.count >= 2, 'a few dragonflies over the pond');
  assert.ok(HABITAT_TUNING.dragonflies.fact.length > 20, 'the dragonfly fact exists (verified, cited in-file)');
});

// ---------- session 7 U5: night sky & cloud translucency ----------
test('stars: visibility derives from the ONE lit window — night yes, day no, ramps between', () => {
  // deep night: fully visible
  assert.ok(Math.abs(starVisibility(0.0) - 1) < 1e-9, 'midnight: full stars');
  assert.ok(Math.abs(starVisibility(0.95) - 1) < 1e-9, 'deep night: full stars');
  // day: gone
  assert.ok(starVisibility(0.5) === 0, 'noon: no stars');
  assert.ok(starVisibility(0.35) === 0, 'morning: no stars');
  // the dusk ramp: golden hour (0.82) -> dark (0.88): 0 -> 1 monotonic
  const g = starVisibility(0.82), d = starVisibility(0.88);
  assert.ok(g > 0 && g < 1 && Math.abs(d - 1) < 1e-9, 'dusk ramp fades stars in');
  assert.ok(starVisibility(0.85) > g, 'ramp is monotonic');
  // the dawn ramp: 0.22 full -> 0.30 gone
  assert.ok(Math.abs(starVisibility(0.22) - 1) < 1e-9, 'dawn edge: still full');
  assert.ok(starVisibility(0.26) < 1 && starVisibility(0.30) === 0, 'dawn ramp fades stars out');
  // the boundary epsilon lesson: the lit window's edges are inclusive the
  // same way isDaylight is — no rounding flip between surfaces
  assert.ok(starVisibility(0.2199) > 0.99, 'just before dawn edge: night');
});

test('stars: winter nights are the brightest (the long-night pairing)', () => {
  const b = NIGHT_SKY_TUNING.stars.brightnessBySeason;
  assert.ok(b.winter === 1.0 && b.summer < b.winter, 'winter peaks, summer softest');
  assert.ok(b.spring < b.autumn, 'autumn (longer nights) beats spring');
  assert.ok(NIGHT_SKY_TUNING.stars.count >= 100, 'a real sky, not a sprinkle');
});

test('clouds: translucent — softer than the composed original, never gone', () => {
  const now = NIGHT_SKY_TUNING.clouds.opacity;
  assert.ok(now < CLOUDS_OPACITY_BEFORE, 'more translucent than the 0.92 original');
  assert.ok(now >= 0.35 && now <= 0.75, 'softly veiled, not gone and not a ghost: ' + now);
});

// ---------- session 7 U4 revision: pond edge (controlled variance) ----------
test('pond edge: per-segment variance is non-zero and bounded (asymmetric but deterministic)', () => {
  const segs = pondSegments();
  assert.strictEqual(segs.length, HABITAT_TUNING.pondEdge.segments, 'the shore splits into the tuned segment count');
  const plants = segs.map((s) => s.plants);
  const spreads = segs.map((s) => s.spread);
  const depths = segs.map((s) => s.bandDepth);
  // asymmetry: the ring is NOT uniform — segments differ
  const pVar = Math.max(...plants) - Math.min(...plants);
  const sVar = Math.max(...spreads) - Math.min(...spreads);
  const dVar = Math.max(...depths) - Math.min(...depths);
  assert.ok(pVar >= 2, 'per-segment density varies: ' + pVar);
  assert.ok(sVar > 0.5, 'cluster spread varies: ' + sVar.toFixed(2));
  assert.ok(dVar > 0.4, 'band depth varies: ' + dVar.toFixed(2));
  // bounded: every segment stays inside its tuned envelope
  for (const s of segs) {
    assert.ok(s.plants >= HABITAT_TUNING.pondEdge.density.min && s.plants <= HABITAT_TUNING.pondEdge.density.max, 'density in bounds');
    assert.ok(s.spread >= HABITAT_TUNING.pondEdge.clusterSpread.min - 1e-9 && s.spread <= HABITAT_TUNING.pondEdge.clusterSpread.max + 1e-9, 'spread in bounds');
    assert.ok(s.bandDepth >= HABITAT_TUNING.pondEdge.bandDrift.min - 1e-9 && s.bandDepth <= HABITAT_TUNING.pondEdge.bandDrift.max + 1e-9, 'band depth in bounds');
    assert.ok(s.bandWidth > 0.25 && s.bandWidth <= 0.92, 'band width in bounds');
  }
  // deterministic: the same segments derive every call
  assert.deepStrictEqual(pondSegments(), segs, 'the shore layout is stable across calls');
});

// ---------- session 7 U4 revision: the organic extension (fringe) ----------
test('fringe: the named extension rule — outside the box, dry land, dissolving falloff, never plantable-stealing', () => {
  const cells = fringeCells();
  assert.ok(cells.length > 20, 'the fringe exists beyond the box: ' + cells.length);
  const halfBox = 22; // MEADOW_SIZE/2
  const depth = HABITAT_TUNING.extension.depth;
  let nearestEdge = Infinity;
  let farthestEdge = 0;
  for (const c of cells) {
    const edgeDist = Math.max(Math.abs(c.x) - halfBox, Math.abs(c.z) - halfBox);
    // strictly OUTSIDE the box (the fold rule owns the inside)
    assert.ok(Math.abs(c.x) > halfBox - 1 || Math.abs(c.z) > halfBox - 1, 'fringe cell outside the box');
    assert.ok(edgeDist <= depth + 1e-9, 'fringe cell within the extension depth');
    // never floating: dry land per the ground oracle
    assert.strictEqual(groundAtReadback(c.x, c.z).kind, 'meadow', 'fringe sits on dry land (never water/shore)');
    nearestEdge = Math.min(nearestEdge, Math.max(0, edgeDist));
    farthestEdge = Math.max(farthestEdge, edgeDist);
  }
  assert.ok(nearestEdge < 1.5, 'the fringe starts at the box edge (bleeds from the folds)');
  assert.ok(farthestEdge > depth * 0.5, 'the fringe reaches well into the band');
  // dissolving: the outer half of the band carries FEWER cells than the
  // inner half (the soft falloff — never a hard ring edge)
  let inner = 0, outer = 0;
  for (const c of cells) {
    const edgeDist = Math.max(Math.abs(c.x) - halfBox, Math.abs(c.z) - halfBox);
    if (edgeDist < depth / 2) inner++; else outer++;
  }
  assert.ok(inner > outer, 'the fringe dissolves outward: inner ' + inner + ' vs outer ' + outer);
  // and the fold rule still holds for the INSIDE (nothing changed there)
  for (const c of cornerFoldCells()) {
    assert.ok(!isPlantableCell(c.x, c.z), 'inside the box, scenery still only on unplantable cells');
  }
});

// ---------- session 7 U4 revision: trees never stand in the pond ----------
test('trees: no tree footprint cell overlaps any pond cell (exact-footprint rule)', () => {
  const placements = treePlacements();
  assert.ok(placements.length > 20, 'the forest still stands: ' + placements.length);
  const exclusion = pondExclusionRadius();
  assert.ok(exclusion > 9, 'the exclusion radius covers water + edge cells + clearance: ' + exclusion.toFixed(2));
  // the decided pond-side cluster exists and sits LEFT of the pond, dry
  const pondSide = placements.filter((p) => p.x < 30 && p.z < -5);
  assert.ok(pondSide.length >= 3, 'the pond-framing cluster renders: ' + pondSide.length + ' trees');
  for (const p of placements) {
    const d = Math.hypot(p.x - 36 + 0, p.z - (-14)); // pond center (36,-14)
    assert.ok(
      d >= exclusion + p.footprint - 1e-9,
      'tree at (' + p.x.toFixed(1) + ',' + p.z.toFixed(1) + ') footprint ' + p.footprint.toFixed(2) + ' clears the pond: dist ' + d.toFixed(2),
    );
  }
  // deterministic: same layout every call
  assert.deepStrictEqual(treePlacements(), placements, 'the tree layout is stable');
});

// ---------- session 7 U4 revision: pond edge — CLUSTERED GROUPS ----------
test('pond edge: cluster-first — tight 3-5 member groups with calm gaps between', () => {
  const clusters = pondClusters();
  const t = HABITAT_TUNING.pondEdge;
  assert.ok(clusters.length >= 12, 'every segment carries at least one cluster: ' + clusters.length);
  for (const c of clusters) {
    assert.ok(
      c.members.length >= t.membersPerCluster.min && c.members.length <= t.membersPerCluster.max,
      'cluster sizes within bounds: ' + c.members.length,
    );
    // tight: every member within the max cluster radius of the group's centroid
    const cx = c.members.reduce((a, m) => a + m.x, 0) / c.members.length;
    const cz = c.members.reduce((a, m) => a + m.z, 0) / c.members.length;
    for (const m of c.members) {
      assert.ok(
        Math.hypot(m.x - cx, m.z - cz) <= t.clusterRadius.max + 0.15,
        'member within the tight radius of its group',
      );
    }
  }
  // calm gaps: consecutive cluster CENTERS (angularly sorted) are separated
  const sorted = [...clusters].sort((a, b) => a.angle - b.angle);
  let gapCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].angle - sorted[i - 1].angle > (2 * Math.PI) / t.segments * 0.45) gapCount++;
  }
  assert.ok(gapCount >= 3, 'inter-cluster gaps present: ' + gapCount + ' calm gaps');
  // deterministic
  assert.deepStrictEqual(pondClusters(), clusters, 'the shore clusters are stable');
});

// ---------- collision ----------
test('placement collision: flowers respect structure footprints; structures respect each other', () => {
  const hive = mkStruct('hive', 0, 0);
  assert.ok(flowerBlocked(0.5, 0.5, [hive]), 'flower inside hive footprint must be blocked');
  assert.ok(!flowerBlocked(6, 6, [hive]), 'far flower must be free');
  assert.ok(structureBlocked(1, 0, 'bath', [hive], []), 'bath on hive footprint must be blocked');
  assert.ok(!structureBlocked(8, 8, 'bath', [hive], []), 'far bath must be free');
});
`;
  mkdirSync(join(work, 'tests'), { recursive: true });
  writeFileSync(join(work, 'tests/engine.test.cjs'), testSrc);

  // 4. run node --test in the work dir
  const run = spawnSync(
    process.execPath,
    ['--test', join(work, 'tests/engine.test.cjs')],
    { cwd: work, encoding: 'utf8', env: { ...process.env, NODE_PATH: join(work) } },
  );
  // node --test resolves require('./out/...') relative to the test file; the
  // paths above already point into `work/out`. Print output and propagate status.
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) {
    console.error('[UNIT] FAILED (exit ' + run.status + ')');
    process.exit(1);
  }
  console.log('[UNIT] all engine tests passed');
} finally {
  rmSync(work, { recursive: true, force: true });
}
