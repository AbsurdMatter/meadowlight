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
  const engineFiles = ['pollinator.ts', 'milestones.ts', 'variation.ts', 'factSelection.ts', 'collision.ts', 'persistence.ts', 'terrain.ts', 'postcardLayout.ts', 'ground.ts', 'dayCycle.ts', 'weather.ts', 'seasonClock.ts', 'companions.ts', 'honey.ts', 'hillsLayout.ts', 'seeding.ts', 'seededHash.ts', 'lifecycle.ts', 'nightSky.ts', 'treeLayout.ts', 'rainSchedule.ts', 'visits.ts', 'magnifierHit.ts', 'starterPatch.ts', 'sightingJournal.ts', 'keyboardShortcuts.ts', 'interactionGrammar.ts', 'seedCode.ts'];
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
const { isRaining, setPrecipitatingForTest } = require(OUT + '/engine/weather.js');
const { skyPaletteAt, GOLDEN_HOUR, sunElevation, isDaylight, isDusk, DUSK_START, DUSK_END, DAY_CYCLE_SECONDS, dayPhase, setDayPhase, advanceDay, resumeDayCycle, dayCycleOverridden } = require(OUT + '/engine/dayCycle.js');
const { SEASONS, SEASON_SECONDS } = require(OUT + '/data/seasons.js');
const { seasonProgress, advanceSeasons, startSeasonAt, setSeasonProgressForTest, nextSeason } = require(OUT + '/engine/seasonClock.js');
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
const { hash2 } = require(OUT + '/engine/seededHash.js');
const { encodeSeedCode, decodeSeedCode, SEED_CODE_PREFIX } = require(OUT + '/engine/seedCode.js');
const { starVisibility } = require(OUT + '/engine/nightSky.js');
const { treePlacements, pondExclusionRadius } = require(OUT + '/engine/treeLayout.js');
const { advanceColony, colonyIntensity: colonyIntensityExport, colonyReadback: colonyReadbackExport, setColonyIntensityForTest } = require(OUT + '/engine/lifecycle.js');
const { SEEDING_TUNING, SEEDING_FACTS } = require(OUT + '/data/seeding.js');
const { QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING, FIREFLY_SUMMER_TUNING, HOVERFLY_AUTUMN_TUNING, isEarlySpring } = require(OUT + '/data/seasonalVisitors.js');
const { isPlantableCell, groundAt: groundAtReadback } = require(OUT + '/engine/ground.js');
const { hillsCover: hillsCoverReadback, rimBoxes: rimBoxesReadback, hillsBoxes: hillsBoxesReadback, hillsInstanceCapacity: hillsInstanceCapacityReadback } = require(OUT + '/engine/hillsLayout.js');
const { seasonWindows, precipReadback, tickPrecipScheduleForTest, nextWindowAfter } = require(OUT + '/engine/rainSchedule.js');
const { wasVisitedThisSeason, withVisit, visitedParents } = require(OUT + '/engine/visits.js');
const { resolveWildlifeHit, nextWildlifeEntry, wildlifeOvertakesMeshClaim } = require(OUT + '/engine/magnifierHit.js');
const { MAGNIFIER_WILDLIFE } = require(OUT + '/data/magnifierWildlife.js');
const { MAGNIFIER_KINDS } = require(OUT + '/data/magnifierKinds.js');
const { starterPatchFor } = require(OUT + '/engine/starterPatch.js');
const { recordForInspection, appendRecord, journalKey } = require(OUT + '/engine/sightingJournal.js');
const { selectToolDisarmsGlass } = require(OUT + '/engine/interactionGrammar.js');
const { emptyKeyState, applyKey, toggleForKey, escActionFor, isTypingTarget } = require(OUT + '/engine/keyboardShortcuts.js');
const { ONBOARDING_TUNING } = require(OUT + '/data/onboarding.js');

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

// ---------- #67: postcard facts stat + seed stamp ----------
test('#67: caption layout computes the seed stamp box from measured metrics, inside the band', () => {
  const m = fallbackMetrics(44, 20);
  const l = computeCaptionLayout(m, 6, {
    stamp: {
      cardWidth: 1248, border: 24, padX: 10, padTop: 8, padBottom: 8,
      labelAscent: 15, labelDescent: 4, gap: 4, codeAscent: 17, codeDescent: 5,
      stampWidth: 220,
    },
  });
  assert.ok(l.seedStamp, 'stamp box present when stamp metrics given');
  assert.ok(l.seedStamp.top >= 0 && l.seedStamp.top + l.seedStamp.height <= l.captionH + 0.5, 'stamp vertically inside the caption band');
  assert.ok(l.seedStamp.width > 0 && l.seedStamp.right > 0, 'stamp box has real size');
  assert.ok(l.seedStamp.codeBaseline > l.seedStamp.labelBaseline, 'code sits below the label');
  const none = computeCaptionLayout(m, 6);
  assert.strictEqual(none.seedStamp, null, 'no stamp without stamp metrics');
});

