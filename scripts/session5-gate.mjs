#!/usr/bin/env node
/**
 * Session 5 behavioral gate — the living world units, one script, --checks
 * per unit (addendum E: no one-off gate per unit; shared helpers in
 * gate-lib.mjs). CI (test:smoke) stays canonical; this is for behavior a
 * build can't see.
 *
 * Usage:
 *   node scripts/session5-gate.mjs --url http://localhost:5199 \
 *     --checks roster [--lib-path /path/to/libs]
 *
 * Checks (grow per session-5 unit):
 *   roster  — flower roster expansion (#8): palette, thumbnails, per-species
 *             bloom succession at render level, notebook fact, v4 save load
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

const { url = 'http://localhost:5199', checks = 'roster', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();

const NEW_SPECIES = ['crocus', 'borage', 'cosmos', 'aster'];
/** declared petal part sizes per new species (from src/data/plants.ts) —
 *  the render observable: petal scale == declared size in bloom,
 *  0.25x (OFF_BLOOM_SCALE) out of bloom */
/** ALL part sizes per new species (src/data/plants.ts order: stems then petals) */
const PART_SIZES = {
  crocus: [[0.07, 0.12], [0.3, 0.22], [0.16, 0.1], [0.1, 0.08]],
  borage: [[0.1, 0.55], [0.2, 0.16], [0.26, 0.1], [0.14, 0.1], [0.08, 0.08]],
  cosmos: [[0.08, 0.75], [0.16, 0.14], [0.36, 0.08], [0.2, 0.12], [0.1, 0.08]],
  aster: [[0.09, 0.5], [0.3, 0.1], [0.16, 0.12]],
};
const BLOOM_SEASON = { crocus: 'spring', borage: 'summer', cosmos: 'autumn', aster: 'autumn' };
const OFF_SEASON = { crocus: 'summer', borage: 'autumn', cosmos: 'spring', aster: 'spring' };
const PART_COUNT = { crocus: 4, borage: 5, cosmos: 5, aster: 3 };

/** read petal scales for one planted species in a given season */
async function readPetalScales(page, species, season) {
  return page.evaluate(async ({ species, season, petalSizes, partCount }) => {
    const w = window.__meadowlight;
    if (!w || !w.__three) return null;
    w.clear();
    w.setSeason(season);
    w.plant(species, 0, 0);
    await new Promise((res) => setTimeout(res, 500));
    const scene = w.__three.scene;
    let found = null;
    // several species share the same instance capacity (same part count), so
    // identify THIS species' mesh by its measured part scales: every part must
    // match its declared size (in bloom) or 0.25x of it (petals off-season)
    scene.traverse((o) => {
      if (found || !o.isInstancedMesh || o.instanceMatrix?.count !== 400 * partCount) return;
      const m = o.instanceMatrix.array;
      const scales = [];
      for (let i = 0; i < partCount; i++) {
        const off = i * 16;
        scales.push([
          Math.hypot(m[off + 0], m[off + 1], m[off + 2]),
          Math.hypot(m[off + 4], m[off + 5], m[off + 6]),
        ]);
      }
      const matches = petalSizes.every(
        (p, k) =>
          Math.abs(scales[k][0] - p[0]) < 0.02 ||
          Math.abs(scales[k][0] - p[0] * 0.25) < 0.02,
      );
      if (matches) found = scales;
    });
    w.clear();
    return found;
  }, { species, season, petalSizes: PART_SIZES[species], partCount: PART_COUNT[species] });
}

/** ratio of measured petal scale to declared size (expect 1.0 in bloom, 0.25 off) */
function petalRatios(scales, petals, partIndices) {
  return partIndices.map((pi) =>
    scales.slice(pi, pi + 1).map((s, k) => [s[0] / petals[k][0], s[1] / petals[k][1]]),
  ).flat();
}

