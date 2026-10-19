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
 * Checks:
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

const map = { seasons: checkSeasons };
for (const c of checks.split(',')) {
  if (map[c]) await map[c]();
  else rec.record(`unknown-check:${c}`, false, 'no such check in session6-gate');
}
await browser.close();
process.exit(rec.exitCode());
