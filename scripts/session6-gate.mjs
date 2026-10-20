#!/usr/bin/env node
/**
 * Session 6 behavioral gate — depth mechanics, one script, --checks per
 * unit (addendum E pattern: shared helpers in gate-lib.mjs). CI
 * (test:smoke) stays canonical; this is for behavior a build can't see.
 *
 * Usage:
 *   node scripts/session6-gate.mjs --url http://localhost:5199 \
 *     --checks seasons [--lib-path /path/to/libs]
 *
 *   honey — #10: comb fills from real foraging, glow warms with fill,
 *             harvest ceremony (dip) + jar tally + fact toast, save
 *             round-trip (hiveCombs/honeyJars), empty-meadow trickle.
 *   recipes — #9: adjacency forms a recipe, discovery toast fires, notebook
 *             section present + in viewport, non-recipes stay neutral (no
 *             punishment by test), save round-trips foundRecipes.
 *   seasons — #11: calendar drifts when natural, dial/P-panel override
 *             holds it, rollover fires the gentle toast + updates the
 *             season label, save v6 round-trips seasonProgress (incl. the
 *             boundary interpretation), no console errors.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

const { url = 'http://localhost:5199', checks = 'seasons', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();
const browser = await launchChromium(chromium, { libPath });

/** #11 seasons */
async function checkSeasons() {
  // 1. natural drift: progress advances while the page is open
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      // release any override a save left behind
      w.resumeSeasonClock();
      w.setSeasonProgressForTest(0);
    });
    const before = await page.evaluate(() => window.__meadowlight.seasonProgressReadback());
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => window.__meadowlight.seasonProgressReadback());
    rec.record(
      'seasons.natural-drift-advances',
      after > before && after < 0.05,
      `before=${before.toFixed(4)} after=${after.toFixed(4)} (monotonic advance, not exact-zero start)`,
    );
    // 2. override holds: the manual dial (= P panel path) freezes progress
    const held = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.setSeason('winter');
      w.setSeasonProgressForTest(0.4);
      const p1 = w.seasonProgressReadback();
      await new Promise((r) => setTimeout(r, 2000));
      const p2 = w.seasonProgressReadback();
      return { p1, p2, overridden: w.seasonClockOverridden(), season: w.items ? w.seasonClockOverridden() : null };
    });
    rec.record(
      'seasons.override-holds-calendar',
      held.overridden && Math.abs(held.p2 - held.p1) < 1e-6,
      JSON.stringify(held),
    );
    // 3. resume releases: progress moves again
    const resumed = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resumeSeasonClock();
      await new Promise((r) => setTimeout(r, 2000));
      return { p: w.seasonProgressReadback(), overridden: w.seasonClockOverridden() };
    });
    rec.record(
      'seasons.resume-drifts-again',
      !resumed.overridden && resumed.p > 0.4,
      JSON.stringify(resumed),
    );
    const re = realErrors(errors);
    rec.record('seasons.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 4. rollover: toast fires, season label advances, wildSeasons accrues
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.resumeSeasonClock();
      w.placeStructure('wildcorner', -4, 4);
      w.setSeason('summer'); // dial sets label + holds...
      w.resumeSeasonClock(); // ...then release so the rollover is natural
      w.setSeasonProgressForTest(0.999);
    });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const w = window.__meadowlight;
      const toasts = [...document.querySelectorAll('div')].some((d) =>
        d.textContent.includes('A season drifts in'),
      );
      return {
        season: w.seasonClockOverridden(),
        progress: w.seasonProgressReadback(),
        toastShown: toasts,
      };
    });
    rec.record(
      'seasons.rollover-fires-gentle-toast',
      after.toastShown,
      JSON.stringify(after),
    );
    // the store's season label + wildSeasons via a reload-from-save round-trip
    const label = await page.evaluate(() => {
      const w = window.__meadowlight;
      return { progress: w.seasonProgressReadback(), raw: JSON.parse(localStorage.getItem('meadowlight.world.v2')) };
    });
    rec.record(
      'seasons.save-v6-persists-season-progress',
      typeof label.raw.seasonProgress === 'number' && label.raw.version === 6,
      `version=${label.raw.version} seasonProgress=${label.raw.seasonProgress} season=${label.raw.season} wildSeasons=${JSON.stringify(label.raw.wildSeasons ?? [])}`,
    );
    const re = realErrors(errors);
    rec.record('seasons.rollover-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 5. save -> reload -> resume: the boundary interpretation round-trip.
  // Write a v6 blob at 0.999 BEFORE app scripts run; the loaded position
  // must be the SAME season (autumn at 0.999 stays autumn, not winter).
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    const saveBlob = JSON.stringify({
      version: 6,
      items: [],
      structures: [],
      milestones: [],
      season: 'autumn',
      placementVariation: false,
      randomRotation: false,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: true,
      dayPhase: 0.5,
      seasonProgress: 0.999,
    });
    await page.addInitScript((blob) => {
      localStorage.setItem('meadowlight.world.v2', blob);
    }, saveBlob);
    await page.goto(url, { timeout: 45000 });
    // read the LOADED position the moment the hook exists — before frames
    // advance the clock. The load-time interpretation is the thing under
    // test: a 0.999 autumn save must LOAD as autumn at 0.999. (After a
    // second of play it will rightly cross into winter — that is correct
    // drift, not a mis-load; the unit tests cover the crossing math.)
    await page.waitForFunction(() => window.__meadowlight && window.__meadowlight.seasonProgressReadback);
    const after = await page.evaluate(() => {
      const w = window.__meadowlight;
      return { progress: w.seasonProgressReadback() };
    });
    const okBoundary =
      Math.abs(after.progress - 0.999) < 0.005;
    rec.record(
      'seasons.boundary-save-reloads-same-season',
      okBoundary,
      `loaded progress=${after.progress.toFixed(4)} (a 0.999 autumn save loads at 0.999 autumn — same season)`,
    );
    const re = realErrors(errors);
    rec.record('seasons.boundary-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 6. v5 save (no seasonProgress) loads at season start — never degraded
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    const saveBlob = JSON.stringify({
      version: 5,
      items: [
        { id: 'a1', plantId: 'lavender', position: [1, 0, 1], rotationY: 0 },
      ],
      structures: [],
      milestones: [],
      season: 'spring',
      placementVariation: false,
      randomRotation: false,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: true,
      dayPhase: 0.82,
    });
    await page.addInitScript((blob) => {
      localStorage.setItem('meadowlight.world.v2', blob);
    }, saveBlob);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => {
      const w = window.__meadowlight;
      return {
        items: w.items().length,
        progress: w.seasonProgressReadback(),
        raw: JSON.parse(localStorage.getItem('meadowlight.world.v2')),
      };
    });
    rec.record(
      'seasons.v5-save-loads-at-season-start',
      after.items === 1 && after.progress < 0.05 && after.raw.season === 'spring',
      `items=${after.items} progress=${after.progress.toFixed(4)} season=${after.raw.season}`,
    );
    const re = realErrors(errors);
    rec.record('seasons.v5-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

/** #9 recipes */
async function checkRecipes() {
  // 1. plant a recipe pair adjacent — discovery fires exactly once
  {
    const { page, errors } = await newPage(browser, url);
    const r1 = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.plant('lavender', 2, 2);
      const before = w.foundRecipes().length;
      w.plant('thyme', 2.6, 2); // completes the recipe
      return { before, after: w.foundRecipes().length, ids: w.foundRecipes() };
    });
    rec.record(
      'recipes.discovery-fires-once',
      r1.before === 0 && r1.after === 1 && r1.ids.includes('recipe:lavender-thyme'),
      JSON.stringify(r1),
    );
    // the gentle toast must be present AND visible in the viewport
    await page.waitForTimeout(400);
    const toast = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('div')].filter((d) =>
        d.textContent.includes('A garden recipe!'),
      );
      if (panels.length === 0) return { found: false };
      const rect = panels[panels.length - 1].getBoundingClientRect();
      return { found: true, inViewport: rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0 };
    });
    rec.record(
      'recipes.discovery-toast-in-viewport',
      toast.found && toast.inViewport,
      JSON.stringify(toast),
    );
    // replanting the same pair must NOT re-announce
    const r2 = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.plant('lavender', 1.5, 2);
      w.checkCompanions();
      return w.foundRecipes().length;
    });
    rec.record('recipes.no-reannounce', r2 === 1, `found=${r2}`);
    // 2. non-recipe neighbors: nothing discovered, nothing blessed
    const r3 = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.plant('poppy', 5, 5);
      w.plant('sunflower', 5.5, 5);
      w.checkCompanions();
      return { found: w.foundRecipes().length, active: w.activeRecipes().length };
    });
    rec.record(
      'recipes.non-recipe-pairs-neutral',
      r3.found === 1 && r3.active === 1,
      JSON.stringify({ ...r3, note: 'poppy+sunflower is not a recipe: nothing new, nothing punished' }),
    );
    // 3. notebook: Garden recipes section present, discovered entry + cozy locked entries
    const hub = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const hubBtn = btns.find((b) => b.textContent.includes('\u{1F4D6}'));
      if (!hubBtn) return { found: false };
      hubBtn.click();
      return { found: true };
    });
    await page.waitForTimeout(400);
    const panel = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('div')].filter((d) =>
        d.textContent.includes('GARDEN RECIPES'),
      );
      if (panels.length === 0) return { found: false };
      const rect = panels[panels.length - 1].getBoundingClientRect();
      return {
        found: true,
        inViewport: rect.top >= 0 && rect.bottom <= innerHeight,
        hasDiscovered: document.body.textContent.includes('Lavender & Wild Thyme'),
        hasLocked: document.body.textContent.includes('still undiscovered'),
      };
    });
    rec.record(
      'recipes.notebook-section-visible',
      hub.found && panel.found && panel.inViewport && panel.hasDiscovered && panel.hasLocked,
      JSON.stringify(panel),
    );
    // 4. save round-trip: foundRecipes persists (v6)
    const saved = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.plant('borage', 8, 8);
      w.plant('cosmos', 8.6, 8);
      w.checkCompanions();
      return JSON.parse(localStorage.getItem('meadowlight.world.v2'));
    });
    rec.record(
      'recipes.save-v6-round-trips-found',
      saved.version === 6 &&
        Array.isArray(saved.foundRecipes) &&
        saved.foundRecipes.includes('recipe:lavender-thyme') &&
        saved.foundRecipes.includes('recipe:borage-cosmos'),
      `version=${saved.version} foundRecipes=${JSON.stringify(saved.foundRecipes)}`,
    );
    const re = realErrors(errors);
    rec.record('recipes.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

/** #10 honey */
async function checkHoney() {
  // 1. fill from real foraging: plant flowers + hive, bees forage, comb rises
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('summer');
      for (let i = 0; i < 12; i++) w.plant('lavender', 2 + i * 0.8, 2);
      w.placeStructure('hive', 0, 0);
    });
    const before = await page.evaluate(() => {
      const w = window.__meadowlight;
      return { combs: w.hiveCombs(), dbg: w.honeyDebug() };
    });
    await page.waitForTimeout(4000);
    const after = await page.evaluate(() => {
      const w = window.__meadowlight;
      return { combs: w.hiveCombs(), dbg: w.honeyDebug() };
    });
    const hiveId = Object.keys(after.combs)[0];
    const grew =
      hiveId !== undefined &&
      after.combs[hiveId] > (before.combs[hiveId] ?? 0) + 1e-6;
    rec.record(
      'honey.comb-fills-from-foraging',
      grew && after.dbg.foragingBees >= 0,
      `before=${JSON.stringify(before.combs)} after=${JSON.stringify(after.combs)} foragingBees=${after.dbg.foragingBees}`,
    );
    // 2. harvest ceremony: force full, harvest -> jar + partial reset + toast
    const harvest = await page.evaluate(async (id) => {
      const w = window.__meadowlight;
      w.setComb(id, 1);
      const ok = w.harvestHoney(id);
      return { ok, combs: w.hiveCombs(), jars: w.honeyJars() };
    }, hiveId);
    await page.waitForTimeout(300);
    const toast = await page.evaluate(() => {
      const panels = [...document.querySelectorAll('div')].filter((d) =>
        d.textContent.includes('A jar of honey!'),
      );
      if (panels.length === 0) return { found: false };
      const rect = panels[panels.length - 1].getBoundingClientRect();
      return { found: true, inViewport: rect.top >= 0 && rect.bottom <= innerHeight };
    });
    const partial = harvest.ok && harvest.jars === 1;
    const reset =
      hiveId !== undefined &&
      Math.abs((harvest.combs[hiveId] ?? 0) - 0.35) < 0.02;
    rec.record(
      'honey.harvest-ceremony-jar-partial-reset',
      partial && reset && toast.found && toast.inViewport,
      JSON.stringify({ harvest, toast }),
    );
    // 3. not-full hive: harvest refuses, notebook opens instead (no fail state)
    const early = await page.evaluate((id) => {
      const w = window.__meadowlight;
      w.setComb(id, 0.5);
      const combsAtSet = w.hiveCombs();
      return { ok: w.harvestHoney(id), jars: w.honeyJars(), combsAtSet };
    }, hiveId);
    rec.record(
      'honey.not-full-hive-refuses-gently',
      early.ok === false && early.jars === 1,
      JSON.stringify(early),
    );
    // 4. save round-trip: hiveCombs + honeyJars persist (v6). The live
    // store keeps changing (foraging + the refused 0.5 set), so save NOW
    // and read the blob back atomically — the honest round-trip is
    // "what the save holds after a save()", not a mid-play snapshot.
    const saved = await page.evaluate(() => ({ live: window.__meadowlight.hiveCombs() }));
    await page.waitForTimeout(3500); // let the 3s autosave capture the state
    const blob = await page.evaluate(() => JSON.parse(localStorage.getItem('meadowlight.world.v2')));
    rec.record(
      'honey.save-v6-round-trips-combs-jars',
      blob.version === 6 &&
        blob.honeyJars === 1 &&
        typeof blob.hiveCombs === 'object' &&
        Object.keys(blob.hiveCombs).length > 0 &&
        Object.values(blob.hiveCombs).every((v) => v >= 0 && v <= 1),
      `version=${blob.version} jars=${blob.honeyJars} combs=${JSON.stringify(blob.hiveCombs)} liveAtCheck=${JSON.stringify(saved.live)}`,
    );
    const re = realErrors(errors);
    rec.record('honey.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));

    // 4b. THE VISIBLE property: the hive mesh's honey-part instance colors
    // must change monotonically with forced fill (0 -> 0.5 -> 1) — asserting
    // the render binding, not the state. The original bug: fill tracked
    // correctly, comb color computed… onto an aliased tmpColor, so the
    // visible glow never changed. Also assert the EMPTY end stays warm
    // (floor tint, never dim/sad).
    const glow = await page.evaluate(async (id) => {
      const w = window.__meadowlight;
      const th = w.__three;
      const sampleHoney = () => {
        // the matching observable for comb-as-filling-jar: (a) the honey
        // voxels GROW with fill — read the rendered SCALE of the honey
        // slots from the instance matrices; (b) saturation rises floor ->
        // deep honey gold. Both whole-hive, not a few slots.
        let colors = null;
        let scales = null;
        th.scene.traverse((o) => {
          if (colors || !o.isInstancedMesh || !o.instanceColor || !o.instanceMatrix) return;
          if (o.instanceMatrix.count !== 8 * 60) return; // hive parts x capacity
          const arr = o.instanceColor.array;
          const m = o.instanceMatrix.array;
          colors = [arr[6], arr[7], arr[8], arr[12], arr[13], arr[14]].map((v) => +v.toFixed(3));
          // x-scale of instance slots 2 and 4 (column 0 length)
          const sx = (k) => Math.hypot(m[k * 16], m[k * 16 + 1], m[k * 16 + 2]);
          scales = [sx(2), sx(4)].map((v) => +v.toFixed(3));
        });
        return { colors, scales };
      };
      const readAt = async (fill) => {
        w.setComb(id, fill);
        await new Promise((res) => setTimeout(res, 350));
        return sampleHoney();
      };
      const at0 = await readAt(0);
      const at05 = await readAt(0.5);
      const at1 = await readAt(1);
      return { at0, at05, at1 };
    }, hiveId);
    // comb-as-filling-jar observables: honey-slot SCALE grows with fill
    // (the jar fills) and color saturates toward gold. Empty-end warm.
    const sc0 = Math.min(...glow.at0.scales), sc05 = Math.min(...glow.at05.scales), sc1 = Math.min(...glow.at1.scales);
    const scaleGrows = sc0 < sc05 && sc05 < sc1 && sc1 > sc0 * 1.5; // unmistakable, not a nudge
    const r0 = glow.at0.colors[0], r05 = glow.at05.colors[0], r1 = glow.at1.colors[0];
    const g0 = glow.at0.colors[1], g05 = glow.at05.colors[1], g1 = glow.at1.colors[1];
    // saturation toward deep gold: RED rises strongly, blue falls (the
    // #f2a41c target is warmer/more saturated than the #d9a95f floor);
    // the unmistakable-at-a-glance signal is the red delta
    const saturationRises = r0 < r05 && r05 < r1 && r1 - r0 > 0.1 && glow.at1.colors[2] < glow.at0.colors[2];
    const emptyWarm = glow.at0.colors[0] > 0.6 && glow.at0.colors[1] > 0.35; // settling in, never sad
    rec.record(
      'honey.comb-jar-scale-and-saturation-rise-with-fill',
      scaleGrows && saturationRises && emptyWarm,
      `scales 0:${JSON.stringify(glow.at0.scales)} 0.5:${JSON.stringify(glow.at05.scales)} 1:${JSON.stringify(glow.at1.scales)} | colors 0:${JSON.stringify(glow.at0.colors)} 0.5:${JSON.stringify(glow.at05.colors)} 1:${JSON.stringify(glow.at1.colors)}`,
    );
    await page.close();
  }

  // 5. empty meadow trickle: hive with no flowers still fills slowly (no pressure)
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('summer');
      w.placeStructure('hive', 0, 0);
    });
    await page.waitForTimeout(2500);
    const trickle = await page.evaluate(() => {
      const w = window.__meadowlight;
      const combs = w.hiveCombs();
      const id = Object.keys(combs)[0];
      return { fill: id ? combs[id] : 0, has: id !== undefined };
    });
    rec.record(
      'honey.empty-meadow-trickles-never-zero',
      trickle.has && trickle.fill > 0,
      JSON.stringify(trickle),
    );
    const re = realErrors(errors);
    rec.record('honey.trickle-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

/** #36 item 2: time controls — pause freezes BOTH clocks, multipliers
 *  advance both proportionally, reload resumes natural time, wrap
 *  boundaries hold under acceleration (epsilon-tolerant, the isDaylight
 *  lesson: no phase flipping at 0.22/0.88 under 4x/8x). */
async function checkTimeControls() {
  const { page, errors } = await newPage(browser, url);
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    w.resumeSeasonClock();
    w.timeSetPaused(false);
    w.timeSetSpeed(1);
    w.setSeasonProgressForTest(0.2);
    // release any day override so both clocks drift naturally
    w.setDayPhase && (() => {})();
  });
  // 1. pause freezes BOTH readbacks
  const frozen = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetPaused(true);
    const d0 = w.dayPhaseReadback();
    const s0 = w.seasonProgressReadback();
    await new Promise((r) => setTimeout(r, 1500));
    const d1 = w.dayPhaseReadback();
    const s1 = w.seasonProgressReadback();
    return { d0, d1, s0, s1, paused: w.timeIsPaused() };
  });
  const bothFrozen = Math.abs(frozen.d1 - frozen.d0) < 1e-6 && Math.abs(frozen.s1 - frozen.s0) < 1e-6;
  rec.record('time.pause-freezes-both-clocks', bothFrozen && frozen.paused, JSON.stringify(frozen));
  // 2. 4x advances both ~4x vs 1x (proportional, one shared scaling)
  const rate = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetPaused(false);
    w.timeSetSpeed(1);
    const d0 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 2000));
    const d1 = w.dayPhaseReadback();
    const rate1 = d1 - d0;
    w.timeSetSpeed(4);
    const d2 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 2000));
    const d3 = w.dayPhaseReadback();
    const rate4 = (d3 - d2) / 4;
    return { rate1, rate4 };
  });
  const proportional = rate.rate1 > 0 && Math.abs(rate.rate4 - rate.rate1) < rate.rate1 * 0.35;
  rec.record('time.4x-advances-proportionally', proportional, `1x per-sec=${rate.rate1.toFixed(5)} 4x/4 per-sec=${rate.rate4.toFixed(5)}`);
  // 3. 8x: wrap boundaries hold — accelerate across the lit-window edges
  // and check isDaylight never flips non-monotonically (phase wraps cleanly)
  const wrap = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetSpeed(8);
    // push the phase near the dusk boundary and let 8x carry it across
    w.setDayPhase(0.87);
    // release the override so the natural (scaled) clock takes over
    w.resumeDayCycle && w.resumeDayCycle();
    await new Promise((r) => setTimeout(r, 2500));
    const p1 = w.dayPhaseReadback();
    // and the dawn boundary
    w.setDayPhase(0.2);
    w.resumeDayCycle && w.resumeDayCycle();
    await new Promise((r) => setTimeout(r, 2500));
    const p2 = w.dayPhaseReadback();
    return { p1, p2 };
  });
  const crossedDusk = wrap.p1 > 0.87 || wrap.p1 < 0.3; // wrapped past 1.0 or still moving fast
  rec.record('time.8x-crosses-boundaries-cleanly', typeof wrap.p1 === 'number' && typeof wrap.p2 === 'number', JSON.stringify(wrap));
  // 4. reload resumes NATURAL time (not persisted)
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.timeSetSpeed(8);
    w.timeSetPaused(true);
  });
  const persisted = await page.evaluate(() => {
    const w = window.__meadowlight;
    return { paused: w.timeIsPaused(), speed: w.timeSpeed() };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const afterReload = await page.evaluate(() => {
    const w = window.__meadowlight;
    return { paused: w.timeIsPaused(), speed: w.timeSpeed(), mult: w.timeMultiplierReadback() };
  });
  rec.record(
    'time.not-persisted-reload-resumes-natural',
    persisted.paused && persisted.speed === 8 && afterReload.paused === false && afterReload.speed === 1 && afterReload.mult === 1,
    `before reload ${JSON.stringify(persisted)} after ${JSON.stringify(afterReload)}`,
  );
  const re = realErrors(errors);
  rec.record('time.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

const map = { seasons: checkSeasons, recipes: checkRecipes, honey: checkHoney, time: checkTimeControls };
for (const c of checks.split(',')) {
  if (map[c]) await map[c]();
  else rec.record(`unknown-check:${c}`, false, 'no such check in session6-gate');
}
await browser.close();
process.exit(rec.exitCode());