async function checkRoster(browser) {
  // 1. palette: 10 species with thumbnails, present + rendered
  {
    const { page, errors } = await newPage(browser, url);
    const r = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      const names = ['Lavender','Clover','Wild Poppy','Sunflower','Wild Thyme','Forget-me-not','Crocus','Borage','Cosmos','Aster'];
      const missing = [];
      let inViewport = 0;
      for (const n of names) {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(n) && b.querySelector('img,canvas'));
        if (!btn) { missing.push(n); continue; }
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom > 0) inViewport++;
      }
      return { missing, inViewport };
    });
    rec.record('roster.palette-10-species-with-thumbs', r.missing.length === 0 && r.inViewport === 10,
      `missing=${JSON.stringify(r.missing)} inViewport=${r.inViewport}`);
    const re = realErrors(errors);
    rec.record('roster.palette-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 2. bloom succession at render level, per new species
  {
    const { page, errors } = await newPage(browser, url);
    const detail = {};
    let pass = true;
    // petal parts come after the stem parts; count non-petal parts per species
    const STEM_COUNT = { crocus: 1, borage: 2, cosmos: 2, aster: 1 };
    for (const sp of NEW_SPECIES) {
      const inBloomScales = await readPetalScales(page, sp, BLOOM_SEASON[sp]);
      const offBloomScales = await readPetalScales(page, sp, OFF_SEASON[sp]);
      const parts = PART_SIZES[sp];
      const stemCount = STEM_COUNT[sp];
      const petals = parts.slice(stemCount);
      const bloomRatios = petals.map((p, k) => inBloomScales[stemCount + k][0] / p[0]);
      const offRatios = petals.map((p, k) => offBloomScales[stemCount + k][0] / p[0]);
      const bloomOk = bloomRatios.every((r) => Math.abs(r - 1) < 0.03);
      const offOk = offRatios.every((r) => Math.abs(r - 0.25) < 0.03);
      if (!bloomOk || !offOk) pass = false;
      detail[sp] = { bloomRatios: bloomRatios.map((x) => +x.toFixed(3)), offRatios: offRatios.map((x) => +x.toFixed(3)) };
    }
    rec.record('roster.bloom-succession-rendered-per-species', pass, JSON.stringify(detail));
    const re = realErrors(errors);
    rec.record('roster.bloom-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 3. notebook fact for a new species (DOM geometry readback, not string presence)
  {
    const { page, errors } = await newPage(browser, url);
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.plant('borage', 1, 1);
      await new Promise((res) => setTimeout(res, 300));
      w.openNotebookPlant(w.items()[0].id);
      await new Promise((res) => setTimeout(res, 600));
      const panels = [...document.querySelectorAll('div')].filter((d) => d.textContent.includes('refills its nectar within minutes'));
      if (panels.length === 0) return { found: false };
      const rect = panels[panels.length - 1].getBoundingClientRect();
      return { found: true, inViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0 };
    });
    rec.record('roster.notebook-fact-borage-in-viewport', r.found && r.inViewport, JSON.stringify(r));
    const re = realErrors(errors);
    rec.record('roster.notebook-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 4. v4 save (six originals) loads unchanged. The app saves on
  // beforeunload + every 3s, so the blob must be written BEFORE app scripts
  // run (addInitScript) — writing from a live page gets overwritten on unload.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    const saveBlob = JSON.stringify({
      // exact WorldData v4 shape (persistence.ts): rotationY per item,
      // placementVariation required, optional additive fields
      version: 4,
      items: [
        { id: 'a1', plantId: 'lavender', position: [1, 0, 1], rotationY: 0, variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 } },
        { id: 'a2', plantId: 'clover', position: [2, 0, 1], rotationY: 0, variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 } },
        { id: 'a3', plantId: 'poppy', position: [3, 0, 1], rotationY: 0, variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 } },
      ],
      structures: [{ id: 'h1', structureId: 'hive', position: [0, 0, 0], rotationY: 0, variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 } }],
      milestones: ['firstFlower'],
      season: 'summer',
      placementVariation: false,
      randomRotation: false,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: true,
    });
    await page.addInitScript((blob) => {
      localStorage.setItem('meadowlight.world.v2', blob);
    }, saveBlob);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => {
      const w = window.__meadowlight;
      const items = w.items();
      return { items: items.length, ids: items.map((i) => i.id).sort(), milestones: w.milestones() };
    });
    const okLoad = after.items === 3 && JSON.stringify(after.ids) === '["a1","a2","a3"]' && after.milestones.includes('firstFlower');
    rec.record('roster.v4-save-loads-unchanged', okLoad, JSON.stringify(after));
    const re = realErrors(errors);
    rec.record('roster.save-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

const browser = await launchChromium(chromium, { libPath });
for (const check of checks.split(',')) {
  if (check === 'roster') await checkRoster(browser);
  else rec.record(`unknown-check:${check}`, false, 'no such check');
}
await browser.close();
process.exit(rec.exitCode());
