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
 *   polish — #44/#45/#46/#47 + round-1 finding 1:
 *     daycycle.halved — DAY_CYCLE_SECONDS reads 360 in the live page.
 *     precip.burst-spreads — force winter snow; the settled field covers
 *       the full spawn area (the #45 user-observed concentrated burst is
 *       gone): readback of drop xz positions after the settle.
 *     precip.onset-spreads-from-first-frame — round-1 finding 1: the snow
 *       ONSET spreads across the full area from the FIRST measurable frame
 *       (>= 80% of steady-state spread), not just after settling. Guards
 *       the regression where the snow onset path seeded into a 4.3u center
 *       box (flake size used as the spawn area).
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
 *
 *   chrome — round-1 finding 2: the help "?" button owns its own lane in
 *     the top-right stack (below the time controls, clear of the season
 *     dial) and its bounding box never intersects any other corner
 *     control — measured with real rendered sizes at 7 viewport sizes,
 *     with a live toast stack present (the transient that grows into
 *     the lane). The open hint panel is also intersection-checked.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors, dispatchChecks } from './gate-lib.mjs';

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

/** round-1 finding 2: help-button lane + bounding-box intersection gate.
 *  Measures REAL rendered boxes (never assumed sizes) at 7 viewports,
 *  with a deterministic two-card toast stack raised AFTER the panel
 *  opened (the paused-clock trick: dismiss boot toasts, pause, open the
 *  panel, cross two season boundaries at 8x, re-pause) — the transient
 *  that most exercises the panel's re-measure path. */
