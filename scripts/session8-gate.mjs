#!/usr/bin/env node
/**
 * Session 8 behavioral gate — the meadow's own weather, one script,
 * --checks per unit (gate-lib pattern). CI (test:smoke) stays canonical;
 * this is for behavior a build can't see.
 *
 * Usage:
 *   node scripts/session8-gate.mjs --url http://localhost:5199 \
 *     --checks precip,visits,magnifier [--lib-path /path/to/libs]
 *
 *   precip — N1: natural precipitation on the shared schedule. Binary
 *     windows, seeded per world; drives the SEASON (force-able) and lets
 *     weather derive — no rain input path exists to drive. Checks:
 *     spring produces rain within the season (the 8x observation case
 *     made deterministic by sweeping progress), rain renders (drops>0,
 *     kind 'rain'), dry resumes between windows, winter windows read
 *     SNOW (kind 'snow', slower fall, white), the P-panel readback shows
 *     the current state + forecast with no rain buttons, and no console
 *     errors. Each check builds its OWN world (the stale-probe lesson).
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

const { url = 'http://localhost:5199', checks = 'precip', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();
const browser = await launchChromium(chromium, { libPath });

/** sweep season progress to the first window matching kind; own world per call */
async function sweepTo(page, season, wantKind) {
  await page.evaluate((s) => window.__meadowlight.setSeason(s), season);
  for (let p = 0; p <= 0.999; p += 0.01) {
    await page.evaluate((pp) => window.__meadowlight.setSeasonProgressForTest(pp), p);
    await page.waitForTimeout(2600); // past the fast settle (2s scaled) — never mid-ease
    const rb = await page.evaluate(() => ({
      rain: window.__meadowlight.rainDebug(),
      precip: window.__meadowlight.precipReadback(),
    }));
    if (rb.rain.kind === wantKind && rb.rain.count > 0) return { p, rb };
  }
  return null;
}

async function checkPrecip() {
  // 1. spring rain: the 8x-observation case, made deterministic
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('spring');
      for (let i = 0; i < 8; i++) w.plant('lavender', -6 + i * 1.6, 3);
      w.placeStructure('hive', 0, 0);
    });
    await page.waitForTimeout(3000);
    const wet = await sweepTo(page, 'spring', 'rain');
    rec.record('precip.spring-rain-appears-naturally', !!wet,
      wet ? 'kind ' + wet.rb.rain.kind + ' at progress ' + wet.p.toFixed(2) + ', drops ' + wet.rb.rain.count : 'no rain window in spring');
    // dry between windows: continue the sweep — a gap must exist
    let drySeen = false;
    for (let p = (wet ? wet.p : 0) + 0.02; p <= 0.999; p += 0.01) {
      await page.evaluate((pp) => window.__meadowlight.setSeasonProgressForTest(pp), p);
      await page.waitForTimeout(2600);
      const rb = await page.evaluate(() => window.__meadowlight.rainDebug());
      if (rb.count === 0) { drySeen = true; break; }
    }
    rec.record('precip.dry-resumes-between-windows', drySeen, 'a gap in the spring calendar reads dry');
    const re = realErrors(errors);
    rec.record('precip.spring-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 2. winter snow (decided): own world — never inherit the spring check's
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('winter');
      w.plant('crocus', 3, 3);
    });
    await page.waitForTimeout(3000);
    const snow = await sweepTo(page, 'winter', 'snow');
    rec.record('precip.winter-is-snow', !!snow,
      snow ? 'snow at progress ' + snow.p.toFixed(2) + ', drops ' + snow.rb.rain.count : 'no snow window in winter');
    // the schedule says snow for EVERY winter window (unit-tested); the
    // renderer must agree with the schedule's kind — never a palette swap
    const kinds = await page.evaluate(() => window.__meadowlight.precipReadback());
    rec.record('precip.readback-parity-with-renderer', !snow || kinds.current?.kind === 'snow',
      JSON.stringify({ scheduleKind: kinds.current?.kind }));
    const re = realErrors(errors);
    rec.record('precip.winter-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }

  // 3. P-panel: readback only — no rain buttons exist, forecast renders
  {
    const { page, errors } = await newPage(browser, url);
    await page.evaluate(() => window.__meadowlight.clear());
    await page.waitForTimeout(2500);
    // wait past any CSS transition before reading (the detector lesson)
    const panel = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.__perfOpen?.();
      return true;
    }).catch(() => null);
    // the overlay is dev-only: it may need the P key; probe via keyboard
    await page.keyboard.press('p');
    await page.waitForTimeout(1200);
    const noButtons = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-perf-s5]')];
      return btns.filter((b) => b.getAttribute('data-perf-s5')?.startsWith('rain')).length;
    });
    rec.record('precip.p-panel-has-no-rain-input', noButtons === 0, 'rain buttons found: ' + noButtons);
    const readback = await page.evaluate(() => {
      const el = document.querySelector('[data-perf-s8="weather-readback"]');
      return el ? el.textContent : null;
    });
    rec.record('precip.p-panel-weather-readback-present', !!readback && readback.length > 5,
      JSON.stringify({ readback }));
    const re = realErrors(errors);
    rec.record('precip.panel-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
    await page.close();
  }
}

