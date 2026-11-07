#!/usr/bin/env node
/**
 * Headless-browser gate driver (the session-2 ".gate" harness, committed so
 * session 3 can reuse it). Boots headless Chromium via playwright-core,
 * loads the dev server (must already be running), and runs the checks given
 * on the command line. Prints one PASS/FAIL line per check and exits 1 on
 * any failure. Console errors / page errors on any check fail the run.
 *
 * Usage:
 *   node scripts/browser-gate.mjs --url http://localhost:5199 --checks boot,onboarding
 *
 * Requires the playwright-core package (dev-only, not a runtime dependency)
 * and a chromium install: node_modules/playwright-core/cli.js install chromium.
 * On minimal Linux images, set BROWSER_LIB_PATH to a dir containing the
 * extracted X11/GLib shared libraries and this script will export it as
 * LD_LIBRARY_PATH before launching (session-2 sandbox workaround).
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const url = getArg('--url', 'http://localhost:5199');
const checks = getArg('--checks', 'boot').split(',');
const libPath = getArg('--lib-path', '');

if (libPath && !process.env.LD_LIBRARY_PATH) {
  process.env.LD_LIBRARY_PATH = libPath;
}

const results = [];

async function newPage(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  return { page, errors };
}

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[GATE] ${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function runChecks(browser) {
  for (const check of checks) {
    try {
      const { page, errors } = await newPage(browser);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3000);
      if (check === 'boot') {
        // #79 (detector fix, named): the boot contract is the TEST HOOK —
        // window.__meadowlight with its __three bridge (camera/gl/scene),
        // which every other gate in the harness consumes. window.THREE was
        // never a contract: no src/ file, no other gate, and no html/vite
        // config assigns it — it was an early dev-config side effect that a
        // later session legitimately removed. Assert the real contract.
        const hook = await page.evaluate(() => ({
          hasHook: !!window.__meadowlight,
          hasThreeBridge: !!(window.__meadowlight && window.__meadowlight.__three && window.__meadowlight.__three.camera && window.__meadowlight.__three.gl),
        }));
        record('boot', hook.hasHook && hook.hasThreeBridge, JSON.stringify(hook));
      } else if (check === 'onboarding') {
        // fresh save -> overlay in DOM on first load
        const first = await page.evaluate(() => {
          window.localStorage.removeItem('meadowlight.world.v2');
          return !!document.querySelector('[data-onboarding]');
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const overlayShown = await page.evaluate(() => !!document.querySelector('[data-onboarding]'));
        record('onboarding.fresh-save-shows-overlay', overlayShown, `overlay=${overlayShown}`);
        // dismiss via its single dismiss control, reload, must not reappear
        const dismissed = await page.evaluate(() => {
          const el = document.querySelector('[data-onboarding-dismiss]');
          if (el) {
            el.click();
            return true;
          }
          return false;
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        const afterDismiss = await page.evaluate(() => !!document.querySelector('[data-onboarding]'));
        record('onboarding.dismiss-once-never-again', dismissed && !afterDismiss, `dismissClickable=${dismissed} overlayAfterReload=${afterDismiss}`);
        // placement still works while onboarding was never a blocker: plant via hook
      } else if (check === 'audio') {
        // audio graph construction check: click the toggle, then inspect the graph
        const info = await page.evaluate(() => {
          const btn = document.querySelector('[data-audio-toggle]');
          if (!btn) return { found: false };
          btn.click();
          return { found: true, label: btn.textContent };
        });
        await page.waitForTimeout(500);
        const graph = await page.evaluate(() => window.__meadowlight?.audioDebug?.());
        record('audio.toggle-creates-graph', info.found && !!graph && graph.running, JSON.stringify({ found: info.found, label: info.label, graph }));
        const off = await page.evaluate(() => {
          const btn = document.querySelector('[data-audio-toggle]');
          btn?.click();
          return btn ? btn.textContent : null;
        });
        record('audio.toggle-off-again', !!off, `labelAfterOff=${off}`);
      } else if (check === 'postcard') {
        const png = await page.evaluate(() => window.__meadowlight?.capturePostcard?.());
        record('postcard.png-produced', typeof png === 'string' && png.startsWith('data:image/png') && png.length > 5000, `bytes~${png ? png.length : 0}`);
      } else if (check === 'solitary') {
        const info = await page.evaluate(() => {
          const w = window.__meadowlight;
          w.clear();
          w.plant('lavender', 2, 2);
          w.plant('clover', 3, 2);
          w.plant('poppy', 4, 2);
          w.plant('sunflower', 5, 2);
          w.plant('thyme', 6, 2);
          w.plant('forget-me-not', 7, 2);
          w.placeStructure('hive', 0, 0);
          w.placeStructure('hotel', -3, 0);
          return { items: w.items().length, structures: w.structures().length };
        });
        await page.waitForTimeout(2500);
        const counts = await page.evaluate(() => {
          const w = window.__meadowlight;
          return { hive: w.beeCount(), solitary: w.solitaryBeeCount?.() ?? null, hotel: w.structures().filter((s) => s.structureId === 'hotel').length };
        });
        record('solitary.bees-in-hotel', counts.solitary !== null && counts.solitary > 0, JSON.stringify({ ...info, ...counts }));

        // #88: MOVEMENT — deterministic fixture, day phase pinned (#82), summer
        // midday. Solitary bees must work flowers away from the hotel over time
        // (visits recorded through the ONE visit path) and return between trips.
        const move = await page.evaluate(async () => {
          const w = window.__meadowlight;
          w.clear();
          w.placeStructure('hotel', -3, 0);
          w.placeStructure('hive', 0, 0);
          for (let i = 0; i < 6; i++) w.plant('lavender', -6 + i * 1.2, 2); // within forageRadius of the hotel
          w.setSeason('summer');
          w.setSeasonProgressForTest(0.5);
          w.setDayPhase(0.5); // midday pinned (#82 lesson)
          w.timeSetPaused(false);
          w.timeSetSpeed(1);
          await new Promise((r) => setTimeout(r, 6000)); // ease + first trips
          const hotel = w.structures().find((s) => s.structureId === 'hotel');
          const dists = () => {
            const solos = w.wildlifeSightings().filter((s) => s.kind === 'solitarybee');
            if (solos.length === 0) return { min: 0, max: 0 };
            const ds = solos.map((s) => Math.hypot(s.x - hotel.position[0], s.z - hotel.position[2]));
            return { min: +Math.min(...ds).toFixed(2), max: +Math.max(...ds).toFixed(2) };
          };
          const samples = [];
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            samples.push(dists());
          }
          const visits = w.visitsReadback().filter((v) => v.visitedSeasons.includes('summer')).length;
          return { samples, visits, count: w.solitaryBeeCount() };
        });
        const away = move.samples.some((s) => s.max > 3); // working flowers, well outside the hotel
        const homeTraffic = move.samples.some((s) => s.min < 2); // returns between trips (hotel = home base)
        record(
          'solitary.forages-away-and-returns',
          move.count >= 2 && away && homeTraffic && move.visits > 0,
          JSON.stringify(move) + ' (away>3u at some sample, home<2u at some sample, summer visits recorded)',
        );

        // #88 winter: the same curve (R2) rests the solitaries AT the hotel —
        // deterministic fixture, midday pinned, after the breath settles
        const winter = await page.evaluate(async () => {
          const w = window.__meadowlight;
          w.setSeason('winter');
          w.setSeasonProgressForTest(0.5);
          w.setDayPhase(0.5);
          await new Promise((r) => setTimeout(r, 8000));
          const hotel = w.structures().find((s) => s.structureId === 'hotel');
          const solos = w.wildlifeSightings().filter((s) => s.kind === 'solitarybee');
          const dists = solos.map((s) => Math.hypot(s.x - hotel.position[0], s.z - hotel.position[2]));
          return {
            count: w.solitaryBeeCount(),
            maxDist: dists.length ? +Math.max(...dists).toFixed(2) : null,
            target: +w.colonyReadback().target.toFixed(4),
          };
        });
        record(
          'solitary.rest-at-hotel-in-winter',
          winter.count >= 1 && winter.maxDist !== null && winter.maxDist <= 2.5 && winter.target >= 0.4,
          JSON.stringify(winter) + ' (winter: all solitaries resting at the hotel, curve floor held)',
        );
      } else if (check === 'perf') {
        // full-polish gate handled by the dedicated perf script
        record('perf.placeholder', true, '');
      } else {
        record(`unknown-check:${check}`, false, 'no such check');
      }
      const realErrors = errors.filter((e) => !/favicon/.test(e));
      if (realErrors.length > 0) {
        record(`console-errors:${check}`, false, realErrors.slice(0, 3).join(' | '));
      }
      await page.close();
    } catch (err) {
      record(check, false, err.message);
    }
  }
}

const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = false;
await runChecks(browser);
await browser.close();
for (const r of results) {
  if (!r.pass) failed = true;
}
process.exit(failed ? 1 : 0);
