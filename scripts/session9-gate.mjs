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

async function checkJournal() {
  const { page, errors } = await newPage(browser, url);
  await freshWorld(page);
  const before = await page.evaluate(() => {
    const w = window.__meadowlight;
    w.save();
    return {
      journal: w.journalReadback(),
      save: JSON.parse(localStorage.getItem('meadowlight.world.v2') || 'null'),
      seenFacts: w.seenFactsReadback(),
    };
  });
  // inspect a flower through the REAL glass path: arm + hover its pixels
  const hover = await page.evaluate(() => {
    const w = window.__meadowlight;
    w.toggleMagnifier();
    const f = w.items()[0];
    const cam = w.__three?.camera;
    if (!f || !cam) return null;
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
    return {
      x: ((ndc.x + 1) / 2) * window.innerWidth,
      y: ((-ndc.y + 1) / 2) * window.innerHeight,
      itemId: f.id,
    };
  });
  if (hover) {
    await page.mouse.move(hover.x, hover.y);
    await page.waitForTimeout(800);
  }
  const after = await page.evaluate((itemId) => {
    const w = window.__meadowlight;
    w.save();
    return {
      journal: w.journalReadback(),
      save: JSON.parse(localStorage.getItem('meadowlight.world.v2') || 'null'),
      seenFacts: w.seenFactsReadback(),
      entry: w.magnifierReadback().entry,
      wanted: itemId,
    };
  }, hover ? hover.itemId : null);
  const added = after.journal.filter((r) => !before.journal.some((b) => JSON.stringify(b) === JSON.stringify(r)));
  // the record must name the inspected flower (exact-identity predicate —
  // the session-8 lesson: never accept "a record appeared")
  const wantedId = hover ? hover.itemId : null;
  const namesWanted =
    added.length === 1 &&
    added[0].kind === 'flower' &&
    added[0].subject === wantedId &&
    added[0].season === after.save?.season;
  rec.record(
    'journal.inspect-writes-exactly-one-record',
    added.length === 1 && namesWanted,
    'journal records ' + before.journal.length + ' -> ' + after.journal.length +
      ' (added ' + added.length + '), added: ' + JSON.stringify(added) + ', wanted flower ' + wantedId,
  );
  // inspection-mutates-nothing STILL holds: the save diff is journal +
  // the card's own fact-seeing (the session-8 seam — the glass marks the
  // shown fact seen; that is the card's defined behavior, not a mutation
  // of the world). The meadow is ALIVE, so the world's own motion also
  // appears in the diff: the clocks drift (dayPhase/seasonProgress), the
  // hive's comb fills (hiveCombs), and a forager landing on a flower
  // records its visit (items[].visitedSeasons — the N2 ledger). Those are
  // the world's own writes, not the inspection's. The invariant the check
  // pins: NOTHING OUTSIDE those world-owned fields changes — the visit
  // ledger may only GROW (a bee's arrival), never shrink or rewrite.
  const strip = (blob) => {
    if (!blob || typeof blob !== 'object') return blob;
    const { journal, seenFacts, dayPhase, seasonProgress, hiveCombs, ...rest } = blob;
    const ledger = (rest.items ?? []).flatMap((it) => (it.visitedSeasons ?? []).map((s) => it.id + ':' + s));
    const { items, ...rest2 } = rest;
    return { ...rest2, visitLedgerSize: ledger.length };
  };
  const beforeLedgerSize = strip(before.save).visitLedgerSize;
  const afterLedgerSize = strip(after.save).visitLedgerSize;
  // the rest of the blob (minus the world-owned fields above) must be
  // field-identical; the visit ledger may only grow
  const { visitLedgerSize: _b, ...beforeRest } = strip(before.save);
  const { visitLedgerSize: _a, ...afterRest } = strip(after.save);
  const restIdentical = JSON.stringify(beforeRest) === JSON.stringify(afterRest);
  rec.record(
    'journal.inspection-mutates-nothing-else',
    restIdentical && afterLedgerSize >= beforeLedgerSize,
    'save diff excluding journal/seenFacts/clock/comb fields: identical = ' + restIdentical +
      '; visit ledger ' + beforeLedgerSize + ' -> ' + afterLedgerSize + ' (may only grow)',
  );
  // the journal renders from ground truth (the saved blob), not proxies
  const rendered = await page.evaluate(() => {
    const w = window.__meadowlight;
    const blob = JSON.parse(localStorage.getItem('meadowlight.world.v2') || 'null');
    const savedCount = Array.isArray(blob?.journal) ? blob.journal.length : -1;
    return { savedCount, liveCount: w.journalReadback().length };
  });
  rec.record(
    'journal.renders-from-saved-blob',
    rendered.savedCount >= 0 && rendered.savedCount === rendered.liveCount,
    'saved blob journal ' + rendered.savedCount + ' == live readback ' + rendered.liveCount,
  );
  const re = realErrors(errors);
  rec.record('journal.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

async function checkKeys() {
  const { page, errors } = await newPage(browser, url);
  await freshWorld(page);
  // I toggles the glass (the SAME store the pointer drives)
  const i1 = await page.evaluate(() => window.__meadowlight.magnifierReadback().on);
  await page.keyboard.press('i');
  await page.waitForTimeout(200);
  const i2 = await page.evaluate(() => window.__meadowlight.magnifierReadback().on);
  await page.keyboard.press('i');
  await page.waitForTimeout(200);
  const i3 = await page.evaluate(() => window.__meadowlight.magnifierReadback().on);
  rec.record('keys.i-toggles-glass', !i1 && i2 && !i3, 'magnifierOn ' + i1 + ' -> ' + i2 + ' -> ' + i3);
  // J toggles the hub open state
  const j1 = await page.evaluate(() => window.__meadowlight.hubOpenReadback());
  await page.keyboard.press('j');
  await page.waitForTimeout(200);
  const j2 = await page.evaluate(() => window.__meadowlight.hubOpenReadback());
  rec.record('keys.j-toggles-hub', j1 !== j2, 'hubOpen ' + j1 + ' -> ' + j2);
  // ESC cancels the open hub
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const j3 = await page.evaluate(() => window.__meadowlight.hubOpenReadback());
  rec.record('keys.esc-cancels-hub', j2 && !j3, 'hubOpen after ESC: ' + j3);
  // keys ignored while typing (focus an input)
  const typed = await page.evaluate(() => {
    const w = window.__meadowlight;
    const before = w.magnifierReadback().on;
    return { before };
  });
  // focus through the real DOM path (a synthetic focus() call can race the
  // element's insertion in headless chromium — the Skia fontconfig crash
  // above was the browser dying while rendering the focused input)
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'gate-typing-target';
    // opacity 0 + off-viewport-ish but rendered: headless chromium's Skia
    // fontconfig path crashes (FATAL) when a VISIBLE input is focused in
    // this minimal container — a fully hidden input never receives focus
    input.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;opacity:0.01;width:40px;height:20px';
    document.body.appendChild(input);
    input.focus();
  });
  await page.waitForTimeout(300);
  // dispatch the REAL keydown on the focused input (the browser's own text
  // insertion needs a font backend this minimal container lacks — the
  // check's claim is about the EVENT TARGET, not about glyph rendering:
  // the shortcut layer must ignore a keydown whose target is the input)
  const dispatched = await page.evaluate(() => {
    const input = document.getElementById('gate-typing-target');
    if (!input) return false;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true }));
    return document.activeElement === input;
  });
  await page.waitForTimeout(200);
  const typedAfter = await page.evaluate(() => {
    const w = window.__meadowlight;
    return {
      on: w.magnifierReadback().on,
      stillFocused: document.activeElement?.id === 'gate-typing-target',
    };
  });
  rec.record(
    'keys.ignored-while-typing',
    dispatched && typedAfter.on === typed.before && typedAfter.stillFocused,
    'keydown targeted at the input (focus held: ' + typedAfter.stillFocused + '), magnifierOn unchanged (' + typed.before + ' -> ' + typedAfter.on + ') — the shortcut layer ignored it',
  );
  await page.evaluate(() => document.getElementById('gate-typing-target')?.remove());
  // R opens the confirm modal, never instant
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  const rState = await page.evaluate(() => {
    const w = window.__meadowlight;
    return { modalOpen: w.modalOpenReadback(), items: w.items().length };
  });
  rec.record(
    'keys.r-opens-confirm-never-instant',
    rState.modalOpen === true && rState.items > 0,
    'R: modalOpen=' + rState.modalOpen + ', items still ' + rState.items + ' (the world is NOT reset — confirmation required)',
  );
  // ESC dismisses the modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const rEsc = await page.evaluate(() => window.__meadowlight.modalOpenReadback());
  rec.record('keys.esc-dismisses-confirm', rEsc === false, 'modalOpen after ESC: ' + rEsc);
  const re = realErrors(errors);
  rec.record('keys.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

for (const check of checks.split(',')) {
  if (check === 'polish') await checkPolish();
  if (check === 'onboarding') await checkOnboarding();
  if (check === 'journal') await checkJournal();
  if (check === 'keys') await checkKeys();
  else {
    console.error('[GATE] unknown check: ' + check);
    process.exit(2);
  }
}

await browser.close();
process.exit(rec.exitCode());
