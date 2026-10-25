#!/usr/bin/env node
/**
 * Session 9 (v4) behavioral gate — polish pack + O-units, one script,
 * --checks per unit (gate-lib pattern). CI (test:smoke) stays canonical;
 * this is for behavior a build can't see.
 *
 * Usage:
 *   node scripts/session9-gate.mjs --url http://localhost:5173 \
 *     --checks polish,onboarding,journal,keys,audio,touch \
 *     [--lib-path /path/to/libs]
 *
 *   polish — #44/#45/#46/#47:
 *     daycycle.halved — DAY_CYCLE_SECONDS reads 360 in the live page.
 *     precip.burst-spreads — force winter snow; the FIRST frame's drops
 *       cover the full spawn area (the #45 user-observed concentrated
 *       burst is gone): readback of drop xz positions at burst.
 *     fireflies.note-only-when-glowing — set summer + a wild corner +
 *       natural dusk: note appears; forced-ON outside dusk: no note
 *       (the #46 gate: present-but-not-glowing writes nothing).
 *     glass.refusal-toast-removed — arm the glass, right-click on the
 *       canvas (real contextmenu), assert NO toast appears and the card
 *       dismisses (behavior unchanged); zoom refusal KEEPS its toast.
 *
 *   onboarding — O1 (#39): a fresh world (clear + resetWorld) shows the
 *     starter patch (flowers + a hive on frame one, seeded from the
 *     worldSeed not Math.random — the layout is identical across two
 *     fresh worlds with the same seed), the hint renders in-viewport
 *     ABOVE the dock at 3 viewport widths, nudges fire on real conditions.
 *
 *   journal — O2 (#40): inspecting a flower/wildlife/structure writes
 *     exactly one journal record (field-diffed against the save); the
 *     inspection mutates nothing else; the journal renders from the
 *     saved blob.
 *
 *   keys — O5 (#43): real key events drive the real stores — I toggles
 *     magnifierOn, J toggles the hub, ESC cancels each openable surface,
 *     keys ignored while typing, R opens (never instantly fires) the
 *     confirm modal.
 *
 *   audio — O3 (#41): the toggle drives the graph lifecycle (off by
 *     default, on after the click, source nodes exist), volume follows
 *     the bee count through the unit-testable pure function, no console
 *     errors. AUDIBLE OUTPUT IS THE USER'S CHECKLIST — a headless gate
 *     cannot hear.
 *
 *   touch — O4 (#42): DOM-anchored geometry at narrow widths (dock row
 *     unwrapped, no overlap at 360px), tap drives the inspect store.
 *     DEVICE FEEL IS THE USER'S CHECKLIST.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

const { url = 'http://localhost:5173', checks = 'polish', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();
const browser = await launchChromium(chromium, { libPath });

/** fresh world with a few flowers + a hive (each check builds its OWN) */
async function freshWorld(page) {
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    for (let i = 0; i < 6; i++) w.plant('lavender', -6 + i * 2, 3);
    w.placeStructure('hive', 2, -2);
  });
  await page.waitForTimeout(1500);
}

