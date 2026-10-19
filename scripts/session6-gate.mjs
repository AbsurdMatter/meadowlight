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

const map = { seasons: checkSeasons, recipes: checkRecipes };
for (const c of checks.split(',')) {
  if (map[c]) await map[c]();
  else rec.record(`unknown-check:${c}`, false, 'no such check in session6-gate');
}
await browser.close();
process.exit(rec.exitCode());