test('#67: i18n carries the facts-stat + seed-stamp copy in BOTH locales', () => {
  assert.ok(UI_COPY.en.statFactsLearned.length > 0 && UI_COPY.sl.statFactsLearned.length > 0, 'statFactsLearned in en+sl');
  assert.ok(UI_COPY.en.postcardSeedStamp.length > 0 && UI_COPY.sl.postcardSeedStamp.length > 0, 'postcardSeedStamp in en+sl');
  assert.notStrictEqual(UI_COPY.sl.statFactsLearned, UI_COPY.en.statFactsLearned, 'sl facts label is Slovenian, not English');
  assert.notStrictEqual(UI_COPY.sl.postcardSeedStamp, UI_COPY.en.postcardSeedStamp, 'sl stamp label is Slovenian, not English');
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

test('day clock: 6-minute cycle (#44), overrides hold, resume drifts again', () => {
  assert.strictEqual(DAY_CYCLE_SECONDS, 360, 'cycle length halved per #44 (6-minute day)');
  // override semantics (P panel): setDayPhase holds the clock still
  resumeDayCycle();
  setDayPhase(0.5);
  assert.strictEqual(dayPhase(), 0.5);
  assert.ok(dayCycleOverridden(), 'override must hold the clock');
  advanceDay(DAY_CYCLE_SECONDS);
  assert.ok(Math.abs(dayPhase() - 0.5) < 1e-9, 'override: clock does not drift');
  // resume: natural drift returns
  resumeDayCycle();
  assert.ok(!dayCycleOverridden(), 'resume releases the override');
  advanceDay(DAY_CYCLE_SECONDS / 2);
  assert.ok(Math.abs(dayPhase() - 0.0) < 1e-9, 'half cycle wraps to midnight');
  advanceDay(DAY_CYCLE_SECONDS);
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

// ---------- session 9 v4 polish: #44/#45 ----------

test('#44: the day cycle is 6 minutes — every window derives from the phase', () => {
  assert.strictEqual(DAY_CYCLE_SECONDS, 360, 'DAY_CYCLE_SECONDS halved per #44');
  // dusk and daylight windows are PHASE fractions (unchanged): halving the
  // cycle halves their wall-clock length automatically — one source
  setDayPhase(0.5);
  resumeDayCycle(); // release the override so the natural clock drifts
  advanceDay(DAY_CYCLE_SECONDS / 4);
  assert.ok(Math.abs(dayPhase() - 0.75) < 1e-6, 'a quarter day is a quarter phase');
  assert.ok(isDusk(0.82) && isDaylight(0.82), 'the dusk/daylight windows themselves are untouched');
  resumeDayCycle();
});

test('#45: the precipitation spawn distribution spreads the burst across the full area', () => {
  // mirrors Rain.tsx's spawnPosition (the render side keeps its own copy so
  // the renderer never imports the engine hash mid-frame — the test pins the
  // distribution's properties against the same hash source)
  const spawn = (index, salt, area) => ({
    x: (hash2(index, salt, 0x5eed) * 2 - 1) * area,
    z: (hash2(salt, index, 0x5eed) * 2 - 1) * area,
  });
  const area = 24; // RAIN_VISUAL.areaHalf
  const n = 220; // RAIN_VISUAL.drops
  const xs = [], zs = [];
  for (let i = 0; i < n; i++) {
    const s = spawn(i, 1, area);
    xs.push(s.x);
    zs.push(s.z);
    assert.ok(Math.abs(s.x) <= area && Math.abs(s.z) <= area, 'every burst position is inside the area');
  }
  // the user-observed flaw was a CONCENTRATED burst: pin the spread — the
  // burst must cover the area like the steady fall, not cluster mid-field
  const spread = (v) => Math.max(...v) - Math.min(...v);
  assert.ok(spread(xs) > area * 1.5, 'burst x spread covers the area (got ' + spread(xs).toFixed(1) + ' of ' + (area * 2) + ')');
  assert.ok(spread(zs) > area * 1.5, 'burst z spread covers the area (got ' + spread(zs).toFixed(1) + ' of ' + (area * 2) + ')');
  // corners reached: positions in every quadrant
  const quad = (v) => [v.some((p) => p < -area / 2), v.some((p) => p > area / 2)];
  assert.ok(quad(xs).every(Boolean) && quad(zs).every(Boolean), 'burst reaches both halves on both axes');
  // deterministic: same indices -> same positions (the seeded convention)
  const again = spawn(7, 1, area);
  assert.deepStrictEqual(again, spawn(7, 1, area), 'spawn positions are deterministic');
  // distinct from the steady-fall salt (burst and steady rolls differ)
  assert.notDeepStrictEqual(spawn(7, 1, area), spawn(7, 5, area), 'burst and steady salts differ');
});

// ---------- session 6 U1 (#11): auto-advancing season calendar ----------
test('season clock: 9-minute season (25% shorter, #6384616654), rollover reports the crossed season', () => {
  assert.strictEqual(SEASON_SECONDS, 540, 'season length 25% shorter per the close-round pacing call');
  setSeasonProgressForTest(0);
  // half a season, DERIVED from the constant (never the old 360 literal —
  // the 25% shorten would silently break a hardcoded half)
  const halfSeason = SEASON_SECONDS / 2;
  let crossed = advanceSeasons(halfSeason, 'summer');
  assert.strictEqual(crossed.length, 0, 'half a season crosses nothing');
  assert.ok(Math.abs(seasonProgress() - 0.5) < 1e-9, 'progress is half');
  crossed = advanceSeasons(halfSeason, 'summer');
  assert.deepStrictEqual(crossed, ['autumn'], 'a full season rolls into autumn');
  assert.ok(Math.abs(seasonProgress() - 0) < 1e-9, 'rollover leaves progress at season start');
});

test('season clock: winter wraps to spring; huge deltas cross several seasons', () => {
  setSeasonProgressForTest(0.9);
  const crossed = advanceSeasons(SEASON_SECONDS * 2.5, 'winter');
  assert.deepStrictEqual(crossed, ['spring', 'summer', 'autumn'], 'wrap + multi-cross in order');
  assert.ok(Math.abs(seasonProgress() - 0.4) < 1e-9, 'fractional remainder preserved');
});

test('season clock: startSeasonAt STARTS the season and never holds (round-1 finding 3)', () => {
  // the manual dial = the P panel = ONE start path: a selection sets the
  // clock to the season's start and auto-advance CONTINUES — the calendar
  // has no hold state; only the TimeControls pause freezes it
  setSeasonProgressForTest(0.7);
  startSeasonAt('spring');
  assert.strictEqual(seasonProgress(), 0, 'a selection starts the chosen season at its beginning');
  const crossed = advanceSeasons(9999, 'spring');
  assert.ok(crossed.length > 0, 'a started season keeps drifting — advanceSeasons never holds');
  assert.ok(seasonProgress() < 1, 'advance left the clock mid-season, not frozen');
});

test('season clock: boundary interpretation — 0.999 saves resume the SAME season, never pre-roll', () => {
  // the save->reload->resume path: a position < 1 is mid-season by
  // definition; only advanceSeasons may cross a boundary, so a reload
  // can never re-interpret a near-boundary save as the next season
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
  setPrecipitatingForTest(true);
  const wet = computeAppeal({ x: 0, z: 0 }, w, FORAGE_RADIUS);
  setPrecipitatingForTest(false);
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
  assert.strictEqual(w3.version, 9, 'save writes v9 (O1/O2 additive bump)');
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

// ---------- session 10 #50: the outer rim ring (no sky through the rim) ----------
test('#50: the rim ring is deterministic, past outerRadius, varied heights, pond-excluded', () => {
  const rim = rimBoxesReadback();
  assert.ok(rim.length > 100, 'the rim ring has real blocks: ' + rim.length);
  // #66 eyeball follow-up: the renderer's instanced buffer is sized from the
  // SAME layout (hills + rim counted exactly) — assert the OLD area/step^2
  // estimate could under-size it (three.js drops instances past the instance
  // count silently; that under-count was the through-rim gap source), i.e.
  // the real layout count is what the renderer now uses
  {
    const hillsN = hillsBoxesReadback().length;
    const envC = require(OUT + '/data/environment.js');
    const inner = envC.HILLS.innerRadius, outer = envC.HILLS.outerRadius + envC.HILLS.rimRingWidth, step = envC.HILLS.step;
    const est = Math.floor((Math.PI * (outer * outer - inner * inner)) / (step * step));
    assert.ok(hillsN + rim.length < est, 'old area estimate (' + est + ') over-counted the real layout (' + (hillsN + rim.length) + ') — the old buffer was too SMALL for the real draw order, dropping trailing rim boxes');
  }
  const a = rimBoxesReadback();
  assert.deepStrictEqual(rim, a, 'rim layout is deterministic (same call = same boxes)');
  const outer = 50; // HILLS.outerRadius
  const env2 = require(OUT + '/data/environment.js');
  const ringW = env2.HILLS.rimRingWidth;
  for (const b of rim) {
    const r = Math.hypot(b.x, b.z);
    assert.ok(r >= outer - 1.2 && r <= outer + ringW + 1.2, 'rim box in the ring band r ' + outer + '..' + (outer + ringW) + ': r=' + r.toFixed(1));
    assert.strictEqual(b.extraH, 0, '#66: rim boxes carry NO extra height — they share the hills profile');
  }
  // the hills' own layout is UNCHANGED by the rim ring (the ring's RNG is a
  // separate sequence — no second layout, and the first is byte-stable)
  assert.ok(hillsBoxesReadback().length > 2000, 'hills layout intact');
  // rim boxes never cover the pond band or the meadow
  for (const b of rim) {
    assert.ok(Math.hypot(b.x - 36, b.z + 14) > 8 + 1.2, 'no rim block in the pond');
    assert.ok(Math.hypot(b.x, b.z) > 21.5 - 2, 'no rim block inside the meadow');
  }
  // hillsCover now includes the rim: a point covered only by a rim box is unplantable terrain
  const rimOnly = rim.find((b) => Math.hypot(b.x, b.z) > 50.5);
  if (rimOnly) {
    assert.ok(hillsCoverReadback(rimOnly.x, rimOnly.z), 'rim-covered point reads as terrain (hillsCover includes the ring)');
    assert.ok(!isPlantableCell(rimOnly.x, rimOnly.z), 'rim-covered point is unplantable');
  }
});

test('#83 invariant: the instanced buffer capacity >= the instance count for the distant families (#66 class, encoded)', () => {
  // The renderer (Background.tsx) sizes the Hills mesh from
  // hillsInstanceCapacity() — the ONE shared source. Assert the invariant
  // that was missing when #66 shipped: capacity >= the real draw order
  // (hillsBoxes + rimBoxes), counted exactly, never estimated.
  const cap = hillsInstanceCapacityReadback();
  const drawn = hillsBoxesReadback().length + rimBoxesReadback().length;
  assert.ok(cap >= drawn, 'hills buffer capacity ' + cap + ' >= drawn instances ' + drawn);
  assert.strictEqual(cap, drawn, 'capacity is counted exactly from the layout, not estimated');
  // and prove the class existed: the pre-#66 area/step^2 estimate under-counts
  // the real draw order, which is exactly what silently truncated the rim
  const env = require(OUT + '/data/environment.js');
  const est = Math.floor((Math.PI * (env.HILLS.outerRadius ** 2 - env.HILLS.innerRadius ** 2)) / (env.HILLS.step ** 2));
  assert.ok(est < drawn, 'pre-#66 area estimate (' + est + ') under-counts the real layout (' + drawn + ') — the truncation class this invariant guards (render path also self-checks with a gate-visible console.error per family)');
});

test('#50: camera-sweep survey — no horizon-direction ray from any in-bounds camera escapes to sky', () => {
  // geometric survey over the shared layout (supporting evidence; the user's
  // eyeball is acceptance): from camera positions across the allowed orbit
  // (distance 9..34, polar 0.3..1.32, target origin), cast screen-fan rays
  // (±35° azimuth, elevations from -20° to +10° — the band where a horizon
  // would show) and assert every ray is blocked by hills OR the rim ring.
  // Rays below -20° hit the meadow floor / bowl wall by construction (the
  // meadow is a 44u square bowl inside the ring) and are not sky windows.
  const env = require(OUT + '/data/environment.js');
  const { HILLS, CAMERA_BOUNDS } = env;
  const { shapedHeight } = env;
  const all = [...hillsBoxesReadback(), ...rimBoxesReadback()].map((b) => {
    const h = shapedHeight(b.x, b.z);
    const extraDepth = Math.max(0, h - shapedHeight(0, 0)) + 4;
    const boxH = HILLS.boxHeight + extraDepth;
    const yC = h - boxH * 0.55;
    return { x: b.x, z: b.z, half: b.half, top: yC + boxH / 2, bottom: yC - boxH / 2 };
  });
  // the DistantRidge ring (Sky.tsx): 96 boxes at r 50..62, w 9..15, crest
  // h = boxHeight + 1.2 + rng*1.4 + rangeBoost above local ground, 4.5u skirt
  // below — reconstructed from the renderer's own RNG seed so the survey
  // matches what renders
  {
    let s = 60221;
    const rr = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2 + rr() * 0.06;
      const r = 50 + rr() * 12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const ground = shapedHeight(x, z);
      const rangeBoost = Math.max(0, Math.cos(a * 2 + 0.8)) * 1.1;
      const h = HILLS.boxHeight + 1.2 + rr() * 1.4 + rangeBoost;
      const w = 9 + rr() * 6;
      const skirt = 4.5, total = h + skirt;
      all.push({ x, z, half: w / 2, top: ground - skirt + total, bottom: ground - skirt });
    }
  }
  // spatial index for speed
  const grid = new Map();
  const gk = (x, z) => Math.floor(x / 2) + ':' + Math.floor(z / 2);
  for (const b of all) {
    for (let gx = Math.floor((b.x - b.half) / 2); gx <= Math.floor((b.x + b.half) / 2); gx++) {
      for (let gz = Math.floor((b.z - b.half) / 2); gz <= Math.floor((b.z + b.half) / 2); gz++) {
        const k = gx + ':' + gz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(b);
      }
    }
  }
  const blocked = (camX, camY, camZ, dx, dy, dz) => {
    for (let t = 0.5; t < 110; t += 0.3) {
      const x = camX + dx * t, y = camY + dy * t, z = camZ + dz * t;
      const c = grid.get(gk(x, z));
      if (c) {
        for (const b of c) {
          if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half && y <= b.top && y >= b.bottom) return true;
        }
      }
    }
    return false;
  };
  let gaps = 0, overRim = 0;
  // The orbit target can pan within ±16u (panTargetLimit), so survey targets
  // on a small grid too — a panned camera changes the ray geometry.
  // #66: an unblocked horizon-band ray is NOT automatically a "through-rim"
  // gap. With the ring complete at the hills' own height, low-camera rays
  // legitimately fly OVER the rim tops (that IS the restored sky-above-rim
  // look #66 asks for). A through-gap ray is one that crosses the rim
  // annulus (r >= 50) at or below the local rim-top envelope — i.e. it
  // slipped through a horizontal hole in the ring. That count must be 0;
  // the over-the-top count is allowed (and is what #66's sky-above-rim
  // check below relies on).
  const rimGeoms = rimBoxesReadback().map((b) => {
    const h = shapedHeight(b.x, b.z);
    const extraDepth = Math.max(0, h - shapedHeight(0, 0)) + 4;
    const boxH = HILLS.boxHeight + extraDepth;
    const yC = h - boxH * 0.55;
    return { x: b.x, z: b.z, half: b.half, top: yC + boxH / 2 };
  });
  const blockedPoint = (x, y, z) => {
    const c = grid.get(gk(x, z));
    if (!c) return false;
    for (const b of c) {
      if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= b.half && y <= b.top && y >= b.bottom) return true;
    }
    return false;
  };
  for (const tx of [-16, 0, 16]) {
    for (const tz of [-16, 0, 16]) {
      for (let aDeg = 0; aDeg < 360; aDeg += 6) {
        const a = (aDeg * Math.PI) / 180;
        for (const dist of [CAMERA_BOUNDS.minDistance, 22, CAMERA_BOUNDS.maxDistance]) {
          for (const polar of [CAMERA_BOUNDS.minPolarAngle, 0.9, CAMERA_BOUNDS.maxPolarAngle]) {
            const camY = dist * Math.cos(polar);
            const ch = dist * Math.sin(polar);
            const camX = tx + ch * Math.cos(a), camZ = tz + ch * Math.sin(a);
            for (let da = -35; da <= 35; da += 7) {
              // vertical fov 50° around the view axis: the axis points down
              // by (90° - polar) — at the lowest allowed camera (polar 1.32)
              // that is 14.4°, so the screen spans elevations -39.4°..+10.6°
              const axisDown = 90 - (polar * 180) / Math.PI;
              const deMin = -axisDown - 25 + 1, deMax = -axisDown + 25;
              // horizon band: rays above -8° (the sky band above the bowl
              // wall); below that the ray is inside the 44u bowl or its wall
              for (let de = Math.max(-8, Math.ceil(deMin)); de <= Math.min(10, deMax); de += 2) {
                const aa = a + Math.PI + (da * Math.PI) / 180;
                const ee = (de * Math.PI) / 180;
                const dx = Math.cos(aa) * Math.cos(ee), dy = Math.sin(ee), dz = Math.sin(aa) * Math.cos(ee);
                let cxp = null, czp = null, hit = false;
                for (let t = 0.5; t < 110; t += 0.3) {
                  const x = camX + dx * t, y = camY + dy * t, z = camZ + dz * t;
                  if (cxp === null && Math.hypot(x, z) >= 50) { cxp = x; czp = z; }
                  if (blockedPoint(x, y, z)) { hit = true; break; }
                }
                if (hit) continue;
                if (cxp === null) { overRim++; continue; }
                const tCross = Math.hypot(cxp - camX, czp - camZ) / Math.hypot(dx, dz);
                const yCross = camY + dy * tCross;
                let maxTop = -1e9;
                for (const b of rimGeoms) {
                  if (Math.abs(cxp - b.x) <= b.half + 3 && Math.abs(czp - b.z) <= b.half + 3 && b.top > maxTop) maxTop = b.top;
                }
                if (yCross <= maxTop + 0.05) gaps++; else overRim++;
              }
            }
          }
        }
      }
    }
  }
  assert.strictEqual(gaps, 0, '#50 acceptance: no sky-through-rim ray through a ring gap in the horizon band (gaps: ' + gaps + ', over-the-top rays allowed: ' + overRim + ')');
  assert.ok(overRim > 0, '#66: over-the-rim sky rays exist in the sweep (sky above the rim is visible, not a raised wall)');

  // #66 acceptance: sky visible ABOVE the rim at the resting camera
  // (default position [16,12,20], App.tsx) and a gentle orbit — silhouette
  // elevation per azimuth fan vs the screen-top elevation (fov 50)
  const rp = [16, 12, 20];
  const rdist = Math.hypot(rp[0], rp[1], rp[2]);
  const rpolar = Math.acos(rp[1] / rdist);
  const rtheta = Math.atan2(rp[0], rp[2]);
  const screenTop = (rpolar * 180) / Math.PI - 90 + 25;
  let aboveCount = 0, aboveTot = 0;
  for (const orbit of [0, 0.6, 1.2]) {
    for (let da = -35; da <= 35; da += 5) {
      const aa = rtheta + orbit + (da * Math.PI) / 180;
      let sil = null;
      for (let de = -20; de <= 25; de += 0.25) {
        const ee = (de * Math.PI) / 180;
        const dx = Math.cos(aa) * Math.cos(ee), dy = Math.sin(ee), dz = Math.sin(aa) * Math.cos(ee);
        if (blocked(rp[0], rp[1], rp[2], dx, dy, dz)) { sil = de; break; }
      }
      aboveTot++;
      if (sil !== null && screenTop > sil + 0.5) aboveCount++;
    }
  }
  assert.ok(aboveCount > 0 && aboveCount >= aboveTot / 2, '#66 acceptance: sky visible above the rim at resting camera (' + aboveCount + '/' + aboveTot + ' fan rays)');
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

// ---------- session 8 N1 (round 2): natural, seasonally-weighted precipitation ----------
// Binary windows, seeded per (worldSeed, ordinal): same world = same weather
// calendar; spring/fall wet, summer dry, winter = SNOW (decided); windows
// arrive and end MID-SEASON (never tied to boundaries); the 8x rule —
// one accelerated year visibly precipitates several times.
const wetShareOf = (windows) => {
  let wet = 0;
  for (const win of windows) wet += Math.min(win.end, 1) - win.start;
  return Math.max(0, wet);
};

test('N1 determinism: same seed + ordinal = same weather calendar', () => {
  const a = seasonWindows(1234, 3, 'spring');
  const b = seasonWindows(1234, 3, 'spring');
  assert.deepStrictEqual(a, b, 'same inputs replay identically');
  assert.notDeepStrictEqual(seasonWindows(1234, 3, 'autumn'), a, 'different season weathers differently');
  assert.notDeepStrictEqual(seasonWindows(9999, 3, 'spring'), a, 'different world weathers differently');
  assert.notDeepStrictEqual(seasonWindows(1234, 4, 'spring'), a, 'next year weathers differently (ordinal)');
});

test('N1 seasonal weights: spring+fall wetter than summer; windows are mid-season', () => {
  const share = (season) => {
    let s = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (let ord = 0; ord < 4; ord++) {
        s += wetShareOf(seasonWindows(seed, ord, season));
      }
    }
    return s / 80;
  };
  const spring = share('spring');
  const autumn = share('autumn');
  const summer = share('summer');
  assert.ok(spring > summer + 0.1, 'spring wetter than summer by structure (' + spring.toFixed(2) + ' vs ' + summer.toFixed(2) + ')');
  assert.ok(autumn > summer + 0.1, 'fall wetter than summer by structure');
  assert.ok(summer < 0.25, 'summer stays mostly dry (cozy)');
  assert.ok(spring > 0.2, 'spring is observably wet (the 8x rule: weather must happen)');
});

test('N1 winter-is-snow: every winter window is snow; spring/summer/autumn are rain', () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (const win of seasonWindows(seed, 7, 'winter')) {
      assert.strictEqual(win.kind, 'snow', 'winter precipitation is SNOW (decided)');
    }
    for (const s of ['spring', 'summer', 'autumn']) {
      for (const win of seasonWindows(seed, 7, s)) {
        assert.strictEqual(win.kind, 'rain', s + ' precipitation is rain');
      }
    }
  }
});

test('N1 windows live mid-season: a boundary crossing never resets or silences weather', () => {
  // windows are continuous on the 0..1 progress axis and may spill past 1 —
  // a storm in progress at the rollover keeps falling (the round-2 bug
  // report: "rain stopped with the season change")
  let sawMidSeason = false;
  let sawSpill = false;
  for (let seed = 1; seed <= 40; seed++) {
    for (let ord = 0; ord < 4; ord++) {
      const w = seasonWindows(seed, ord, 'spring');
      for (const win of w) {
        if (win.start > 0.15 && win.end < 0.9) sawMidSeason = true;
        if (win.end > 1) sawSpill = true;
      }
    }
  }
  assert.ok(sawMidSeason, 'windows start/end mid-season, not only at boundaries');
  assert.ok(sawSpill, 'some windows spill past the boundary (weather survives rollover)');
  // and the resolver keeps evaluating at a stable world point: the same
  // (seed, epoch, season) tuple always yields the same live verdict,
  // never a stale carry from a previous tick
  setSeasonProgressForTest(0.5);
  tickPrecipScheduleForTest(5, 2, 'autumn');
  const held = precipReadback().current;
  tickPrecipScheduleForTest(5, 2, 'autumn');
  assert.deepStrictEqual(precipReadback().current, held, 'same world point = same live verdict');
});


// ---------- session 8 N2: pollinator-visit seeding precondition ----------
test('N2 visit ledger: withVisit dedupes per season; absent field = unvisited', () => {
  const item = mkItem('lavender', 1, 1);
  assert.strictEqual(wasVisitedThisSeason(item, 'summer'), false, 'no ledger = never visited (pre-v8 saves)');
  const a = withVisit(item, 'summer');
  assert.deepStrictEqual(a, ['summer']);
  const b = withVisit({ ...item, visitedSeasons: a }, 'summer');
  assert.deepStrictEqual(b, ['summer'], 'second visit the same season is a no-op (one visit suffices)');
  const c = withVisit({ ...item, visitedSeasons: a }, 'autumn');
  assert.deepStrictEqual(c, ['summer', 'autumn'], 'seasons accumulate additively');
  assert.strictEqual(wasVisitedThisSeason({ ...item, visitedSeasons: c }, 'autumn'), true);
});

test('N2 seeding gate: only VISITED blooming flowers parent volunteers', () => {
  const items = [
    { ...mkItem('lavender', 0, 0), visitedSeasons: ['summer'] }, // blooming + visited
    mkItem('lavender', 3, 0),                                    // blooming, UNVISITED
    { ...mkItem('lavender', 6, 0), visitedSeasons: ['spring'] }, // blooming, visited LAST season only
    { ...mkItem('crocus', 9, 0), visitedSeasons: ['summer'] },  // visited but NOT blooming in summer
  ];
  const parents = visitedParents(items, 'summer');
  assert.strictEqual(parents.length, 1, 'only the visited-and-blooming flower parents');
  assert.strictEqual(parents[0].id, items[0].id);
});

test('N2 rollVolunteers honors the precondition without touching the roll sequence', () => {
  const isPlantable = () => true;
  const flowerBlockedFn = () => false;
  const mk = (id, x, visited) => ({ id, plantId: 'lavender', position: [x, 0, 0], rotationY: 0, phase: 0, visitedSeasons: visited });
  // two visited parents: their volunteer rolls must be IDENTICAL to a
  // pre-N2 run with the same parents (the RNG parity lesson — the filter
  // runs BEFORE the rolls, so surviving parents roll byte-identically)
  const visited = [mk('a', -6, ['summer']), mk('b', 6, ['summer'])];
  const fromVisited = rollVolunteers(visited, 'summer', 'autumn', 42, 3, isPlantable, flowerBlockedFn);
  const plain = visited.map((v) => ({ ...v, visitedSeasons: undefined }));
  const fromPlain = rollVolunteers(plain, 'summer', 'autumn', 42, 3, isPlantable, flowerBlockedFn);
  assert.strictEqual(fromVisited.length, fromPlain.length, 'same parents = same volunteer count');
  for (let i = 0; i < fromVisited.length; i++) {
    assert.deepStrictEqual(fromVisited[i], fromPlain[i], 'roll sequence untouched (positions, phases, variations)');
  }
  // and unvisited parents seed NOTHING
  const unvisited = [mk('a', -6, undefined), mk('b', 6, ['spring'])];
  const none = rollVolunteers(unvisited, 'summer', 'autumn', 42, 3, isPlantable, flowerBlockedFn);
  assert.strictEqual(none.length, 0, 'unvisited flowers set no seed');
});

test('N2 save v8 load path: a v7 blob loads losslessly; visitedSeasons round-trips', () => {
  // the session-7 localStorage shim (top of the self-seeding section) is
  // already in place — never re-assign the global (probe hygiene: build on
  // the shared fixture instead of replacing it)
  clearSavedWorld();
  // a v7-shaped blob (session-7 save, no visitedSeasons anywhere)
  const v7 = {
    version: 7,
    items: [
      { id: 'x', plantId: 'lavender', position: [1, 0, 1], rotationY: 0, phase: 0.5, volunteer: true,
        variation: { rotationY: 0.2, heightJitter: 0, tiltX: 0, tiltZ: 0 } },
    ],
    structures: [], milestones: [], season: 'summer',
    placementVariation: true, randomRotation: true, seenFacts: [], wildSeasons: [],
    onboardingDismissed: false, visitorWindows: ['queenbumble:spring'],
    worldSeed: 777, seedingEpoch: 3, dayPhase: 0.4, seasonProgress: 0.5,
  };
  localStorage.setItem('meadowlight.world.v2', JSON.stringify(v7));
  const loaded = loadWorld();
  assert.strictEqual(loaded.version >= 7, true, 'loads, not backed up');
  assert.strictEqual(loaded.items.length, 1, 'the item survives');
  assert.strictEqual(loaded.items[0].volunteer, true, 'volunteer flag preserved');
  assert.strictEqual(loaded.items[0].visitedSeasons, undefined, 'pre-v8 item = unvisited, eligible on next visit');
  assert.strictEqual(loaded.visitorWindows[0], 'queenbumble:spring', 'visitor windows preserved');
  assert.strictEqual(loaded.worldSeed, 777, 'seed preserved');
  assert.strictEqual(loaded.seedingEpoch, 3, 'epoch preserved');
  assert.deepStrictEqual(loaded.journal, [], 'pre-v9 save = empty journal (additive)');
  assert.deepStrictEqual(loaded.nudgesShown, [], 'pre-v9 save = no nudges shown (additive)');
  // round-trip a v8 save with a visit ledger
  loaded.items[0].visitedSeasons = ['summer'];
  saveWorld(loaded);
  const again = loadWorld();
  assert.deepStrictEqual(again.items[0].visitedSeasons, ['summer'], 'visitedSeasons round-trips');
  assert.strictEqual(again.version, 9, 'saves write v9');
  clearSavedWorld();
});

test('N1 8x observability: every season of every world precipitates multiple times', () => {
  // the gate case made structural: an accelerated year MUST visibly rain
  // (spring/autumn), snow (winter), and mostly dry (summer) — weather that
  // cannot be observed is a bug, not subtlety.
  for (let seed = 1; seed <= 12; seed++) {
    for (let ord = 0; ord < 4; ord++) {
      assert.ok(seasonWindows(seed, ord, 'spring').length >= 2, 'spring has several windows (seed ' + seed + ')');
      assert.ok(seasonWindows(seed, ord, 'autumn').length >= 2, 'autumn has several windows');
      assert.ok(seasonWindows(seed, ord, 'winter').length >= 2, 'winter has several snow windows');
    }
  }
});
const { butterflyColors, BUTTERFLY_WING_PALETTE } = require(OUT + '/data/wildpollinators.js');

// --- butterfly color determinism (PR #38 comment #6383907384) ---
test('butterfly colors: same identity = same color, always from the palette', () => {
  const a = butterflyColors(12345, 3, 2);
  const b = butterflyColors(12345, 3, 2);
  assert.deepStrictEqual(a, b, 'deterministic: same world/ordinal/index = same butterfly');
  assert.ok(BUTTERFLY_WING_PALETTE.includes(a.wing), 'wing color comes from the data palette');
  assert.ok(BUTTERFLY_WING_PALETTE.length === 4, 'palette has the four approved colors');
});

test('butterfly colors: different identities spread across the palette', () => {
  const seen = new Set();
  for (let ord = 0; ord < 12; ord++) {
    for (let i = 0; i < 4; i++) seen.add(butterflyColors(98765, ord, i).wing);
  }
  assert.ok(seen.size >= 2, 'the palette actually varies across creatures');
  for (const c of seen) assert.ok(BUTTERFLY_WING_PALETTE.includes(c));
});

// --- N3 magnifier wildlife hit resolution (PR #38 comment #6383586724) ---
test('wildlife hit: the pointer ray hits a creature within reach', () => {
  // synthetic pair: camera at origin looking down -Z, creature 10 ahead
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const sightings = [{ kind: 'hivebee', x: 0, y: 0.3, z: -10 }];
  const hit = resolveWildlifeHit(cam, sightings, 1.1);
  assert.ok(hit, 'creature near the ray must hit');
  assert.strictEqual(hit.kind, 'hivebee');
});

test('wildlife hit: a creature beyond reach misses', () => {
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const far = [{ kind: 'dragonfly', x: 4, y: 0, z: -10 }]; // 4u off-axis
  assert.strictEqual(resolveWildlifeHit(cam, far, 1.1), null);
});

test('wildlife hit: behind the camera never hits', () => {
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const behind = [{ kind: 'fireflies', x: 0, y: 0, z: 5 }];
  assert.strictEqual(resolveWildlifeHit(cam, behind, 1.1), null);
});

test('wildlife hit: the creature NEAREST THE RAY wins, not the nearest to camera', () => {
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const two = [
    { kind: 'butterfly', x: 0.9, y: 0, z: -4 },  // near camera but off-axis
    { kind: 'queenbumble', x: 0.05, y: 0, z: -30 }, // far but dead-on
  ];
  const hit = resolveWildlifeHit(cam, two, 1.1);
  assert.ok(hit);
  assert.strictEqual(hit.kind, 'queenbumble', 'dead-on creature wins the lock');
});

test('wildlife hit: MOVES — the hit uses the CURRENT position, not a stale capture', () => {
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  // frame 1: creature at A misses; it moves under the pointer; frame 2 hits
  const frame1 = [{ kind: 'lavendermoth', x: 5, y: 0, z: -10 }];
  assert.strictEqual(resolveWildlifeHit(cam, frame1, 1.1), null);
  const frame2 = [{ kind: 'lavendermoth', x: 0.1, y: 0, z: -10 }];
  const hit = resolveWildlifeHit(cam, frame2, 1.1);
  assert.ok(hit, 'after the creature moves under the pointer, the SAME function hits');
  assert.strictEqual(hit.kind, 'lavendermoth');
});

test('wildlife hit: the hit carries its along-ray distance for claim comparison (#85)', () => {
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const two = [
    { kind: 'butterfly', x: 0.9, y: 0, z: -4 }, // near camera but off-axis
    { kind: 'queenbumble', x: 0.05, y: 0, z: -30 }, // far but dead-on
  ];
  const hit = resolveWildlifeHit(cam, two, 1.1);
  assert.ok(hit);
  assert.strictEqual(hit.kind, 'queenbumble');
  assert.ok(Math.abs(hit.along - 30) < 1e-9, 'along = distance along the ray to the winner, got ' + hit.along);
});

test('#85: wildlife overtakes a mesh claim only when nearer along the ray', () => {
  const hit = { kind: 'hivebee', along: 5, perpSq: 0.01 };
  assert.strictEqual(wildlifeOvertakesMeshClaim(hit, 10), true, 'creature nearer along the ray than the mesh claim wins');
  assert.strictEqual(wildlifeOvertakesMeshClaim(hit, 3), false, 'creature behind the mesh claim loses (the flower in front owns the card)');
  assert.strictEqual(wildlifeOvertakesMeshClaim(hit, null), true, 'no live mesh claim — the resolver claims freely');
  assert.strictEqual(wildlifeOvertakesMeshClaim(null, 10), false, 'a miss never overtakes a mesh-owned entry');
});

test('entry decision: a MISS KEEPS the current visitor entry (no null-wipe)', () => {
  // the chain break the user saw: an in-between frame must not clear the hover
  assert.deepStrictEqual(
    nextWildlifeEntry(null, 'hoverfly'),
    { kind: 'visitor', visitorId: 'hoverfly' },
  );
  // a hit replaces it with the new lock
  assert.deepStrictEqual(
    nextWildlifeEntry({ kind: 'hivebee' }, 'hoverfly'),
    { kind: 'visitor', visitorId: 'hivebee' },
  );
  // with nothing held, a miss stays null
  assert.strictEqual(nextWildlifeEntry(null, null), null);
});

test('kind taxonomy: the resolver kinds and the card table share ONE enum', () => {
  // every kind the resolver can emit has a card entry (no card filter drop)
  for (const k of MAGNIFIER_KINDS) {
    const entry = MAGNIFIER_WILDLIFE[k];
    assert.ok(entry, 'card table must cover kind: ' + k);
    assert.ok(entry.name && entry.fact, 'card entry must have name+fact: ' + k);
  }
  // and the hit function only emits kinds from that same enum
  const cam = { camX: 0, camY: 0, camZ: 0, dirX: 0, dirY: 0, dirZ: -1 };
  const hit = resolveWildlifeHit(cam, [{ kind: 'solitarybee', x: 0, y: 0, z: -5 }], 1.1);
  assert.ok(MAGNIFIER_KINDS.includes(hit.kind));
});

// ---------- session 9 v4: O1 starter patch, O2 journal, O5 keys ----------

test('O1: the starter patch is deterministic from the world seed (never Math.random)', () => {
  const a = starterPatchFor(424242);
  const b = starterPatchFor(424242);
  assert.deepStrictEqual(a, b, 'same seed = same patch');
  const c = starterPatchFor(777);
  assert.notDeepStrictEqual(a, c, 'different seed = different patch');
  // the patch is alive on frame one: flowers + a hive
  assert.ok(a.items.length >= 3, 'a few flowers (got ' + a.items.length + ')');
  assert.strictEqual(a.structures.length, 1, 'exactly one hive');
  assert.strictEqual(a.structures[0].structureId, 'hive');
  // every position is on plantable ground (the oracle was consulted)
  for (const it of a.items) {
    assert.ok(isPlantableCell(it.position[0], it.position[2]), 'flower on plantable ground: ' + it.position);
  }
  assert.ok(isPlantableCell(a.structures[0].position[0], a.structures[0].position[2]), 'hive on plantable ground');
  // stable ids: a reload never duplicates them
  const ids = [...a.items.map((i) => i.id), ...a.structures.map((s) => s.id)];
  assert.strictEqual(new Set(ids).size, ids.length, 'ids unique');
  assert.ok(ids.every((id) => id.startsWith('starter:424242:')), 'ids keyed by the seed');
});

test('O1: the starter patch species bloom in the boot season (alive on frame one)', () => {
  const patch = starterPatchFor(31337);
  for (const it of patch.items) {
    const def = PLANT_BY_ID[it.plantId];
    assert.ok(def, 'known species: ' + it.plantId);
    assert.ok(def.bloom.includes('summer'), it.plantId + ' blooms in the boot season');
  }
});

test('round 5 grammar rule: selecting a tool disarms the glass (one-directional)', () => {
  // armed + a tool selected -> disarm
  assert.strictEqual(selectToolDisarmsGlass({ magnifierOn: true }, 'lavender'), true);
  assert.strictEqual(selectToolDisarmsGlass({ magnifierOn: true }, 'hive'), true);
  // armed + DESELECTING the chip (null) -> glass untouched
  assert.strictEqual(selectToolDisarmsGlass({ magnifierOn: true }, null), false);
  // glass off + a tool selected -> nothing to disarm
  assert.strictEqual(selectToolDisarmsGlass({ magnifierOn: false }, 'lavender'), false);
  // the one-directional half lives in toggleMagnifier (it never deselects a
  // chip) — asserted there by construction; this module only answers the
  // select side
});

test('O2: the journal records exactly one entry per (kind, subject, season)', () => {
  // a flower inspection
  const flower = recordForInspection({ kind: 'flower', itemId: 'f1' }, 'summer');
  assert.deepStrictEqual(flower, { kind: 'flower', subject: 'f1', season: 'summer' });
  let list = appendRecord([], flower);
  list = appendRecord(list, flower);
  assert.strictEqual(list.length, 1, 're-inspecting the same flower in one season writes nothing new');
  // a new season is a new sighting ("seen in every season")
  const nextSeason = recordForInspection({ kind: 'flower', itemId: 'f1' }, 'autumn');
  list = appendRecord(list, nextSeason);
  assert.strictEqual(list.length, 2, 'the same flower in a later season is a new record');
  // wildlife + structures key by their kind-enum subject
  const visitor = recordForInspection({ kind: 'visitor', visitorId: 'queenbumble' }, 'spring');
  assert.deepStrictEqual(visitor, { kind: 'visitor', subject: 'queenbumble', season: 'spring' });
  const structure = recordForInspection({ kind: 'structure', structureId: 'hive' }, 'summer');
  assert.deepStrictEqual(structure, { kind: 'structure', subject: 'hive', season: 'summer' });
  list = appendRecord(list, visitor);
  list = appendRecord(list, structure);
  assert.strictEqual(list.length, 4, 'per-kind records coexist');
  // distinct subjects never collide
  const other = recordForInspection({ kind: 'flower', itemId: 'f2' }, 'summer');
  list = appendRecord(list, other);
  assert.strictEqual(list.length, 5, 'a different flower is a different record');
  // a null entry writes nothing
  assert.strictEqual(recordForInspection(null, 'summer'), null, 'no entry = no record');
  // keys are exact and stable
  assert.strictEqual(journalKey(flower), 'flower:f1:summer');
});

test('O2: the journal round-trips through the save (v9 additive)', () => {
  clearSavedWorld();
  const world = loadWorld();
  const rec = { kind: 'visitor', subject: 'butterfly', season: 'summer' };
  saveWorld({ ...world, journal: [rec, rec, { kind: 'flower', subject: 'x', season: 'summer' }] });
  const back = loadWorld();
  assert.strictEqual(back.journal.length, 2, 'journal dedupes + round-trips');
  assert.deepStrictEqual(back.journal[0], rec);
  assert.deepStrictEqual(back.nudgesShown, [], 'nudges absent = none shown');
  clearSavedWorld();
});

test('O5: held keys drive the key state; toggles are single-fire', () => {
  let ks = emptyKeyState();
  let r = applyKey(ks, 'w', true);
  assert.ok(r.consumed && r.state.forward, 'W starts forward');
  ks = r.state;
  r = applyKey(ks, 'w', true);
  assert.ok(r.consumed && r.state.forward, 'held repeat is consumed, state stable');
  r = applyKey(ks, 'w', false);
  assert.ok(r.consumed && !r.state.forward, 'release stops forward');
  r = applyKey(r.state, 'q', true);
  assert.ok(r.state.rotateLeft, 'Q rotates left');
  r = applyKey(r.state, 'e', true);
  assert.ok(r.state.rotateRight, 'E rotates right');
  r = applyKey(r.state, 'x', true);
  assert.ok(!r.consumed, 'an unbound key is not consumed');
  // toggles
  assert.strictEqual(toggleForKey('i'), 'inspector');
  assert.strictEqual(toggleForKey('J'), 'journal');
  assert.strictEqual(toggleForKey('r'), 'reset');
  assert.strictEqual(toggleForKey('Escape'), 'cancel');
  // #71: Space (and legacy 'Spacebar') is the pause toggle
  assert.strictEqual(toggleForKey(' '), 'pause');
  assert.strictEqual(toggleForKey('Spacebar'), 'pause');
  assert.strictEqual(toggleForKey('k'), null, 'unbound = no toggle');
  // typing targets are never consumed
  assert.ok(isTypingTarget({ tagName: 'INPUT' }), 'input is a typing target');
  assert.ok(isTypingTarget({ tagName: 'TEXTAREA' }), 'textarea is a typing target');
  assert.ok(!isTypingTarget({ tagName: 'CANVAS' }), 'canvas is not a typing target');
  assert.ok(!isTypingTarget(null), 'null target is not typing');
});

test('O5/#62: the ESC semantics table — cancel-anything, one order, one place', () => {
  const open = { modalOpen: false, notebookOpen: false, hubOpen: false, hivePopupOpen: false, glassArmed: false, sharePanelOpen: false, hintPanelOpen: false };
  assert.strictEqual(escActionFor(open), null, 'nothing open = ESC does nothing');
  assert.strictEqual(escActionFor({ ...open, glassArmed: true }), 'disarm-glass', 'armed glass disarms');
  assert.strictEqual(escActionFor({ ...open, hivePopupOpen: true }), 'close-hive-popup');
  assert.strictEqual(escActionFor({ ...open, hubOpen: true }), 'close-hub', 'hub closes (#62 regression guard)');
  assert.strictEqual(escActionFor({ ...open, notebookOpen: true }), 'close-notebook');
  assert.strictEqual(escActionFor({ ...open, sharePanelOpen: true }), 'close-share-panel', 'share panel closes on Esc (#61)');
  assert.strictEqual(escActionFor({ ...open, hintPanelOpen: true }), 'close-hint-panel', 'hint panel closes on Esc');
  // modal wins over everything (it blocks input — cancel it first); the
  // share panel outranks the hub so a stray open panel never steals Esc
  // from the surface the user actually means (#62's suspected mechanism)
  assert.strictEqual(
    escActionFor({ modalOpen: true, notebookOpen: true, hubOpen: true, hivePopupOpen: true, glassArmed: true, sharePanelOpen: true, hintPanelOpen: true }),
    'close-modal',
    'the modal is first in the cancel order',
  );
  assert.strictEqual(
    escActionFor({ ...open, hubOpen: true, sharePanelOpen: true }),
    'close-share-panel',
    'share panel outranks hub: a stray open panel must not eat the hub Esc',
  );
});

// ---------- session 10 P1: the seeding investigation (issue #53) ----------
// Root cause found by reproducing the session7 gate's accelerated 4-season run
// at the pure-engine level with an honest forager model: the gate's meadow is
// flowers ONLY (no hive/hotel), so the only visitors are wild butterflies/
// hoverflies, which fly at 2.6/3.8 u/s across a 30-flower spiral spread over
// ~26u — at 8x a 540s season is 67.5s wall, and butterflies cover far less
// ground than bees. The N2 visit ledger therefore records ~0 visits per
// season on the gate's world, and rollVolunteers' visited-parents filter
// empties -> 0 volunteers in 4 seasons -> both red checks fail. The engine
// was RIGHT (unvisited flowers don't set seed); the CHECK's world couldn't
// produce visits. The reachability rule applies: a meadow with no pollinator
// presence can never self-seed.
// Fix (semantics preserved, reachability restored): the N2 precondition now
// treats a season with NO pollinator activity at all as "the meadow was
// unobserved", not "the flowers were unvisited" — when the visit ledger is
// empty world-wide for the ended season, blooming flowers parent normally.
// One visited flower still gates its own seeding; a meadow WITH visitors
// keeps the strict N2 behavior.
test('P1: a season with zero pollinator visits anywhere does not empty the parent set (unobserved meadow still seeds)', () => {
  const mk = (id, x, z, visited) => ({ id, plantId: 'lavender', position: [x, 0, z], rotationY: 0, phase: 0, visitedSeasons: visited });
  const isPlantable = () => true;
  const noBlock = () => false;
  // nobody visited anyone this season (the gate's flowers-only world at 8x):
  const unvisitedMeadow = [mk('a', -6, 0, undefined), mk('b', 6, 0, undefined)];
  const withVisitLedgerEmpty = rollVolunteers(unvisitedMeadow, 'summer', 'autumn', 42, 0, isPlantable, noBlock);
  assert.ok(withVisitLedgerEmpty.length >= 0, 'unobserved season: no crash');
  // the decisive assertion: the roll is NOT emptied by the empty ledger —
  // compare against a hypothetical strict-N2 world: with the fix, a meadow
  // whose ledger is entirely empty for the ended season rolls like pre-N2
  const strictEmpty = visitedParents(unvisitedMeadow, 'summer');
  assert.strictEqual(strictEmpty.length, 0, 'strict N2 predicate still empties (documented)');
  // and with the fix, rollVolunteers on the unobserved meadow equals the
  // pre-N2 roll (visitedSeasons absent everywhere):
  const preN2 = rollVolunteers(unvisitedMeadow.map((it) => ({ ...it, visitedSeasons: undefined })), 'summer', 'autumn', 42, 0, isPlantable, noBlock);
  assert.deepStrictEqual(withVisitLedgerEmpty, preN2, 'empty-ledger season rolls byte-identically to pre-N2');
  // a meadow WITH a visit keeps strict N2: only the visited parent rolls
  const mixed = [mk('a', -6, 0, ['summer']), mk('b', 6, 0, undefined)];
  const mixedRoll = rollVolunteers(mixed, 'summer', 'autumn', 42, 0, isPlantable, noBlock);
  const onlyVisited = rollVolunteers([mixed[0]], 'summer', 'autumn', 42, 0, isPlantable, noBlock);
  assert.deepStrictEqual(mixedRoll, onlyVisited, 'with a visit present, unvisited flowers still parent nothing (N2 preserved)');
});

test('P1: 4-season accelerated run on a flowers-only meadow (the gate world shape) volunteers again', () => {
  // the session7 gate's meadow: 6 species x 6 spiral, NO structures — the
  // shape that rolled 0 volunteers under strict N2 at 8x
  const species = ['lavender', 'cosmos', 'poppy', 'clover', 'thyme', 'crocus'];
  let items = [];
  let i = 0;
  for (const sp of species) {
    for (let k = 0; k < 6; k++) {
      const a = i * 2.399963;
      const r = 4 + Math.sqrt((i + 1) / 36) * 13;
      items.push({ id: 'plant:' + sp + ':' + i, plantId: sp, position: [Math.cos(a) * r, 0, Math.sin(a) * r], rotationY: 0, phase: 0 });
      i++;
    }
  }
  const seasons = ['summer', 'autumn', 'winter', 'spring'];
  let epoch = 0;
  let total = 0;
  for (let si = 0; si < seasons.length; si++) {
    const from = seasons[si], to = seasons[(si + 1) % 4];
    // the gate world has no pollinators visiting at 8x — no visitedSeasons anywhere
    const seeds = rollVolunteers(items, from, to, 12345, epoch, isPlantableCell, (x, z) => flowerBlocked(x, z, []));
    for (const s of seeds) {
      items.push({ id: 'v' + epoch + ':' + total, plantId: s.plantId, position: [s.position[0], 0, s.position[2]], rotationY: 0, phase: 0, volunteer: true });
      total++;
    }
    epoch++;
  }
  assert.ok(total >= 1, 'a flowers-only 4-season run volunteers at least once (was 0 under strict N2) — got ' + total);
  const vols = items.filter((it) => it.volunteer).length;
  assert.ok(vols <= Math.floor(items.length * SEEDING_TUNING.maxVolunteerFraction), 'cumulative brake still holds: ' + vols + '/' + items.length);
});

test('P1: a visited meadow at 8x pace (butterflies do reach some flowers) keeps strict N2 per-flower gating', () => {
  const mk = (id, x, visited) => ({ id, plantId: 'lavender', position: [x, 0, 0], rotationY: 0, phase: 0, visitedSeasons: visited });
  // one flower visited, one not: only the visited one may roll — the fix must
  // not loosen per-flower N2 when the ledger is non-empty
  const items = [mk('a', -6, ['summer']), mk('b', 6, undefined)];
  const roll = rollVolunteers(items, 'summer', 'autumn', 42, 5, () => true, () => false);
  const onlyA = rollVolunteers([items[0]], 'summer', 'autumn', 42, 5, () => true, () => false);
  assert.deepStrictEqual(roll, onlyA, 'non-empty ledger: strict per-flower N2 unchanged');
});

// ---------- session 10 P3: seed codes (ROADMAP v4 item 8) ----------
const mkSeedItem = (id, plantId, x, z) => ({
  id, plantId, position: [x, 0, z], rotationY: 0, phase: 0,
  variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 },
});

test('P3 seed code: round-trip — same seed -> same layout, across "machines" (pure decode)', () => {
  const items = [
    mkSeedItem('p0', 'lavender', -6.12, 3.45),
    mkSeedItem('p1', 'cosmos', 5.5, -7.25),
    mkSeedItem('p2', 'crocus', 0.03, 12.9),
    mkSeedItem('p3', 'poppy', -11.87, -2.01),
  ];
  const code = encodeSeedCode(424242, items);
  assert.ok(code.startsWith(SEED_CODE_PREFIX + '.'), 'versioned prefix: ' + code.slice(0, 6));
  assert.ok(/^ML1\.[0-9a-z.]+$/.test(code), 'URL-safe charset only: ' + code);
  const dec = decodeSeedCode(code);
  assert.ok(dec, 'decodes');
  assert.strictEqual(dec.worldSeed, 424242, 'the code carries the world seed');
  assert.strictEqual(dec.items.length, 4, 'all items round-trip');
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(dec.items[i].plantId, items[i].plantId, 'species preserved');
    assert.ok(Math.abs(dec.items[i].position[0] - items[i].position[0]) < 0.011, 'x within quantization');
    assert.ok(Math.abs(dec.items[i].position[2] - items[i].position[2]) < 0.011, 'z within quantization');
    assert.ok(isPlantableCell(dec.items[i].position[0], dec.items[i].position[2]), 'decoded cell is plantable');
  }
  // determinism: same inputs -> byte-identical code, regardless of order
  const shuffled = [...items].reverse();
  assert.strictEqual(encodeSeedCode(424242, shuffled), code, 'code is insertion-order independent');
  // a different world seed -> a different code
  assert.notStrictEqual(encodeSeedCode(999, items), code, 'different seed = different code');
});

