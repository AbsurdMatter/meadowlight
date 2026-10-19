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
  const engineFiles = ['pollinator.ts', 'milestones.ts', 'variation.ts', 'factSelection.ts', 'collision.ts', 'persistence.ts', 'terrain.ts', 'postcardLayout.ts'];
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
const { SEASONS } = require(OUT + '/data/seasons.js');
const { checkMilestones } = require(OUT + '/engine/milestones.js');
const { variationFor, rollVariation, noVariation, VARIATION_TUNING } = require(OUT + '/engine/variation.js');
const { choosePlantFact, chooseStructureFact, chooseMeadowFact } = require(OUT + '/engine/factSelection.js');
const { flowerBlocked, structureBlocked } = require(OUT + '/engine/collision.js');
const { computeCaptionLayout, fallbackMetrics } = require(OUT + '/engine/postcardLayout.js');

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