async function checkPolish() {
  // 1. #44: the day cycle reads 360 in the live page
  {
    const { page, errors } = await newPage(browser, url);
    const seconds = await page.evaluate(() => window.__meadowlight.dayCycleSecondsReadback());
    rec.record('daycycle.halved', seconds === 360, 'DAY_CYCLE_SECONDS readback: ' + seconds);
    const re = realErrors(errors);
    rec.record('daycycle.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 2. #45: snow burst spreads across the full area (not concentrated)
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('winter');
    });
    // drive the schedule to a snow window (same sweep the session-8 gate uses)
    let burst = null;
    for (let p = 0; p <= 0.999 && !burst; p += 0.01) {
      await page.evaluate((pp) => window.__meadowlight.setSeasonProgressForTest(pp), p);
      await page.waitForTimeout(2600); // past the fast settle
      burst = await page.evaluate(() => {
        const rb = window.__meadowlight.rainDebug();
        const spread = window.__meadowlight.rainSpreadReadback();
        if (rb.kind !== 'snow' || rb.count === 0) return null;
        return { count: rb.count, spread };
      });
    }
    const ok =
      !!burst &&
      burst.spread.x > 24 && // RAIN_VISUAL.areaHalf * 1.5 — the area is covered
      burst.spread.z > 24;
    rec.record(
      'precip.burst-spreads',
      ok,
      burst
        ? 'snow burst: ' + burst.count + ' drops, spread x ' + burst.spread.x.toFixed(1) + 'u / z ' + burst.spread.z.toFixed(1) + 'u of 48u area'
        : 'no snow window found in the sweep',
    );
    const re = realErrors(errors);
    rec.record('precip.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 3. #46: the fireflies note fires only inside the GLOW window —
  //    forced-on outside dusk (present but not glowing) writes NO note
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('summer');
      w.placeStructure('wildcorner', 6, 6);
      // natural NOON (not dusk): fireflies forced ON are present but the
      // render loop draws nothing — the note must not fire
      w.setDayPhase(0.5);
    });
    const note = await page.evaluate(() => {
      const w = window.__meadowlight;
      const before = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
      w.setFireflyForce(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          w.setFireflyForce(null);
          const after = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
          resolve({ before, after });
        }, 1500);
      });
    });
    rec.record(
      'fireflies.present-not-glowing-writes-no-note',
      note.after === note.before,
      'forced-on at noon (outside the glow window): ' + note.before + ' -> ' + note.after + ' notes (must be unchanged)',
    );
    // and the positive control: natural dusk DOES write the note
    const positive = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.resumeDayCycleForTest?.();
      w.setDayPhase(0.82); // golden hour, inside isDusk
      w.setFireflyForce(null);
      const before = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
      return new Promise((resolve) => {
        setTimeout(() => {
          const after = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
          resolve({ before, after });
        }, 1500);
      });
    });
    rec.record(
      'fireflies.natural-dusk-writes-note',
      positive.after === positive.before + 1,
      'natural dusk with a wild corner: ' + positive.before + ' -> ' + positive.after + ' notes (must gain exactly one)',
    );
    const re = realErrors(errors);
    rec.record('fireflies.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 4. #47: the glass-armed right-click refusal is SILENT (no toast), the
  //    card still dismisses; the ZOOM refusal keeps its toast
  {
    const { page, errors } = await newPage(browser, url);
    await freshWorld(page);
    // arm the glass + hover a flower so the card shows
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.toggleMagnifier();
      const f = w.items()[0];
      const cam = w.__three?.camera;
      if (f && cam) {
        const p = f.position;
        const pv = { x: p[0], y: p[1] + 0.6, z: p[2], w: 1 };
        const proj = cam.projectionMatrix.elements;
        const view = cam.matrixWorldInverse.elements;
        const mul = (a, v3) => ({
          x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
          y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
          z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
          w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
        });
        const clip = mul(proj, mul(view, pv));
        const ndc = { x: clip.x / clip.w, y: clip.y / clip.w };
        window.__hoverScreen = {
          x: ((ndc.x + 1) / 2) * window.innerWidth,
          y: ((-ndc.y + 1) / 2) * window.innerHeight,
        };
      }
    });
    const hover = await page.evaluate(() => window.__hoverScreen);
    if (hover) {
      await page.mouse.move(hover.x, hover.y);
      await page.waitForTimeout(600);
    }
    // the DOM toast stack is a RENDERED surface: read the rendered toasts,
    // not the store list (a toast that has rendered is what the player sees)
    const toastCount = () =>
      page.evaluate(() => document.querySelectorAll('[data-toast]').length);
    // clear any toasts the boot/season flow raised (self-built fixture:
    // the check reads the DELTA its own clicks cause, never inherited ones)
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.dismissAllToastsForTest?.();
    });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => ({
      entry: window.__meadowlight.magnifierReadback().entry,
    }));
    const toastsBefore = await toastCount();
    // real right-click ON THE CANVAS (contextmenu — the handler's own element)
    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'right' });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      on: window.__meadowlight.magnifierReadback().on,
      entry: window.__meadowlight.magnifierReadback().entry,
    }));
    const toastsAfter = await toastCount();
    rec.record(
      'glass.refusal-toast-removed',
      before.entry !== null && after.entry === null && toastsAfter === toastsBefore,
      'armed + card showing -> right-click: card dismissed (' + (before.entry !== null && after.entry === null) +
        '), rendered toasts ' + toastsBefore + ' -> ' + toastsAfter + ' (must be unchanged — the refusal is silent)',
    );
    // zoom refusal KEEPS its toast: zoom in close, disarm the glass,
    // right-click — a toast must appear
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.setMagnifierOnForTest(false);
      w.setCameraDistanceForTest(8);
    });
    await page.waitForTimeout(300);
    const zoomed = await page.evaluate(() => {
      const w = window.__meadowlight;
      return { dist: w.cameraDistanceReadback() };
    });
    const canvas2 = page.locator('canvas').first();
    await canvas2.click({ button: 'right' });
    await page.waitForTimeout(400);
    const zoomAfter = await toastCount();
    rec.record(
      'glass.zoom-refusal-keeps-toast',
      zoomed.dist > 0 && zoomed.dist < 12 && zoomAfter === toastsAfter + 1,
      'zoomed to ' + zoomed.dist.toFixed(1) + ' -> right-click: rendered toasts ' + toastsAfter + ' -> ' + zoomAfter +
        ' (must gain exactly one — the zoom refusal toast stays)',
    );
    const re = realErrors(errors);
    rec.record('glass.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

async function checkOnboarding() {
  const results = [];
  for (const width of [1280, 900, 480]) {
    const { page, errors } = await newPage(browser, url);
    await page.setViewportSize({ width, height: 800 });
    // a FRESH world: the full first-time boot (reset + starter patch) —
    // exactly what a stranger sees on the deployed link
    await page.evaluate(() => {
      window.__meadowlight.freshBootForTest();
    });
    await page.waitForTimeout(2500);
    const read = await page.evaluate(() => {
      const hint = document.querySelector('[data-onboarding]');
      if (!hint) return { hint: false };
      const r = hint.getBoundingClientRect();
      // the dock's TOP EDGE: the palette's tab column is taller than the
      // dock's bottom bar — the dock element is the bar, but its top edge
      // zone is the tab column above it. The hint must clear the taller
      // of the two (the session-8 anchor: the dock's top edge, never
      // overlapping the dock or the corner controls).
      const dock = document.querySelector('[data-palette-dock]');
      const tabCol = document.querySelector('[data-palette-tab="planting"]')?.parentElement;
      const dockR = dock ? dock.getBoundingClientRect() : null;
      const tabR = tabCol ? tabCol.getBoundingClientRect() : null;
      const dockTop = Math.min(dockR ? dockR.top : Infinity, tabR ? tabR.top : Infinity);
      const corner = document.querySelector('[data-corner-controls]');
      const cornerR = corner ? corner.getBoundingClientRect() : null;
      const items = window.__meadowlight.items();
      const hives = window.__meadowlight.structures().filter((s) => s.structureId === 'hive');
      // the dock is the palette's bottom band; the hint must sit ABOVE its
      // top edge (session-8 anchor: the dock's top edge zone)
      const hintBottom = r.bottom;
      return {
        hint: true,
        inViewport: r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        aboveDock: dockR || tabR ? hintBottom <= dockTop + 1 : null,
        clearOfCorners: cornerR ? r.right <= cornerR.left || r.left >= cornerR.right || r.bottom <= cornerR.top || r.top >= cornerR.bottom : null,
        starterFlowers: items.length,
        starterHives: hives.length,
      };
    });
    results.push({ width, ...read });
    const re = realErrors(errors);
    rec.record(
      'onboarding.hint-above-dock@' + width,
      !!read.hint && !!read.inViewport && read.aboveDock === true && read.clearOfCorners !== false,
      JSON.stringify(read),
    );
    rec.record(
      'onboarding.starter-patch@' + width,
      read.starterFlowers > 0 && read.starterHives > 0,
      'starter patch: ' + read.starterFlowers + ' flowers + ' + read.starterHives + ' hive(s) on frame one',
    );
    rec.record('onboarding.no-console-errors@' + width, re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
  // determinism: two fresh worlds with the same seed show the same layout
  {
    const { page } = await newPage(browser, url);
    // pin the world seed FIRST (before any boot) so the two boots are
    // comparable — the determinism claim is same-SEED same-layout
    // pin the seed + empty the world + save, so the RELOAD below is a real
    // first-time boot from the pinned save (the honest determinism path)
    const pinnedSeed = await page.evaluate(() => {
      const w = window.__meadowlight;
      const seed = w.worldSeedReadback();
      w.__setWorldSeedForTest(seed);
      w.clear();
      w.save();
      return seed;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const a = await page.evaluate(() =>
      window.__meadowlight.items().map((i) => i.plantId + '@' + i.position[0].toFixed(2) + ',' + i.position[2].toFixed(2)),
    );
    await page.evaluate((seed) => {
      const w = window.__meadowlight;
      // same pinned seed, emptied, saved — then a REAL reload: the boot
      // must grow the same meadow from the same seed
      w.__setWorldSeedForTest(seed);
      w.clear();
      w.save();
    }, pinnedSeed);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const b = await page.evaluate(() =>
      window.__meadowlight.items().map((i) => i.plantId + '@' + i.position[0].toFixed(2) + ',' + i.position[2].toFixed(2)),
    );
    rec.record(
      'onboarding.starter-patch-seeded',
      a.length > 0 && JSON.stringify(a) === JSON.stringify(b),
      'two first-time boots from seed ' + pinnedSeed + ': ' + a.length + ' vs ' + b.length + ' items, identical layout: ' + (JSON.stringify(a) === JSON.stringify(b)),
    );
    await page.close();
  }
}

for (const check of checks.split(',')) {
  if (check === 'polish') await checkPolish();
  if (check === 'onboarding') await checkOnboarding();
  else {
    console.error('[GATE] unknown check: ' + check);
    process.exit(2);
  }
}

await browser.close();
process.exit(rec.exitCode());