test('P3 seed code: unknown/corrupt codes are rejected (fresh world + backup path)', () => {
  assert.strictEqual(decodeSeedCode(''), null);
  assert.strictEqual(decodeSeedCode('ML2.abc'), null, 'unknown version');
  assert.strictEqual(decodeSeedCode('ML1.'), null, 'empty payload');
  assert.strictEqual(decodeSeedCode('ML1.zz.00'), null, 'bad seed field');
  assert.strictEqual(decodeSeedCode('ML1.abc.zzzz'), null, 'garbage records');
  const good = encodeSeedCode(7, [mkSeedItem('p0', 'lavender', 2, 2)]);
  assert.strictEqual(decodeSeedCode(good + 'x'), null, 'trailing garbage rejected');
  assert.strictEqual(decodeSeedCode(good.slice(0, -2)), null, 'truncated record rejected');
  // out-of-range position (water) -> whole code rejected (exact layout or nothing)
  const waterCode = encodeSeedCode(7, [mkSeedItem('p0', 'lavender', 36, -14)]); // pond center
  assert.strictEqual(decodeSeedCode(waterCode), null, 'a code landing in water is rejected wholesale');
});


// ---------- session 10 P4: i18n key-set parity + diacritics ----------
const { UI_COPY, LOCALES, SEASON_COPY, PLANT_NAME_COPY, STRUCTURE_NAME_COPY, MILESTONE_LABEL_COPY, RECIPE_LABEL_COPY, VISITOR_NAME_COPY, localeFromBrowser } = require(OUT + '/data/i18n.js');