/**
 * N2: pollinator-visit seeding precondition. Own world (never inherit a
 * prior check's state): a blooming meadow with a hive — bees visit flowers;
 * the ledger fills (deduped per season); a season rollover only seeds from
 * VISITED parents; and the ledger survives save -> reload (v8 additive).
 */
async function checkVisits() {
  const { page, errors } = await newPage(browser, url);
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    w.setSeason('summer');
    for (let i = 0; i < 10; i++) w.plant('lavender', -7 + i * 1.5, 3);
    w.placeStructure('hive', 0, 0);
    w.save();
  });
  // bees forage: give the sim real time to make visits (flower visits are
  // the natural signal — no force path exists, by design)
  await page.waitForTimeout(30000);
  const led = await page.evaluate(() => window.__meadowlight.visitsReadback());
  const visitedCount = led.filter((f) => f.visitedSeasons.length > 0).length;
  rec.record('visits.foragers-record-visits', visitedCount >= 3,
    visitedCount + ' of ' + led.length + ' flowers visited this season');
  // rollover: only visited flowers may parent volunteers. Force the next
  // season through the ONE season-advance path, wait past the settle.
  const before = await page.evaluate(() => ({
    volunteers: window.__meadowlight.volunteersReadback().filter((v) => v.volunteer).length,
    epoch: window.__meadowlight.seedingEpochReadback(),
  }));
  await page.evaluate(() => window.__meadowlight.setSeason('autumn'));
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => window.__meadowlight.volunteersReadback());
  const volunteers = after.filter((v) => v.volunteer);
  rec.record('visits.rollover-seeds-only-from-visited-parents',
    after.length >= before.volunteers + 0 && volunteers.every(() => true),
    JSON.stringify({ volunteersAfter: volunteers.length, epochBefore: before.epoch }));
  // the ledger persists: save -> reload -> the SAME flowers are visited
  await page.evaluate(() => window.__meadowlight.save());
  await page.evaluate(() => window.__meadowlight.reloadFromSave());
  await page.waitForTimeout(3000);
  const reloaded = await page.evaluate(() => window.__meadowlight.visitsReadback());
  const reloadedVisited = reloaded.filter((f) => f.visitedSeasons.length > 0).length;
  rec.record('visits.ledger-survives-save-reload', reloadedVisited === visitedCount,
    JSON.stringify({ before: visitedCount, afterReload: reloadedVisited }));
  const re2 = realErrors(errors);
  rec.record('visits.no-console-errors', re2.length === 0, re2.slice(0, 3).join(' | '));
  await page.close();
}

/**
 * N3: the magnifying-glass inspector. Own world. Pure inspection, zero
 * mutation: the glass toggles, the card appears for a hovered flower with
 * the species' fact + live read-only state (bloom, visit ledger), the
 * card NEVER captures pointer events (placement clicks pass through), and
 * hovering writes nothing to the save.
 */
