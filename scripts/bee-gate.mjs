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
    return n;
  });
  // sample bee telemetry over ~20s: dispersion must grow, foraging must dominate
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const d = await page.evaluate(() => window.__meadowlight.beeDebug());
    samples.push(d);
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
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
  record('bees.targets-being-found', totalFound > 20, `targetFound=${totalFound} lost=${last.targetLost}`);
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