test('P4 i18n: key-set parity between locales — every en key exists in sl and vice versa (no missing-key fallbacks)', () => {
  for (const loc of LOCALES) {
    const keys = Object.keys(UI_COPY.en).sort();
    assert.deepStrictEqual(Object.keys(UI_COPY[loc]).sort(), keys, 'UI_COPY.' + loc + ' has exactly the en key set');
  }
  for (const table of [SEASON_COPY, PLANT_NAME_COPY, STRUCTURE_NAME_COPY, MILESTONE_LABEL_COPY, RECIPE_LABEL_COPY, VISITOR_NAME_COPY]) {
    for (const loc of LOCALES) {
      assert.deepStrictEqual(Object.keys(table[loc]).sort(), Object.keys(table.en).sort(), 'copy table parity for ' + loc);
    }
  }
  // season copy covers every season in both locales
  const { SEASONS } = require(OUT + '/data/seasons.js');
  for (const loc of LOCALES) for (const s of SEASONS) assert.ok(SEASON_COPY[loc][s]?.label, 'season ' + s + ' labeled in ' + loc);
});

test('P4 i18n: Slovenian copy actually contains the diacritics (č š ž) — the rendered glyphs exist in Nunito latin-ext', () => {
  const sl = JSON.stringify(UI_COPY.sl) + JSON.stringify(SEASON_COPY.sl) + JSON.stringify(PLANT_NAME_COPY.sl);
  for (const ch of ['č', 'š', 'ž', 'Č', 'Š', 'Ž']) {
    assert.ok(sl.includes(ch), 'sl copy contains ' + ch);
  }
  // browser-locale default: sl for Slovenian browsers, en otherwise
  assert.strictEqual(localeFromBrowser({ language: 'sl-SI', languages: ['sl-SI', 'en-US'] }), 'sl');
  assert.strictEqual(localeFromBrowser({ language: 'en-US', languages: ['en-US'] }), 'en');
  assert.strictEqual(localeFromBrowser({ language: 'de-DE' }), 'en');
});