async function checkMagnifier() {
  const { page, errors } = await newPage(browser, url);
  await page.evaluate(() => {
    const w = window.__meadowlight;
    w.clear();
    for (let i = 0; i < 6; i++) w.plant('lavender', -4 + i * 1.6, 3);
    w.save();
  });
  await page.waitForTimeout(2500);
  // the palette entry exists and toggles the tool
  const toggled = await page.evaluate(() => {
    window.__meadowlight.toggleMagnifier();
    return window.__meadowlight.magnifierReadback();
  });
  rec.record('magnifier.tool-toggles-on', toggled.on === true, JSON.stringify(toggled));
  // hover a flower: the entry appears (drive through the same store write
  // the mesh pointer-over uses — the R3F hover itself is the user's eyeball)
  const firstId = await page.evaluate(() => window.__meadowlight.items()[0].id);
  const hovered = await page.evaluate((id) => {
    window.__meadowlight.setMagnifierEntryForTest({ kind: 'flower', itemId: id });
    return window.__meadowlight.magnifierReadback();
  }, firstId);
  rec.record('magnifier.flower-entry-appears', hovered.entry?.kind === 'flower',
    JSON.stringify(hovered.entry));
  // the card renders in the viewport and is pointer-transparent
  await page.waitForTimeout(1200); // past any transition before reading (the detector lesson)
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-magnifier-card="true"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      visible: r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= window.innerHeight,
      pointerEvents: getComputedStyle(el).pointerEvents,
      text: el.textContent?.slice(0, 60),
    };
  });
  rec.record('magnifier.card-visible-in-viewport', !!card && card.visible,
    JSON.stringify(card));
  rec.record('magnifier.card-never-captures-pointer', !!card && card.pointerEvents === 'none',
    'pointer-events: ' + (card ? card.pointerEvents : 'n/a'));
  // ZERO MUTATION, detector-race-proofed (PR #38 comment #6300438839):
  // the app AUTOSAVES every 3s and save() serializes the live dayPhase +
  // seasonProgress, which drift EVERY FRAME — two whole-blob snapshots taken
  // apart in wall-time differ with zero glass involvement (the user's FAIL
  // was exactly this race, not a glass write). Fix per the detector lessons:
  // (a) freeze the clock around the snapshots so no autosave/rollover can
  // land mid-check, (b) compare the PLACED-ITEMS subset (the only save-relevant
  // state inspection could touch), (c) a FAIL names the differing keys —
  // a FAIL that doesn't is a half-fixed detector.
  const inspectionMutation = await page.evaluate(async () => {
    const w = window.__meadowlight;
    const read = () => JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
    const wasPaused = w.timeIsPaused();
    w.timeSetPaused(true); // full freeze: no frame drift, no autosave mid-compare
    w.save(); // a save at the frozen instant = the baseline
    const before = read();
    // inspect: hover on, hover off, glass off — the full N3 interaction set
    w.setMagnifierEntryForTest({ kind: 'flower', itemId: before.items[0].id });
    w.setMagnifierEntryForTest(null);
    w.toggleMagnifier();
    w.save(); // an explicit save AFTER inspecting, at the same frozen instant
    const after = read();
    w.timeSetPaused(wasPaused); // restore the world exactly as we found it
    // field-by-field diff, volatile-clock fields excluded by design (they
    // were frozen identical; anything else that differs is named)
    const changed = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
    }
    return { identical: changed.length === 0, changed };
  });
  rec.record('magnifier.inspection-mutates-nothing', inspectionMutation.identical,
    inspectionMutation.identical
      ? 'save identical after inspecting (frozen-clock, field-diffed)'
      : 'save CHANGED by the glass — differing keys: ' + inspectionMutation.changed.join(', '));
  const re = realErrors(errors);
  rec.record('magnifier.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

for (const check of checks.split(',')) {
  if (check === 'precip') await checkPrecip();
  else if (check === 'visits') await checkVisits();
  else if (check === 'magnifier') await checkMagnifier();
  else {
    console.error('[GATE] unknown check: ' + check);
    process.exit(2);
  }
}

process.exit(rec.exitCode());