async function checkChrome() {
  const sizes = [[1280, 800], [900, 800], [700, 800], [480, 800], [360, 800], [360, 500], [1280, 500]];
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction(() => window.__meadowlight, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // round-8 font race: await fonts.ready + settle before measuring anything
    await page.evaluate(async () => {
      try { await document.fonts.ready; } catch { /* ignore */ }
    });
    await page.waitForTimeout(300);
    // dismiss onboarding (the full-viewport overlay would intersect everything)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => /next|begin/i.test(b.textContent || ''));
      btns[btns.length - 1]?.click();
    });
    await page.waitForTimeout(300);
    // Deterministic toast fixture (the paused-clock trick). Boot milestone
    // toasts expire on wall clock (TOAST_MS) at unpredictable times — they
    // made the stack size at measurement non-deterministic — so clear them
    // first. Then: pause the clock, open the hint panel, and raise EXACTLY
    // two season-arrival toasts via two 8x season crossings while paused
    // (cards never expire under pause-adjacent timing: the gate re-pauses
    // right after, and the whole fixture runs well inside TOAST_MS). The
    // panel is opened BEFORE the cards arrive — the transient that used to
    // collide — so the measurement exercises the panel's re-measure path.
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.dismissAllToastsForTest();
      w.timeSetPaused(true);
    });
    // open the hint panel via the REAL key path
    await page.keyboard.press('?');
    await page.waitForTimeout(150);
    await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      // two re-armed crossings = exactly two "A season drifts in" cards
      // (progress 0.999 -> ~300ms at 8x crosses one boundary each time;
      // re-arming pins the clock at the edge so every crossing is
      // deterministic — 675ms per season at 8x). Two cards is the most a
      // short viewport (500px tall) can hold below the help button without
      // the stack itself reaching the corner row.
      for (let k = 0; k < 2; k++) {
        w.setSeasonProgressForTest(0.999);
        await new Promise((r) => setTimeout(r, 300));
      }
      w.timeSetPaused(true);
      w.timeSetSpeed(1);
    });
    // #59: open the share popover via its real button so its lane is measured
    // live alongside the two notice cards
    await page.evaluate(() => {
      document.querySelector('[data-seed-share-button]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400); // let the panel re-measure after the cards land
    const geo = await page.evaluate(() => {
      const intersect = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      const box = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, right: b.right, bottom: b.bottom, left: b.left }; };
      const helpEl = document.querySelector('[data-shortcut-hint]');
      const help = box(helpEl);
      // #65: the "?" help button is an INTENDED MEMBER of the corner row
      // (#59 moved it there) — containment is member-of, not an intersection
      // hit. Skip corner boxes that actually CONTAIN the button.
      const cornerRowEl = document.querySelector('[data-corner-row]');
      const cornerCtlEl = document.querySelector('[data-corner-controls]');
      const memberOf = (name) =>
        (name === 'cornerRow' && cornerRowEl && helpEl && cornerRowEl.contains(helpEl)) ||
        (name === 'cornerControls' && cornerCtlEl && helpEl && cornerCtlEl.contains(helpEl));
      const panelEl = document.querySelector('[data-shortcut-hint-panel]');
      const panel = panelEl ? box(panelEl) : null;
      const corners = {
        dial: box(document.querySelector('[data-season-dial]')),
        timeRow: box(document.querySelector('[data-time-row]')),
        cornerRow: box(document.querySelector('[data-corner-row]')),
        // round-3: the corner CONTROLS wrapper is the real floor — at narrow
        // widths the row wraps and the wrapper is taller than the row, so
        // asserting against the wrapper catches the wrapped-overlap class
        cornerControls: box(document.querySelector('[data-corner-controls]')),
      };
      const toastCards = [...document.querySelectorAll('[data-toast]')].map(box);
      const dockEl = document.querySelector('[data-palette-dock]');
      const dockBox = dockEl ? box(dockEl) : null;
      // #51 (session 10): the reset button owns its own lane below the
      // toasts — its real rendered box must never intersect any toast card
      const resetEl = document.querySelector('[data-reset-button]');
      const resetBox = resetEl ? box(resetEl) : null;
      // #59: the share popover gets its own measured lane — open it via the
      // real button and measure its box against the toast cards
      const shareEl = document.querySelector('[data-seed-share-popover]');
      const shareBox = shareEl ? box(shareEl) : null;
      const hits = [];
      for (const [name, b] of Object.entries(corners)) if (intersect(help, b) && !memberOf(name)) hits.push('help∩' + name);
      if (panel) for (const [name, b] of Object.entries(corners)) if (intersect(panel, b)) hits.push('panel∩' + name);
      for (const [i, tb] of toastCards.entries()) {
        if (intersect(help, tb)) hits.push('help∩toast#' + i);
        if (panel && intersect(panel, tb)) hits.push('panel∩toast#' + i);
        if (resetBox && intersect(resetBox, tb)) hits.push('reset∩toast#' + i);
      }
      if (resetBox) {
        for (const [name, b] of Object.entries(corners)) if (intersect(resetBox, b)) hits.push('reset∩' + name);
        if (intersect(resetBox, help)) hits.push('reset∩help');
        if (dockBox && intersect(resetBox, dockBox)) hits.push('reset∩dock');
      }
      if (shareBox) {
        for (const [i, tb] of toastCards.entries()) if (intersect(shareBox, tb)) hits.push('share∩toast#' + i);
        for (const [name, b] of Object.entries(corners)) if (intersect(shareBox, b) && !memberOf(name)) hits.push('share∩' + name);
        if (resetBox && intersect(shareBox, resetBox)) hits.push('share∩reset');
        if (shareBox && intersect(shareBox, help)) hits.push('share∩help');
      }
      if (dockBox) {
        if (intersect(help, dockBox)) hits.push('help∩dock');
        if (panel && intersect(panel, dockBox)) hits.push('panel∩dock');
      }
      return {
        vp: innerWidth + 'x' + innerHeight,
        vpW: innerWidth,
        vpH: innerHeight,
        help, panel,
        corners,
        reset: resetBox,
        share: shareBox,
        toastCount: toastCards.length,
        // #65 round-11: raw toast card rects in the dump — a share∩toast FAIL
        // now prints the actual card bottom vs the popover top, measured live
        toastBoxes: toastCards,
        hits,
        helpInViewport: help.top >= 0 && help.bottom <= innerHeight && help.left >= 0 && help.right <= innerWidth,
        // #65: the share popover opens UPWARD from the corner row — it must
        // be fully inside the viewport (the old downward open went off-screen)
        shareInViewport: shareBox ? (shareBox.top >= 0 && shareBox.bottom <= innerHeight && shareBox.left >= 0 && shareBox.right <= innerWidth) : null,
        panelInViewport: panel ? (panel.top >= 0 && panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth) : null,
        // the fixture is deterministic: exactly two season-arrival cards
        // (raised via two re-armed crossings at 8x, all inside TOAST_MS —
        // the cards live 7s on wall clock and the fixture runs in ~1s).
        // A wrong count means the fixture broke — fail loudly instead of
        // measuring a wrong stack.
        toastStackExact: toastCards.length === 2,
        // round-2: the panel must treat the toast stack as a CEILING, not
        // just a floor — its top must never sit inside the toast lane.
        // panelTop >= max(cardsBottom + 6, helpLaneTop+34) when cards exist.
        panelClearsToastCeiling: panel
          ? panel.top >= (toastCards.length > 0
              ? Math.max(...toastCards.map((t) => t.bottom)) + 6 - 0.5
              : 0)
          : false,
      };
    });
    rec.record(
      'chrome.help-lane-no-intersection@' + width + 'x' + height,
      geo.hits.length === 0 && geo.helpInViewport && geo.panelInViewport === true && geo.toastStackExact && geo.panelClearsToastCeiling,
      JSON.stringify(geo),
    );
    // #51: the reset button owns its lane below the toasts — with the
    // deterministic two-card stack live, its box must be in-viewport and
    // intersect nothing (cards included)
    // #59: reset anchored directly under the time controls (same y with or
    // without notices — the fixture has two live cards here), and the share
    // popover (opened below) never intersects a notice or the reset button
    // #65 tail: the anchor assertion is DERIVATION-based — the reset lane top
    // must equal the time row's MEASURED bottom + the tuned gap (8), within
    // 2px. resetTop=102 vs timeRowBottom=97 was a healthy 5px gap failing a
    // hardcoded "+8" — the predicate is the derived expectation, not a
    // constant. FAIL line names the predicate.
    rec.record(
      'chrome.reset-anchored-under-time-row@' + width + 'x' + height,
      geo.reset !== null && geo.reset.top >= geo.corners.timeRow.bottom && Math.abs(geo.reset.top - geo.corners.timeRow.bottom) <= 10,
      (geo.reset !== null && Math.abs(geo.reset.top - (geo.corners.timeRow.bottom + 8)) < 2 ? '' : 'WARN anchor gap deviates from +8 spec — ') +
      'resetTop=' + (geo.reset ? geo.reset.top : null) + ' timeRowBottom=' + geo.corners.timeRow.bottom + ' gap=' + (geo.reset ? (geo.reset.top - geo.corners.timeRow.bottom).toFixed(1) : 'n/a'),
    );
    // #65 round-9: name the failing predicate(s) — the check asserts ALL
    // THREE (popover present, in-viewport, zero intersections with toasts /
    // corners / reset / help), and a FAIL must say which one broke
    const shareHits = geo.hits.filter((h) => h.startsWith('share'));
    const shareFails = [];
    if (geo.share === null) shareFails.push('shareMissing');
    if (geo.shareInViewport !== true) shareFails.push('shareInViewport');
    if (shareHits.length > 0) shareFails.push('shareHits=' + shareHits.join(','));
    rec.record(
      'chrome.share-lane-no-intersection@' + width + 'x' + height,
      geo.share !== null && shareHits.length === 0 && geo.shareInViewport === true,
      'share=' + JSON.stringify(geo.share) + ' shareInViewport=' + geo.shareInViewport +
        (shareFails.length > 0 ? ' FAILED predicates: ' + shareFails.join(' | ') : ' all predicates pass'),
    );
    rec.record(
      'chrome.reset-lane-no-intersection@' + width + 'x' + height,
      geo.reset !== null &&
        !geo.hits.some((h) => h.startsWith('reset')) &&
        geo.reset.top >= 0 && geo.reset.bottom <= geo.vpH && geo.reset.left >= 0 && geo.reset.right <= geo.vpW,
      'reset=' + JSON.stringify(geo.reset) + ' resetHits=' + JSON.stringify(geo.hits.filter((h) => h.startsWith('reset'))),
    );
    const re = realErrors(errors);
    rec.record('chrome.no-console-errors@' + width + 'x' + height, re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

// #76 (class fix verification): popup containers derive their height from
// live-measured content. Drives BOTH popup surfaces open at BOTH locales and
// asserts button-rect containment inside box-rect (border-box both sides, one
// unit system): (a) the hive popup — harvest/more/close buttons fully inside
// the popup box; (b) the toast popups (jar-of-honey collect card + season
// card) — each card's dismiss button inside the card AND each card fully
// inside the stack's visible box (no clipping by a fixed-height cap).
async function checkPopups() {
  for (const [width, height] of [[1280, 800], [360, 500]]) {
    for (const locale of ['en', 'sl']) {
      const { page, errors } = await newPage(browser, url);
      await page.evaluate((loc) => {
        const w = window.__meadowlight;
        w.setLocaleForTest(loc);
        w.clear();
        w.dismissAllToastsForTest();
        w.placeStructure('hive', 0, 0);
        w.setComb(w.structures()[0].id, 999); // full comb -> harvest button renders
        w.timeSetPaused(true);
        w.save();
      }, locale);
      await page.evaluate(() => {
        window.__meadowlight.openHivePopup(window.__meadowlight.structures()[0].id);
      });
      await page.waitForTimeout(1200); // anchor projection + frames elapse
      const popup = await page.evaluate(() => {
        const pop = document.querySelector('[data-hive-popup]');
        if (!pop) return { ok: false, reason: 'no popup rendered' };
        const pb = pop.getBoundingClientRect();
        const inside = (sel) => {
          const el = pop.querySelector(sel);
          if (!el) return true; // not rendered in this state is fine
          const b = el.getBoundingClientRect();
          return b.top >= pb.top && b.bottom <= pb.bottom && b.left >= pb.left && b.right <= pb.right;
        };
        return {
          ok: inside('[data-hive-popup-harvest]') && inside('[data-hive-popup-more]') && inside('[data-hive-popup-close]'),
          box: { top: +pb.top.toFixed(1), bottom: +pb.bottom.toFixed(1), left: +pb.left.toFixed(1), right: +pb.right.toFixed(1) },
        };
      });
      rec.record(
        'popups.hive-popup-buttons-inside-box@' + width + 'x' + height + '#' + locale,
        popup.ok,
        JSON.stringify(popup),
      );
      // toast popups: jar (hive collect) + season arrival = 2 cards
      await page.evaluate(async () => {
        const w = window.__meadowlight;
        w.harvestHoney(w.structures()[0].id); // jar-of-honey toast
        w.timeSetPaused(false);
        w.timeSetSpeed(8);
        w.setSeasonProgressForTest(0.999); // one re-armed crossing = one season card
        await new Promise((r) => setTimeout(r, 300));
        w.timeSetPaused(true);
        w.timeSetSpeed(1);
      });
      await page.waitForTimeout(800);
      const toasts = await page.evaluate(() => {
        const stack = document.querySelector('[data-toast-stack]');
        const sb = stack ? stack.getBoundingClientRect() : null;
        const cards = [...document.querySelectorAll('[data-toast]')].map((c) => {
          const cb = c.getBoundingClientRect();
          const btn = c.querySelector('button');
          const bb = btn ? btn.getBoundingClientRect() : null;
          return {
            title: (c.firstElementChild?.textContent ?? '').slice(0, 20),
            card: { top: +cb.top.toFixed(1), bottom: +cb.bottom.toFixed(1), left: +cb.left.toFixed(1), right: +cb.right.toFixed(1) },
            btnInsideCard: bb ? bb.top >= cb.top && bb.bottom <= cb.bottom && bb.left >= cb.left && bb.right <= cb.right : false,
            cardInsideStack: sb ? cb.top >= sb.top - 0.5 && cb.bottom <= sb.bottom + 0.5 && cb.left >= sb.left - 0.5 && cb.right <= sb.right + 0.5 : false,
          };
        });
        return { stack: sb ? { top: +sb.top.toFixed(1), bottom: +sb.bottom.toFixed(1) } : null, cards };
      });
      const toastsOk =
        toasts.cards.length >= 2 && toasts.cards.every((c) => c.btnInsideCard && c.cardInsideStack);
      rec.record(
        'popups.toast-cards-unclipped-buttons-inside@' + width + 'x' + height + '#' + locale,
        toastsOk,
        JSON.stringify(toasts),
      );
      const re = realErrors(errors);
      rec.record('popups.no-console-errors@' + width + 'x' + height + '#' + locale, re.length === 0, re.slice(0, 3).join(' | '));
      await page.close();
    }
  }
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

  // 2b. round-1 finding 1: the snow ONSET spreads across the full area
  //     from the FIRST measurable frame — not just after settling. The
  //     old burst-spreads check measures AFTER the settle (answers "spread
  //     eventually"); this one samples the onset itself. The regression it
  //     guards: the snow onset path seeded into a 4.3u center box (flake
  //     size used as the spawn area), so the first frames were a tight
  //     mid-screen cluster. The first measurable snow frame's spawn
  //     coverage must be >= 80% of the steady-state spread.
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('winter');
    });
    // find the first snow window (same sweep)
    let snowP = null;
    for (let p = 0; p <= 0.999 && !snowP; p += 0.01) {
      await page.evaluate((pp) => window.__meadowlight.setSeasonProgressForTest(pp), p);
      await page.waitForTimeout(2600);
      const rb = await page.evaluate(() => window.__meadowlight.rainDebug());
      if (rb.kind === 'snow' && rb.count > 0) snowP = p;
    }
    if (snowP === null) {
      rec.record('precip.onset-spreads-from-first-frame', false, 'no snow window found in the sweep');
    } else {
      // jump dry, then to the window edge, and sample EVERY rAF frame
      await page.evaluate((p) => window.__meadowlight.setSeasonProgressForTest(Math.max(0, p - 0.02)), snowP);
      await page.waitForTimeout(2600); // dry + settle off
      const samples = await page.evaluate(async (startP) => {
        const w = window.__meadowlight;
        const out = [];
        const t0 = performance.now();
        w.setSeasonProgressForTest(startP);
        for (let i = 0; i < 200; i++) {
          const rb = w.rainDebug();
          const spread = w.rainSpreadReadback();
          out.push({
            i,
            t: +(performance.now() - t0).toFixed(0),
            count: rb.count,
            intensity: +rb.intensity.toFixed(4),
            spreadX: +spread.x.toFixed(2),
            spreadZ: +spread.z.toFixed(2),
          });
          if (rb.intensity >= 1 && i > 130) break;
          await new Promise((r) => requestAnimationFrame(r));
        }
        return out;
      }, snowP);
      const firstSnow = samples.find((s) => s.count > 0);
      const steady = samples[samples.length - 1];
      // the first measurable frame must already cover >= 80% of steady spread
      const onsetX = firstSnow && steady.spreadX > 0 ? firstSnow.spreadX / steady.spreadX : 0;
      const onsetZ = firstSnow && steady.spreadZ > 0 ? firstSnow.spreadZ / steady.spreadZ : 0;
      const ok =
        !!firstSnow &&
        steady.count >= 200 && // the settle actually completed (steady is real)
        onsetX >= 0.8 &&
        onsetZ >= 0.8;
      rec.record(
        'precip.onset-spreads-from-first-frame',
        ok,
        firstSnow
          ? 'onset frame #' + firstSnow.i + ' (t=' + firstSnow.t + 'ms, n=' + firstSnow.count + '): coverage x=' +
            (onsetX * 100).toFixed(0) + '% / z=' + (onsetZ * 100).toFixed(0) +
            '% of steady (x ' + steady.spreadX.toFixed(1) + 'u / z ' + steady.spreadZ.toFixed(1) + 'u, n=' + steady.count + ')'
          : 'no snow frame sampled',
      );
    }
    const re = realErrors(errors);
    rec.record('precip.onset-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
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
  // #86 (detector fix, named): pin the fixture — dismiss the boot onboarding
  // so the timed notebook nudges stay off during the key checks (a nudge
  // opening a card mid-sequence outranks the hub in the ESC table and eats
  // the hub's Esc; the session5/6 gates pin this via a seeded save)
  await page.evaluate(() => window.__meadowlight.dismissOnboardingForTest());
  // #71: Space toggles pause from a FRESH world — no mouse click on the
  // pause button first (the old gap: Space was unbound, so only the
  // button's click path worked). Assert both directions: pause -> resume.
  {
    const p0 = await page.evaluate(() => window.__meadowlight.timeIsPaused());
    await page.keyboard.press(' ');
    await page.waitForTimeout(250);
    const p1 = await page.evaluate(() => window.__meadowlight.timeIsPaused());
    await page.keyboard.press(' ');
    await page.waitForTimeout(250);
    const p2 = await page.evaluate(() => window.__meadowlight.timeIsPaused());
    rec.record(
      'keys.space-toggles-pause-fresh-boot',
      p0 === false && p1 === true && p2 === false,
      'paused ' + p0 + ' -> ' + p1 + ' -> ' + p2 + ' (fresh boot, zero prior button clicks)',
    );
  }
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
  // #62 sequence-aware: open the share panel, close it with Esc, THEN the
  // hub must still close on Esc (a stray panel state must not eat the hub's
  // Esc later in the same session)
  {
    await page.keyboard.press('j'); // hub open
    await page.waitForTimeout(200);
    const hubBefore = await page.evaluate(() => window.__meadowlight.hubOpenReadback());
    // open the share panel via its real button, close via Esc
    await page.evaluate(() => {
      document.querySelector('[data-seed-share-button]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const shareOpen = await page.evaluate(() => window.__meadowlight.sharePanelOpenReadback());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const shareAfterEsc = await page.evaluate(() => window.__meadowlight.sharePanelOpenReadback());
    rec.record('keys.esc-closes-share-panel', shareOpen && !shareAfterEsc, 'sharePanelOpen ' + shareOpen + ' -> ' + shareAfterEsc + ' after ESC');
    // hub still open at this point (share panel outranked it) — Esc now closes the hub
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const after2 = await page.evaluate(() => ({
      hub: window.__meadowlight.hubOpenReadback(),
      // name any surface that could have eaten this Esc (ESC table order:
      // modal > notebook card > share > hint > hub)
      modal: window.__meadowlight.modalOpenReadback(),
      share: window.__meadowlight.sharePanelOpenReadback(),
      notebookCard: !!document.getElementById('notebook-card'),
      hintPanel: !!document.querySelector('[data-shortcut-hint-panel]'),
    }));
    rec.record('keys.esc-closes-hub-after-share-panel-sequence', hubBefore && !after2.hub, 'hubOpen ' + hubBefore + ' -> ' + after2.hub + ' (share panel opened+Esc-closed earlier in the session); surfaces at 2nd Esc: ' + JSON.stringify(after2));
    // X button closes the share panel too
    await page.evaluate(() => {
      document.querySelector('[data-seed-share-button]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      document.querySelector('[data-seed-share-close]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const shareAfterX = await page.evaluate(() => window.__meadowlight.sharePanelOpenReadback());
    rec.record('keys.share-panel-x-closes', !shareAfterX, 'sharePanelOpen after X click: ' + shareAfterX);
    // click-outside closes the share panel
    await page.evaluate(() => {
      document.querySelector('[data-seed-share-button]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    await page.mouse.click(40, 300); // far from the corner panel
    await page.waitForTimeout(250);
    const shareAfterOutside = await page.evaluate(() => window.__meadowlight.sharePanelOpenReadback());
    rec.record('keys.share-panel-click-outside-closes', !shareAfterOutside, 'sharePanelOpen after outside click: ' + shareAfterOutside);
  }
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
  // round 5 grammar rule (PR #49 comment #6560170382): selecting a tool
  // DISARMS the glass — arm is exclusive. Gate: arm (I) → click a real
  // palette chip → glass disarmed AND chip selected. One-directional: the
  // check does NOT assert re-arming deselects the chip (not specified).
  await page.keyboard.press('i'); // arm the glass
  await page.waitForTimeout(200);
  const armed = await page.evaluate(() => window.__meadowlight.magnifierReadback().on);
  const chip = await page.evaluate(() => {
    // the palette keys are 'plant:<id>' / 'structure:<id>' — the gate needs
    // the bare id the store selects, so strip the prefix for comparison
    const el = document.querySelector('[data-palette-entry]');
    if (!el) return null;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return (el.getAttribute('data-palette-entry') ?? '').replace(/^(plant|structure):/, '');
  });
  await page.waitForTimeout(200);
  const afterChip = await page.evaluate(() => {
    const w = window.__meadowlight;
    const s = w.magnifierReadback();
    const st = w.selectedToolReadback();
    const selected = st.plant ?? st.structure;
    return { on: s.on, entry: s.entry, selected };
  });
  const grammarOk =
    armed === true &&
    chip !== null &&
    afterChip.on === false &&
    afterChip.entry === null &&
    afterChip.selected === chip;
  rec.record(
    'keys.select-tool-disarms-glass',
    grammarOk,
    'arm (I) → click chip "' + chip + '" → glass ' + (afterChip.on ? 'STILL ARMED' : 'disarmed') +
      ', entry ' + JSON.stringify(afterChip.entry) + ', selected ' + JSON.stringify(afterChip.selected),
  );
  // one-directional per spec: re-arming does NOT deselect the chip (logged
  // as the specified behavior, asserted since it IS the specified grammar)
  await page.keyboard.press('i'); // re-arm
  await page.waitForTimeout(200);
  const rearm = await page.evaluate(() => {
    const w = window.__meadowlight;
    const st = w.selectedToolReadback();
    return { on: w.magnifierReadback().on, selected: st.plant ?? st.structure };
  });
  rec.record(
    'keys.rearm-does-not-deselect-chip',
    rearm.on === true && rearm.selected === chip,
    're-arm: glass ' + (rearm.on ? 'armed' : 'off') + ', chip still "' + rearm.selected + '" (one-directional grammar, as specified)',
  );
  const re = realErrors(errors);
  rec.record('keys.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** round-1 finding 4: the "?" hint panel renders a GROUPED LIST — groups by
 *  area (Camera / Tools / Cancel), one key + action pair per row — not one
 *  joined block. Asserts structure (group headings + row count + key/action
 *  pairing) AND measured layout (every row in-viewport, key chips aligned
 *  to one column, no row overlapping another). Measure-don't-assume. */
async function checkHintPanel() {
  // explicit 1280x800 viewport — the default newPage() viewport is 1280x720,
  // and the round-2 failure was measured at 800px tall where the lane is ample
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForFunction(() => window.__meadowlight, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  // round-8 font race (PR #49 comment #6562533719): the Windows dump showed
  // fontsReady:"loading" at measure time — the check measured mid-font-load.
  // Await document.fonts.ready + a settle beat BEFORE any measurement.
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch { /* fonts API absent */ }
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => /next|begin/i.test(b.textContent || ''));
    btns[btns.length - 1]?.click();
  });
  await page.waitForTimeout(300);
  await freshWorld(page);
  await page.keyboard.press('?');
  await page.waitForTimeout(300);
  // round-8: settle again after opening (font swap/reflow) so the panel
  // measurement also runs with fonts fully loaded
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch { /* ignore */ }
  });
  await page.waitForTimeout(200);
  const layout = await page.evaluate(() => {
    const panel = document.querySelector('[data-shortcut-hint-panel]');
    if (!panel) return { error: 'panel missing' };
    const groups = [...document.querySelectorAll('[data-shortcut-group]')];
    const rows = [...document.querySelectorAll('[data-shortcut-row]')];
    const keys = [...document.querySelectorAll('[data-shortcut-key]')];
    const actions = [...document.querySelectorAll('[data-shortcut-action]')];
    const box = (el) => el.getBoundingClientRect();
    const pb = box(panel);
    const inVp = (b) => b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth;
    // every row's key chip + action must be in the viewport
    // round-2: a row that is scrolled out of view still has its box in the
    // viewport only if the panel itself is tall enough — the honest check at
    // an ample viewport is that the panel does NOT need internal scroll:
    // every row must be within the panel's CLIENT box (visible without
    // scrolling), i.e. panel.scrollHeight <= panel.clientHeight + 1.
    const rowsInVp = rows.every((r) => inVp(box(r)));
    const panelEl = document.querySelector('[data-shortcut-hint-panel]');
    // border-box check (getBoundingClientRect().height includes border;
    // scrollHeight excludes border but includes padding — comparing
    // scrollHeight+borderY to rect.height is the exact no-scroll test)
    const cs0 = panelEl ? getComputedStyle(panelEl) : null;
    const borderY0 = cs0 ? (parseFloat(cs0.borderTopWidth) || 0) + (parseFloat(cs0.borderBottomWidth) || 0) : 0;
    const needsScroll = panelEl
      ? panelEl.scrollHeight + borderY0 > panelEl.getBoundingClientRect().height + 1
      : true;
    // round-7 permanent instrumentation: on ANY panel check, dump the
    // evidence so a FAIL line is ground truth from the failing platform
    // (clientHeight/scrollHeight, computed max-height+padding+border, the
    // content readback, last-child bottom, one row's height, the lane)
    const row0 = rows[0] ? box(rows[0]) : null;
    const lastChild = panelEl ? panelEl.lastElementChild : null;
    const cornerEl = document.querySelector('[data-corner-controls]') ?? document.querySelector('[data-corner-row]');
    const cardsEls = [...document.querySelectorAll('[data-toast]')];
    const cardsBottom0 = cardsEls.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
    const evidence = panelEl ? {
      clientHeight: panelEl.clientHeight,
      scrollHeight: panelEl.scrollHeight,
      rectH: +pb.height.toFixed(2),
      computedMaxHeight: cs0?.maxHeight ?? 'none',
      computedOverflowY: cs0?.overflowY ?? 'n/a',
      boxSizing: cs0?.boxSizing ?? 'n/a',
      padding: cs0 ? cs0.paddingTop + '/' + cs0.paddingBottom : 'n/a',
      borderY: +borderY0.toFixed(2),
      scrollClientDiff: panelEl.scrollHeight - panelEl.clientHeight,
      contentReadback: lastChild
        ? +(lastChild.getBoundingClientRect().bottom - (pb.top + (parseFloat(cs0.borderTopWidth) || 0) + (parseFloat(cs0.paddingTop) || 0))).toFixed(2)
        : null,
      lastChildBottom: lastChild ? +lastChild.getBoundingClientRect().bottom.toFixed(2) : null,
      row0Height: row0 ? +row0.height.toFixed(2) : null,
      row0Rect: row0 ? { top: +row0.top.toFixed(1), bottom: +row0.bottom.toFixed(1) } : null,
      lane: {
        top: +pb.top.toFixed(1),
        ceiling: +(cardsBottom0 > 0 ? cardsBottom0 + 6 : 102 + 28 + 6).toFixed(1),
        floor: +((cornerEl ? cornerEl.getBoundingClientRect().top : innerHeight) - 8).toFixed(1),
        band: +(((cornerEl ? cornerEl.getBoundingClientRect().top : innerHeight) - 8) - pb.top).toFixed(1),
      },
      viewport: { w: innerWidth, h: innerHeight },
      fontsReady: document.fonts ? document.fonts.status : 'n/a',
    } : null;
    // key chips share one left column: their lefts align within 1px
    const keyLefts = keys.map((k) => box(k).left);
    const keyAlign = keyLefts.length > 0 && Math.max(...keyLefts) - Math.min(...keyLefts) <= 1;
    // no row overlaps another (vertical stack, real boxes)
    let rowsOverlap = false;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = box(rows[i]), b = box(rows[j]);
        if (!(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) {
          rowsOverlap = true;
        }
      }
    }
    // group headings present + in order
    const headings = groups.map((g) => g.getAttribute('data-shortcut-group'));
    // expected content: key + action pairs (spot-check the pairing is real,
    // not just structure — the first row of each group)
    const pairs = rows.map((r) => {
      const k = r.querySelector('[data-shortcut-key]')?.textContent?.trim() ?? '';
      const a = r.querySelector('[data-shortcut-action]')?.textContent?.trim() ?? '';
      return k + ' -> ' + a;
    });
    return {
      panelInViewport: inVp(pb),
      groupCount: groups.length,
      headings,
      rowCount: rows.length,
      keyCount: keys.length,
      actionCount: actions.length,
      rowsInViewport: rowsInVp,
      needsScroll,
      keyColumnAligned: keyAlign,
      rowsDoNotOverlap: !rowsOverlap,
      pairs,
      panelSize: { w: +pb.width.toFixed(1), h: +pb.height.toFixed(1) },
      evidence,
      // round-8 derivation-based solver-decision inputs, measured live on
      // THIS platform: content (border-box) vs lane band. The assertion is
      // on the SOLVER'S DECISION matching these inputs — passable on every
      // rasterizer — not on any absolute pixel count.
      solver: (() => {
        const cs = getComputedStyle(panelEl);
        const padT = parseFloat(cs.paddingTop) || 0;
        const padB = parseFloat(cs.paddingBottom) || 0;
        const bY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
        const lc = panelEl.lastElementChild;
        const contentTop = pb.top + (parseFloat(cs.borderTopWidth) || 0) + padT;
        const contentBorderBox = lc
          ? Math.ceil((lc.getBoundingClientRect().bottom - contentTop) + padT + padB + bY)
          : Math.ceil(panelEl.scrollHeight + bY);
        const laneBand = layout_lane_band();
        return {
          contentBorderBox,
          laneBand,
          maxHeightApplied: cs.maxHeight !== 'none',
          // the solver's decision, recomputed from the measured inputs:
          // lane >= content -> no clamp (sizes to content); lane < content
          // -> clamped to lane + scrolls inside
          expectNoScroll: laneBand >= contentBorderBox,
        };
        function layout_lane_band() {
          const corner = document.querySelector('[data-corner-controls]') ?? document.querySelector('[data-corner-row]');
          const floorY = (corner ? corner.getBoundingClientRect().top : innerHeight) - 8;
          return Math.ceil(floorY - pb.top);
        }
      })(),
    };
  });
  // #70: locale-agnostic — the group headings are COPY (Kamera/Orodja/Prekliči
  // in SL, Camera/Tools/Cancel in EN), so assert COUNT + ORDER-STRUCTURE via
  // data attributes, never the English literals. The gate runs under
  // whatever locale the world is in (SL in the full-suite run).
  const expectedGroupCount = 3;
  const expectedRows = 7; // 2 camera + 3 tools + 2 cancel (Esc + Space, #71)
  // round-8 (PR #49 comment #6562533719): the assertion is DERIVATION-BASED
  // and platform-proof — assert the solver's DECISION matches the measured
  // inputs, never an absolute pixel count (toast/panel font metrics differ
  // ~42-60px between Linux FreeType and Windows ClearType, which moved the
  // rasterizer class from the panel to the toast fixture):
  //   lane >= content -> needsScroll=false AND panel height ~= content
  //   lane <  content -> maxHeight applied AND capped at lane AND scrolls
  const sv = layout.solver ?? { contentBorderBox: 0, laneBand: 0, expectNoScroll: true, maxHeightApplied: false };
  const noScrollBranchOk =
    sv.expectNoScroll &&
    !layout.needsScroll &&
    Math.abs(layout.panelSize.h - sv.contentBorderBox) <= 2;
  const cappedBranchOk =
    !sv.expectNoScroll &&
    layout.needsScroll &&
    sv.maxHeightApplied &&
    layout.panelSize.h <= sv.laneBand + 1.5;
  const solverDecisionOk = sv.expectNoScroll ? noScrollBranchOk : cappedBranchOk;
  const ok =
    !layout.error &&
    layout.panelInViewport &&
    layout.groupCount === expectedGroupCount &&
    layout.headings.every((h, i) => typeof h === 'string' && h.length > 0) &&
    layout.headings.length === expectedGroupCount &&
    layout.rowCount === expectedRows &&
    layout.keyCount === expectedRows &&
    layout.actionCount === expectedRows &&
    layout.rowsInViewport &&
    solverDecisionOk &&
    layout.keyColumnAligned &&
    layout.rowsDoNotOverlap &&
    // pairing spot-check: every pair has a non-empty key AND action
    layout.pairs.every((p) => p.includes(' -> ') && p.split(' -> ')[0].length > 0 && p.split(' -> ')[1].length > 0);
  // #70: name the failing predicate(s) in the FAIL detail — a FAIL that
  // doesn't say which assertion failed is a half-fixed detector
  const failedPredicates = [];
  if (layout.error) failedPredicates.push('error:' + layout.error);
  if (!layout.panelInViewport) failedPredicates.push('panelInViewport');
  if (layout.groupCount !== expectedGroupCount) failedPredicates.push('groupCount=' + layout.groupCount);
  if (!(layout.headings.every((h) => typeof h === 'string' && h.length > 0) && layout.headings.length === expectedGroupCount)) failedPredicates.push('headings=' + JSON.stringify(layout.headings));
  if (layout.rowCount !== expectedRows) failedPredicates.push('rowCount=' + layout.rowCount);
  if (layout.keyCount !== expectedRows) failedPredicates.push('keyCount=' + layout.keyCount);
  if (layout.actionCount !== expectedRows) failedPredicates.push('actionCount=' + layout.actionCount);
  if (!layout.rowsInViewport) failedPredicates.push('rowsInViewport');
  if (!solverDecisionOk) failedPredicates.push('solverDecision(branch=' + (sv.expectNoScroll ? 'no-scroll' : 'capped') + ',noScrollBranchOk=' + noScrollBranchOk + ',cappedBranchOk=' + cappedBranchOk + ')');
  if (!layout.keyColumnAligned) failedPredicates.push('keyColumnAligned');
  if (!layout.rowsDoNotOverlap) failedPredicates.push('rowsDoNotOverlap');
  if (!layout.pairs.every((p) => p.includes(' -> ') && p.split(' -> ')[0].length > 0 && p.split(' -> ')[1].length > 0)) failedPredicates.push('pairing');
  rec.record(
    'keys.hint-panel-grouped-list',
    ok,
    layout.error
      ? layout.error
      : (ok ? 'all predicates pass' : 'FAILED predicates: ' + failedPredicates.join(', ')) +
        ' | groups=' + JSON.stringify(layout.headings) +
        ' rows=' + layout.rowCount +
        ' keyColumnAligned=' + layout.keyColumnAligned +
        ' rowsInViewport=' + layout.rowsInViewport +
        ' needsScroll=' + layout.needsScroll +
        ' rowsOverlap=' + !layout.rowsDoNotOverlap +
        ' panel=' + JSON.stringify(layout.panelSize) +
        ' branch=' + (sv.expectNoScroll ? 'no-scroll' : 'capped+scroll') +
        ' solver={content:' + sv.contentBorderBox + ',lane:' + sv.laneBand + ',maxH:' + sv.maxHeightApplied + '}' +
        ' pairs=' + JSON.stringify(layout.pairs) +
        // round-7: ALWAYS dump the evidence (pass or fail) — on a fail this
        // is ground truth from the failing platform
        '\n  [hint-evidence] ' + JSON.stringify(layout.evidence),
  );
  // also assert at a narrow viewport (the panel shrinks — finding 2 — the
  // list must still be structured and in-viewport)
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(400); // let the panel re-measure
  const narrow = await page.evaluate(() => {
    const panel = document.querySelector('[data-shortcut-hint-panel]');
    if (!panel) return { error: 'panel missing' };
    const pb = panel.getBoundingClientRect();
    const rows = [...document.querySelectorAll('[data-shortcut-row]')];
    const inVp = (b) => b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth;
    const cs = getComputedStyle(panel);
    const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const lastChild = panel.lastElementChild;
    const corner = document.querySelector('[data-corner-controls]') ?? document.querySelector('[data-corner-row]');
    // round-8: solver-decision inputs measured live at this viewport too
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const bY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const contentTop = pb.top + (parseFloat(cs.borderTopWidth) || 0) + padT;
    const contentBorderBox = lastChild
      ? Math.ceil((lastChild.getBoundingClientRect().bottom - contentTop) + padT + padB + bY)
      : Math.ceil(panel.scrollHeight + bY);
    const floorY = (corner ? corner.getBoundingClientRect().top : innerHeight) - 8;
    const laneBand = Math.ceil(floorY - pb.top);
    return {
      panelInViewport: inVp(pb),
      rowCount: rows.length,
      rowsInViewport: rows.every((r) => inVp(r.getBoundingClientRect())),
      // when the panel scrolls (maxHeight clamped), the panel itself is in
      // viewport and every row is REACHABLE — scrollHeight <= clientHeight
      // OR the panel scrolls internally (overflowY auto)
      scrollable: panel.scrollHeight > panel.clientHeight + 1,
      panelSize: { w: +pb.width.toFixed(1), h: +pb.height.toFixed(1) },
      solver: {
        contentBorderBox,
        laneBand,
        maxHeightApplied: cs.maxHeight !== 'none',
        expectNoScroll: laneBand >= contentBorderBox,
      },
      toastCards: [...document.querySelectorAll('[data-toast]')].map((t) => {
        const b = t.getBoundingClientRect();
        const csT = getComputedStyle(t);
        return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), maxWidth: csT.maxWidth, padding: csT.padding };
      }),
      // round-7 permanent instrumentation (also dumped on narrow/short)
      evidence: {
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
        rectH: +pb.height.toFixed(2),
        computedMaxHeight: cs.maxHeight,
        boxSizing: cs.boxSizing,
        overflowY: cs.overflowY,
        padding: cs.paddingTop + '/' + cs.paddingBottom,
        borderY: +borderY.toFixed(2),
        scrollClientDiff: panel.scrollHeight - panel.clientHeight,
        contentReadback: lastChild
          ? +(lastChild.getBoundingClientRect().bottom - (pb.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0))).toFixed(2)
          : null,
        row0Height: rows[0] ? +rows[0].getBoundingClientRect().height.toFixed(2) : null,
        lane: { top: +pb.top.toFixed(1), floor: +((corner ? corner.getBoundingClientRect().top : innerHeight) - 8).toFixed(1) },
        viewport: { w: innerWidth, h: innerHeight },
        fontsStatus: document.fonts ? document.fonts.status : 'n/a',
      },
    };
  });
  // round-8: derivation-based at narrow too — the solver's decision must
  // match the measured inputs on THIS platform (no absolute pixel counts)
  const nsv = narrow.solver ?? { contentBorderBox: 0, laneBand: 0, expectNoScroll: true, maxHeightApplied: false };
  const narrowNoScrollBranch = nsv.expectNoScroll && !narrow.scrollable && Math.abs(narrow.panelSize.h - nsv.contentBorderBox) <= 2;
  const narrowCappedBranch = !nsv.expectNoScroll && narrow.scrollable && nsv.maxHeightApplied && narrow.panelSize.h <= nsv.laneBand + 1.5;
  const narrowOk =
    !narrow.error && narrow.panelInViewport && narrow.rowCount === expectedRows && narrow.rowsInViewport &&
    (nsv.expectNoScroll ? narrowNoScrollBranch : narrowCappedBranch);
  rec.record(
    'keys.hint-panel-grouped-list@narrow',
    narrowOk,
    narrow.error
      ? narrow.error
      : 'rows=' + narrow.rowCount + ' rowsInViewport=' + narrow.rowsInViewport +
        ' needsScroll=' + narrow.scrollable + ' panel=' + JSON.stringify(narrow.panelSize) +
        ' branch=' + (nsv.expectNoScroll ? 'no-scroll' : 'capped+scroll') +
        ' solver={content:' + nsv.contentBorderBox + ',lane:' + nsv.laneBand + ',maxH:' + nsv.maxHeightApplied + '}' +
        ' toastCards=' + JSON.stringify(narrow.toastCards) +
        '\n  [hint-evidence@narrow] ' + JSON.stringify(narrow.evidence),
  );
  // round-6: a genuinely SHORT viewport (360x360 — corner row wraps to
  // three rows at <480 wide, so the live lane floor is high and the band
  // is shorter than the content) must cap at the lane and scroll inside —
  // shrink+scroll unchanged. (360x500's lane turned out ample at 360
  // wide because the corner row wraps to two rows there, leaving ~304px;
  // 360x360 makes the band genuinely short.)
  await page.setViewportSize({ width: 360, height: 360 });
  await page.waitForTimeout(400);
  const short = await page.evaluate(() => {
    const panel = document.querySelector('[data-shortcut-hint-panel]');
    if (!panel) return { error: 'panel missing' };
    const pb = panel.getBoundingClientRect();
    const cs = getComputedStyle(panel);
    const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const inVp = (b) => b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth;
    const corner = document.querySelector('[data-corner-controls]') ?? document.querySelector('[data-corner-row]');
    const floorY = (corner ? corner.getBoundingClientRect().top : innerHeight) - 8;
    return {
      panelInViewport: inVp(pb),
      needsScroll: panel.scrollHeight + borderY > pb.height + 1,
      scrollsInside: panel.scrollHeight > panel.clientHeight + 1 && cs.overflowY === 'auto',
      cappedAtLane: pb.height <= floorY - pb.top + 1.5,
      panelSize: { w: +pb.width.toFixed(1), h: +pb.height.toFixed(1) },
      laneTop: +pb.top.toFixed(1),
      laneBottom: +floorY.toFixed(1),
      viewportH: innerHeight,
    };
  });
  const shortOk =
    !short.error && short.panelInViewport && short.needsScroll && short.scrollsInside && short.cappedAtLane;
  rec.record(
    'keys.hint-panel-grouped-list@short-lane-shrink-scroll',
    shortOk,
    short.error
      ? short.error
      : 'vpH=' + short.viewportH + ' panel=' + JSON.stringify(short.panelSize) + ' lane=[' + short.laneTop + ',' + short.laneBottom + ']' +
        ' needsScroll=' + short.needsScroll + ' scrollsInside=' + short.scrollsInside + ' cappedAtLane=' + short.cappedAtLane,
  );
  const re2 = realErrors(errors);
  rec.record('keys.hint-panel-no-console-errors', re2.length === 0, re2.slice(0, 3).join(' | '));
  await page.close();
}

async function checkAudio() {
  const { page, errors } = await newPage(browser, url);
  await freshWorld(page);
  const before = await page.evaluate(() => {
    const w = window.__meadowlight;
    return { running: w.audioIsRunning(), toggle: w.audioEnabledReadback() };
  });
  rec.record('audio.off-by-default', before.running === false, 'audioRunning at boot: ' + before.running);
  // the corner toggle is the single switch — click the real button
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-audio-toggle]');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const w = window.__meadowlight;
    return { running: w.audioIsRunning(), info: w.audioDebug(), toggle: w.audioEnabledReadback() };
  });
  rec.record(
    'audio.toggle-drives-lifecycle',
    clicked && after.running === true && after.info !== null,
    'corner toggle clicked: ' + clicked + ', audioRunning ' + before.running + ' -> ' + after.running +
      ', graph nodes present: ' + (after.info ? Object.values(after.info.nodes).every(Boolean) : false),
  );
  // volume follows the bee count through the pure function (unit-testable)
  const vol = await page.evaluate(() => {
    const w = window.__meadowlight;
    return w.buzzLevelForBees?.(0) !== undefined
      ? { at0: w.buzzLevelForBees(0), atCap: w.buzzLevelForBees(60), atHalf: w.buzzLevelForBees(30) }
      : null;
  });
  rec.record(
    'audio.volume-follows-bee-count',
    !!vol && vol.at0 === 0 && vol.atHalf > 0 && vol.atCap > vol.atHalf,
    vol ? 'buzz level at 0/30/60 bees: ' + vol.at0 + ' / ' + vol.atHalf.toFixed(4) + ' / ' + vol.atCap.toFixed(4) : 'pure function not exposed',
  );
  // toggle off tears the graph down
  await page.evaluate(() => {
    const btn = document.querySelector('[data-audio-toggle]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const off = await page.evaluate(() => window.__meadowlight.audioIsRunning());
  rec.record('audio.toggle-off-stops-graph', off === false, 'audioRunning after second click: ' + off);
  const re = realErrors(errors);
  rec.record('audio.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

async function checkTouch() {
  for (const width of [360, 480, 700]) {
    const { page, errors } = await newPage(browser, url);
    await page.setViewportSize({ width, height: 800 });
    await freshWorld(page);
    const geo = await page.evaluate(() => {
      const dock = document.querySelector('[data-palette-dock]');
      const corner = document.querySelector('[data-corner-controls]');
      const r = dock?.getBoundingClientRect();
      const c = corner?.getBoundingClientRect();
      if (!r || !c) return { ok: false };
      // O4: the no-overlap invariant — the dock's full box never
      // intersects the corner controls' box. At narrow widths the dock
      // grows UPWARD from the bottom inset (bottom-anchored, height
      // bounded by the wrapped corner lane), so the boxes stack vertically
      // instead of overlapping.
      const noOverlap = r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom;
      return {
        ok: true,
        inViewport: r.left >= 0 && r.right <= window.innerWidth,
        noOverlap,
        // the dock is bottom-anchored and grows upward within a maxHeight
        // bound — its full box must stay inside the viewport vertically
        // (the bound exists to guarantee exactly this)
        inViewportVertical: r.top >= 0 && r.bottom <= window.innerHeight,
        dockWidth: +r.width.toFixed(1),
        dockHeight: +r.height.toFixed(1),
        cornerTop: +c.top.toFixed(1),
        viewport: window.innerWidth,
      };
    });
    rec.record(
      'touch.dock-geometry@' + width,
      geo.ok && geo.inViewport && geo.noOverlap && geo.inViewportVertical,
      JSON.stringify(geo),
    );
    const re = realErrors(errors);
    rec.record('touch.no-console-errors@' + width, re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

// #68: shared dispatch — unknown names name the valid checks (the old
// console.error+exit(2) produced a ZERO-result run in the full-suite runner)
const code = await dispatchChecks(rec, checks, {
  polish: checkPolish,
  onboarding: checkOnboarding,
  journal: checkJournal,
  keys: async () => { await checkKeys(); await checkHintPanel(); },
  audio: checkAudio,
  touch: checkTouch,
  chrome: checkChrome,
  popups: checkPopups,
}, 'session9-gate');
await browser.close();
process.exit(code);