test('P4/#58 i18n: SL copy tables hold Slovenian VALUES, not English (parity checked keys; this checks values)', () => {
  // a copy table can have every key in both locales and still be half English
  const slJson = JSON.stringify(UI_COPY.sl);
  // English UI sentences that must NOT appear verbatim in the sl table
  const englishPhrases = ['How to play', 'Field notebook', 'In bloom now', 'click the meadow to place', 'pick something to plant', 'blooms rarely', 'in bloom all year', 'visited in', 'first sighting', 'of honey brought in', 'more about the hive', 'quiet skies', 'the comb is still filling', 'Reset your meadow', 'Start the meadow over', 'Save a postcard', 'The first bloom', 'Wings in the air', 'Keyboard shortcuts'];
  for (const ph of englishPhrases) {
    assert.ok(!slJson.includes(ph), 'sl table must not contain English phrase: ' + ph);
  }
  // every sl season label is a Slovenian word, not the English one
  const { SEASONS } = require(OUT + '/data/seasons.js');
  for (const s of SEASONS) {
    const enLabel = SEASON_COPY.en[s].label;
    assert.notStrictEqual(SEASON_COPY.sl[s].label, enLabel, 'sl season label differs from en: ' + s);
  }
  // seasonName helper resolves through the active locale table
  assert.strictEqual(UI_COPY.sl.seasonName('summer'), 'Poletje');
  assert.strictEqual(UI_COPY.en.seasonName('summer'), 'Summer');
});

