#!/usr/bin/env node
/**
 * Behavioral gate for the bees-idle-at-hive fix (issue repro):
 *   check 1: 200 flowers + forced bloom -> bees must disperse to flowers
 *            over time (avg distance from hive grows; foraging > parked).
 *   check 2: empty meadow -> bees wander near hive, never frozen
 *            (avgSpeed stays > 0; wander points picked).
 * Dev-only harness; requires the dev server on --url.
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const url = getArg('--url', 'http://localhost:5199');
const libPath = getArg('--lib-path', '');
if (libPath && !process.env.LD_LIBRARY_PATH) {
  process.env.LD_LIBRARY_PATH = libPath;
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[GATE] ${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

async function newPage() {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  return { page, errors };
}

// ---------- check 1: 200 flowers, forced bloom, dispersion over time ----------
{
  const { page, errors } = await newPage();
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    // 200 flowers spread across the meadow square (edge 44 -> coords in [-20,20])
    let n = 0;
    outer: for (let gx = -20; gx <= 20 && n < 200; gx += 2.2) {
      for (let gz = -20; gz <= 20 && n < 200; gz += 2.2) {
        const jx = gx + (Math.random() - 0.5) * 0.8;
        const jz = gz + (Math.random() - 0.5) * 0.8;
        const species = ['lavender', 'clover', 'poppy', 'sunflower', 'thyme', 'forget-me-not'][n % 6];
        w.plant(species, jx, jz);
        n++;
      }
    }
    w.placeStructure('hive', 0, 0);
    w.setSeason('summer'); // force bloom for the summer bloomers
    // #82 (detector fix): pin the season progress too — setSeason already
    // restarts the calendar at progress 0; pinning 0.5 makes the fixture's
    // bloom window explicit and immune to boot-phase residue
    w.setSeasonProgressForTest(0.5);
    // #82 round 2 (detector fix): pin the DAY PHASE as well — the clock boots
    // at GOLDEN_HOUR 0.82 and drifts at 1x (360s/day), so dusk (0.88) arrives
    // ~21.6s after boot and bees legitimately home at night. The sampling
    // window must not cross dusk (the 857e4f4 run's all-home/0-foraging FAIL
    // signature); setDayPhase(0.5) = noon, and the override HOLDS the clock.
    w.setDayPhase(0.5);
    return n;
  });
  // #82 (detector fix): sample until the swarm settles instead of a fixed
  // 10x2s window. targetFound is CUMULATIVE and monotone, so polling it
  // removes the load dependence the moving counts exposed: the adaptive
  // swarm cap (frame-time driven) and the colony-breath ease make the
  // forager count inside a fixed wall-clock window machine-dependent
  // (full suite vs standalone read 19 vs 13). The predicate is REACHED,
  // not sampled at one instant.
  const samples = [];
  const deadline = Date.now() + 60000;
  let last = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    last = await page.evaluate(() => window.__meadowlight.beeDebug());
    samples.push(last);
    if (last.targetFound > 20) break;
  }
  const first = samples[0];
  // observable is ABSOLUTE dispersion (bees spread across the planted field),
  // not growth ratio: the fixed swarm reaches steady-state dispersion within
  // the first 2s sample. Pre-fix baseline for this scenario: 4.9u avg, bees
  // clustered at the hive entrance.
  const avgGrew = last.avgDistFromHive > 6 && last.maxDistFromHive > 12;
  const foraging = last.foraging + last.wandering > last.homing;
  const totalFound = last.targetFound;
  record('bees.200-flowers-disperse', avgGrew,
    `avgDist ${first.avgDistFromHive.toFixed(1)}u -> ${last.avgDistFromHive.toFixed(1)}u, max ${last.maxDistFromHive.toFixed(1)}u`);
  record('bees.200-flowers-foraging-not-parked', foraging,
    `foraging ${last.foraging} wander ${last.wandering} home ${last.homing} of ${last.count}`);
  // "lost" predicate, named: beeDebug.targetLost = cumulative bees whose
  // held target vanished (removed / out of bloom) or failed to re-resolve in
  // the same frame as selection — stable fixture => ~0; load-correlated
  // same-frame misses otherwise. The contract is target ACQUISITION.
  record('bees.targets-being-found', totalFound > 20, `targetFound=${totalFound} lost=${last.targetLost} count=${last.count} samples=${samples.length}`);
  const realErrors = errors.filter((e) => !/favicon/.test(e));
  record('bees.200-flowers-no-console-errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------- check 2: empty meadow -> gentle wander, never frozen ----------
{
  const { page, errors } = await newPage();
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    w.placeStructure('hive', 0, 0);
    w.setSeason('summer'); // foraging season but ZERO flowers
    // #82 round 2: pin the day phase here too — the wander check must not
    // race dusk either (same boot-drift mechanism as check 1)
    w.setDayPhase(0.5);
  });
  await page.waitForTimeout(6000);
  const mid = await page.evaluate(() => window.__meadowlight.beeDebug());
  await page.waitForTimeout(6000);
  const end = await page.evaluate(() => window.__meadowlight.beeDebug());
  const flying = end.avgSpeed > 0.5;
  const wandering = end.wandering + end.homing > 0 && end.wanderPicked > 0;
  const nearHive = end.avgDistFromHive < 10; // gentle wander stays near the hive
  record('bees.empty-meadow-keeps-flying', flying,
    `avgSpeed=${end.avgSpeed.toFixed(2)} avgDist=${end.avgDistFromHive.toFixed(1)}u wanderPicked=${end.wanderPicked}`);
  record('bees.empty-meadow-wanders-not-frozen', wandering,
    `wandering=${end.wandering} homing=${end.homing} of ${end.count}`);
  record('bees.empty-meadow-stays-near-hive', nearHive,
    `avgDistFromHive=${end.avgDistFromHive.toFixed(1)}u max=${end.maxDistFromHive.toFixed(1)}u`);
  const realErrors = errors.filter((e) => !/favicon/.test(e));
  record('bees.empty-meadow-no-console-errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
process.exit(results.some((r) => !r.pass) ? 1 : 0);