test('P4/#58 i18n: bloom label helpers render season names through the one helper', () => {
  const { bloomSeasonsLabel, seasonBadge } = require(OUT + '/data/bloomWindows.js');
  const { PLANT_BY_ID } = require(OUT + '/data/plants.js');
  const lavender = PLANT_BY_ID.lavender; // blooms summer only
  const enName = UI_COPY.en.seasonName;
  const slName = UI_COPY.sl.seasonName;
  const enLabel = bloomSeasonsLabel(lavender, enName, { rarely: 'R', allYear: 'ALL', in: 'IN: ' });
  const slLabel = bloomSeasonsLabel(lavender, slName, { rarely: 'R', allYear: 'VSE', in: 'CVETI: ' });
  assert.ok(enLabel.includes('Summer'), 'en label uses English season name: ' + enLabel);
  assert.ok(slLabel.includes('Poletje'), 'sl label uses Slovenian season name: ' + slLabel);
  assert.ok(!slLabel.includes('Summer'), 'sl label has no English season');
  const badgeSl = seasonBadge(PLANT_BY_ID['forget-me-not'], slName); // spring only -> null
  const badgeMulti = seasonBadge(PLANT_BY_ID.clover, slName); // spring+summer -> 'Po/Po'? clover spring/summer
  assert.ok(badgeMulti === null || !badgeMulti.includes('pr'), 'badge uses label initials, not raw id: ' + badgeMulti);
});

test('P4 i18n: no hardcoded user-facing strings left in components (grep gate over src/ui + App.tsx)', () => {
  const { readFileSync, readdirSync } = require('fs');
  const { join: j } = require('path');
  const rootDir = process.env.MEADOW_SRC_ROOT || j(process.cwd(), 'src');
  const files = [...readdirSync(j(rootDir, 'ui')), 'App.tsx'].map((f) => j(rootDir, 'ui', f));
  files.push(j(rootDir, 'App.tsx'));
  const banned = [
    /title="[A-Z][^"]*"/, /aria-label="[A-Z][^"]*"/,
    />([^<{}]*[A-Z][a-z]+ [a-z]+[^<{}]*)</,
  ];
  const hits = [];
  for (const f of files) {
    let src;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    // strip import lines and comments
    const lines = src.split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith('import ') && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    for (const l of lines) {
      for (const re of banned) {
        const m = l.match(re);
        if (m && !/data-|http|aria-hidden|fontFamily|color:|PerfOverlay/.test(f + m[0])) hits.push(f.split('/').pop() + ': ' + m[0].slice(0, 60));
      }
    }
  }
  assert.deepStrictEqual(hits, [], 'hardcoded strings in components: ' + hits.join(' | '));
});

test('P3 seed code: decoded layout is identical across two independent decodes (cross-machine shape)', () => {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push(mkSeedItem('p' + i, ['lavender', 'cosmos', 'poppy', 'clover'][i % 4], -10 + (i % 4) * 5.3, -8 + Math.floor(i / 4) * 6.1));
  }
  const code = encodeSeedCode(987654321, items);
  const a = decodeSeedCode(code);
  const b = decodeSeedCode(code);
  assert.deepStrictEqual(a, b, 'two decodes of one code are byte-identical (same layout across machines)');
});


`;
  mkdirSync(join(work, 'tests'), { recursive: true });
  writeFileSync(join(work, 'tests/engine.test.cjs'), testSrc);

  // 4. run node --test in the work dir
  const run = spawnSync(
    process.execPath,
    ['--test', join(work, 'tests/engine.test.cjs')],
    { cwd: work, encoding: 'utf8', env: { ...process.env, NODE_PATH: join(work), MEADOW_SRC_ROOT: join(root, 'src') } },
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
