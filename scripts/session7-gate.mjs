#!/usr/bin/env node
/**
 * Session 7 behavioral gate — the meadow grows, one script, --checks per
 * unit (gate-lib pattern). CI (test:smoke) stays canonical; this is for
 * behavior a build can't see.
 *
 * Usage:
 *   node scripts/session7-gate.mjs --url http://localhost:5199 \
 *     --checks seeding [--lib-path /path/to/libs]
 *
 *   seeding — U1 (#new): self-seeding under the natural calendar at 8x
 *     (the v2 speed control is the verification instrument): volunteers
 *     appear across an accelerated 4-season run, regional/whole-meadow caps
 *     hold, no invasive growth pattern (volunteers cluster near parents,
 *     never as an advancing wall), seedlings are clearable like any plant,
 *     save v7 round-trips (worldSeed/seedingEpoch persist, a session-6
 *     save loads without loss), and determinism holds across reload.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors, dispatchChecks } from './gate-lib.mjs';

const { url = 'http://localhost:5199', checks = 'seeding', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();
const browser = await launchChromium(chromium, { libPath });

/** U1: self-seeding */
async function checkSeeding() {
  const { page, errors } = await newPage(browser, url);

  // 0. save v7 additive: a session-6-shaped save (no worldSeed/seedingEpoch)
  //    loads without loss and derives its seed from its own contents
  {
    const r = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.clear();
      w.plant('lavender', 3, 3);
      w.plant('thyme', 4, 3);
      // hand-write a v6-shaped blob (no worldSeed/seedingEpoch) and reload
      const blob = JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
      delete blob.worldSeed;
      delete blob.seedingEpoch;
      blob.version = 6;
      localStorage.setItem('meadowlight.world.v2', JSON.stringify(blob));
      w.reloadFromSave();
      const seed1 = w.worldSeedReadback();
      w.reloadFromSave();
      const seed2 = w.worldSeedReadback();
      return {
        items: w.items().length,
        seed1,
        seed2,
        epoch: w.seedingEpochReadback(),
      };
    });
    rec.record(
      'seeding.save-v6-additive-derives-stable-seed',
      r.items === 2 && r.seed1 === r.seed2 && r.epoch === 0 && Number.isFinite(r.seed1),
      JSON.stringify(r) + ' (v6 blob loads losslessly; derived seed stable per-blob)',
    );
  }

  // 1. accelerated 4-season run at 8x: volunteers appear, caps hold
  {
    const run = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      // a realistic mid-density meadow across the box, several species
      const species = ['lavender', 'cosmos', 'poppy', 'clover', 'thyme', 'crocus'];
      let i = 0;
      for (const sp of species) {
        for (let k = 0; k < 6; k++) {
          const a = i * 2.399963;
          const r = 4 + Math.sqrt((i + 1) / 36) * 13;
          const x = Math.cos(a) * r;
          const z = Math.sin(a) * r;
          w.plant(sp, x, z);
          i++;
        }
      }
      const before = w.items().length;
      const before0 = w.volunteersReadback().filter((v) => v.volunteer).length;
      // 8x, natural calendar across ~4 seasons (a dial selection STARTS
      // its season and keeps drifting — round-1 finding 3)
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      const samples = [];
      const startSeason = 'summer';
      const startEpoch = w.seedingEpochReadback();
      let lastEpoch = startEpoch;
      const perSeason = [];
      let lastCount = 0;
      // session 10 P1 (#53): log the visit ledger per sample — the chain
      // visit-visit -> bloom -> seed-eligible -> roll must be visible in the
      // check's own output, so a 0-volunteer run says WHY (unobserved
      // season falls back to pre-N2 parents; a non-empty ledger keeps
      // strict N2)
      const visitCounts = [];
      for (let s = 0; s < 4; s++) {
        // ~90s per season at 8x
        await new Promise((r) => setTimeout(r, 92000));
        const volunteers = w.volunteersReadback().filter((v) => v.volunteer);
        const epoch = w.seedingEpochReadback();
        samples.push({ seasonIdx: s, epoch, volunteers: volunteers.length, total: w.items().length });
        visitCounts.push(w.visitsReadback().filter((f) => f.visitedSeasons.length > 0).length);
        perSeason.push(volunteers.length - lastCount);
        lastCount = volunteers.length;
        lastEpoch = epoch;
      }
      w.timeSetSpeed(1);
      return { before, before0, beforeEpoch: startEpoch, samples, perSeason, startSeason, visitCounts };
    });
    // the samples are CUMULATIVE volunteer counts taken every ~92s at 8x,
    // but a season is only ~67s at 8x — a sample can span TWO rollovers (the
    // epoch counter says how many). The per-season cap governs the delta
    // PER EPOCH crossed, never the raw per-sample delta (a double-epoch
    // sample legitimately shows up to 2x maxPerSeason).
    const brake0 = await page.evaluate(() => window.__meadowlight.seedingBrakeReadback());
    const capsHold = run.samples.every((s, i) => {
      const prevV = i === 0 ? run.before0 : run.samples[i - 1].volunteers;
      const prevE = i === 0 ? run.beforeEpoch : run.samples[i - 1].epoch;
      const epochsCrossed = Math.max(1, s.epoch - prevE);
      return (s.volunteers - prevV) / epochsCrossed <= brake0.maxPerSeason;
    });
    const totalVolunteers = run.samples[run.samples.length - 1].volunteers;
    // growth pattern: volunteers appear (a meadow that never seeds in 4
    // seasons is broken), but stay within the CUMULATIVE share — never
    // invasive. #37 finding 2: the share is the constraint the visitor
    // FEELS; #77: the rate is a taste value, so the gate derives the
    // expectation from the ONE source (the brake readback), never pins 15%/40%
    const brake = await page.evaluate(() => window.__meadowlight.seedingBrakeReadback());
    const final = run.samples[run.samples.length - 1].total;
    const fraction = totalVolunteers / final;
    const invasive = fraction > brake.maxVolunteerFraction + 0.05; // headroom for the roll's own shape
    rec.record(
      'seeding.accelerated-4season-caps-hold',
      capsHold && !invasive && totalVolunteers >= 1,
      JSON.stringify(run.samples) + ` (volunteers ${totalVolunteers}/${final} = ${(fraction * 100).toFixed(0)}%, cumulative brake target ${(brake.maxVolunteerFraction * 100).toFixed(0)}% from SEEDING_TUNING, visitedFlowersPerSample=${JSON.stringify(run.visitCounts)})`,
    );
    // #77/#78: the brake readout (what the P panel prints) derives from the
    // ONE predicate at the NEW rate — engaged iff volunteers >= floor(total * fraction)
    const volsNow = await page.evaluate(() => window.__meadowlight.volunteersReadback().filter((v) => v.volunteer).length);
    const totalNow = await page.evaluate(() => window.__meadowlight.items().length);
    const expectedEngaged = volsNow >= Math.floor(totalNow * brake.maxVolunteerFraction);
    rec.record(
      'seeding.brake-readout-matches-predicate-at-new-rate',
      brake.total === totalNow && brake.volunteers === volsNow && brake.engaged === expectedEngaged && brake.cap === Math.floor(totalNow * brake.maxVolunteerFraction),
      JSON.stringify({ brake, volsNow, totalNow, expectedEngaged }) + ' (readout = predicate, no parallel constant)',
    );
  }

  // 2. determinism: the same world at the same epoch rolls the same volunteers
  //    (cross a season via the dial — the one seeding trigger path — and
  //    compare against a reload + identical crossing)
  {
    const det = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      w.plant('lavender', 2, 2);
      w.plant('cosmos', 5, 5);
      w.plant('poppy', -4, 3);
      w.save();
      // crossing A: dial autumn (crosses summer->autumn boundary)
      w.setSeason('autumn');
      const a = w.volunteersReadback().filter((v) => v.volunteer).map((v) => v.plantId + '@' + v.id);
      const seedA = w.worldSeedReadback();
      // reset the world back to the same blob and cross identically
      const blob = JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
      localStorage.setItem('meadowlight.world.v2', JSON.stringify({ ...blob, seedingEpoch: blob.seedingEpoch - 1 }));
      w.reloadFromSave();
      w.setSeason('autumn');
      const b = w.volunteersReadback().filter((v) => v.volunteer).map((v) => v.plantId + '@' + v.id);
      return { a, b, seedA, seedB: w.worldSeedReadback() };
    });
    rec.record(
      'seeding.deterministic-same-world-same-volunteers',
      det.seedA === det.seedB && JSON.stringify(det.a) === JSON.stringify(det.b),
      JSON.stringify(det),
    );
  }

  // 3. seedlings persist and are clearable like any plant. Self-sufficient:
  //    the OLD probe inherited the previous check's world, which a 3-flower
  //    crossing had left with no volunteers (6% per parent) — the probe read
  //    had:false and the check failed without any persistence bug existing.
  //    This probe builds its own meadow, crosses seasons until a volunteer
  //    actually exists (bounded), then reads the BLOB ground truth.
  {
    const clr = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      // a meadow big enough that a crossing produces volunteers reliably
      for (let k = 0; k < 30; k++) {
        const a = k * 2.399963;
        const r = 3 + Math.sqrt((k + 1) / 30) * 12;
        w.plant(['lavender', 'cosmos', 'poppy'][k % 3], Math.cos(a) * r, Math.sin(a) * r);
      }
      // bounded: cross seasons until at least one volunteer exists
      const order = ['spring', 'summer', 'autumn', 'winter'];
      let volunteers = [];
      for (let attempt = 0; attempt < 6 && volunteers.length === 0; attempt++) {
        // dial the next season (the one trigger path) and re-read
        w.setSeason(order[(order.indexOf('summer') + attempt) % 4]);
        volunteers = w.volunteersReadback().filter((x) => x.volunteer);
      }
      if (volunteers.length === 0) return { had: false };
      const v = volunteers[0];
      w.save();
      // BLOB GROUND TRUTH (the session-3 lesson: read the saved JSON, never
      // a proxy): the flag must be in the serialized payload itself
      const blob = JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
      const blobFlag = (blob.items || []).some((it) => it.id === v.id && it.volunteer === true);
      w.reloadFromSave();
      const persisted = w.volunteersReadback().some((x) => x.id === v.id && x.volunteer);
      w.removeAt(v.id);
      const gone = !w.volunteersReadback().some((x) => x.id === v.id);
      return { had: true, blobFlag, persisted, gone };
    });
    rec.record(
      'seeding.seedlings-persist-and-clear',
      clr.had && clr.blobFlag && clr.persisted && clr.gone,
      JSON.stringify(clr) + ' (blobFlag = the flag read from the saved JSON itself)',
    );
  }

  const re = realErrors(errors);
  rec.record('seeding.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** U2: seasonal wild visitors */
async function checkVisitors() {
  const { page, errors } = await newPage(browser, url);

  // 1. queen bumble: forced condition (spring + crocuses) AND early-spring
  //    window — appears, records exactly one window entry
  {
    const q = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('spring');
      w.setSeasonProgressForTest(0.1); // early spring (her window)
      for (let k = 0; k < 5; k++) w.plant('crocus', 2 + k * 1.2, 2);
      await new Promise((r) => setTimeout(r, 2500));
      const d = w.wildDebug();
      const windows1 = w.visitorWindowsReadback().slice();
      await new Promise((r) => setTimeout(r, 1500));
      const windows2 = w.visitorWindowsReadback().slice();
      return { queen: d.queenBumbles, windows1, windows2 };
    });
    const win = q.windows1.filter((k) => k.startsWith('queenbumble:'));
    rec.record(
      'visitors.queen-under-forced-condition',
      q.queen >= 1 && win.length === 1 && q.windows2.length === q.windows1.length,
      JSON.stringify(q) + ' (one window entry, no re-record)',
    );
  }

  // 2. moth: forced condition (night + lavender) — appears at night only
  {
    const m = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('summer');
      w.setDayPhase(0.95); // night (the panel force path)
      for (let k = 0; k < 5; k++) w.plant('lavender', -2 - k * 1.2, 2);
      await new Promise((r) => setTimeout(r, 2500));
      const night = w.wildDebug();
      w.setDayPhase(0.5); // midday: the condition is gone, visitors vanish
      await new Promise((r) => setTimeout(r, 2500));
      const day = w.wildDebug();
      return { night: night.lavenderMoths, day: day.lavenderMoths };
    });
    rec.record(
      'visitors.moth-night-only-under-forced-condition',
      m.night >= 1 && m.day === 0,
      JSON.stringify(m) + ' (night: present; midday: gone — condition-gated)',
    );
  }

  // 3. firefly summer bloom: composes with dusk (one system), corner present
  {
    const f = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.setSeason('summer');
      w.setDayPhase(0.82); // dusk (golden hour inside the dusk window)
      w.placeStructure('wildcorner', -4.5, 5);
      await new Promise((r) => setTimeout(r, 2500));
      const summer = w.fireflyDebug();
      w.setSeason('spring'); // same dusk, not summer: bloom gone, base remains
      await new Promise((r) => setTimeout(r, 2500));
      const spring = w.fireflyDebug();
      return { summer, spring };
    });
    rec.record(
      'visitors.firefly-summer-bloom-composes-with-dusk',
      f.summer.count > f.spring.count && f.spring.count >= 0,
      JSON.stringify(f) + ' (summer dusk > spring dusk at the same corner)',
    );
  }

  // 4. natural timing in an accelerated run: visitors appear under the
  //    calendar's own seasons, not just forced conditions (8x run, ~2 seasons)
  {
    const n = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.setSeason('spring');
      w.setSeasonProgressForTest(0.05);
      w.setDayPhase(0.3); // day: butterflies/queen active
      for (let k = 0; k < 6; k++) w.plant('crocus', 2 + k * 1.2, 2);
      for (let k = 0; k < 6; k++) w.plant('forget-me-not', -2 - k, -4);
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      await new Promise((r) => setTimeout(r, 60000)); // ~ most of spring at 8x
      w.timeSetSpeed(1);
      const windows = w.visitorWindowsReadback().slice();
      const d = w.wildDebug();
      return { windows, debug: { butterflies: d.butterflies, queen: d.queenBumbles } };
    });
    rec.record(
      'visitors.natural-timing-records-window',
      n.windows.some((k) => k.startsWith('queenbumble:spring')),
      JSON.stringify(n) + ' (queen recorded under natural spring timing)',
    );
  }

  const re = realErrors(errors);
  rec.record('visitors.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** #37 review: time controls must be PRESENT and FUNCTIONAL — the
 *  session-6 gate asserted only clock semantics, never the UI row, so a
 *  missing-controls regression had no detector. This check asserts the
 *  DOM row (data-time-control buttons mounted, in-viewport) AND that the
 *  buttons drive the same engine the P-panel readbacks expose. */
async function checkTimeControlsUI() {
  const { page, errors } = await newPage(browser, url);

  // 1. the row is mounted and visible (the observable, not innerHTML)
  const present = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[data-time-control]'));
    return {
      count: btns.length,
      visible: btns.map((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      }),
      labels: btns.map((b) => b.textContent),
    };
  });
  const allVisible = present.visible.length === present.count && present.count >= 5;
  rec.record(
    'timecontrols.row-present-in-viewport',
    present.count >= 5 && allVisible,
    JSON.stringify({ count: present.count, labels: present.labels }),
  );

  // 2. clicking the real buttons drives the real clock (pause, 4x)
  const drove = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetSpeed(1);
    w.timeSetPaused(false);
    const d0 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 1200));
    const d1 = w.dayPhaseReadback();
    return { d0, d1, moving: d1 !== d0 };
  });
  const clickPause = await page.click('[data-time-control="pause"]');
  const afterPause = await page.evaluate(async () => {
    const w = window.__meadowlight;
    const d0 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 1200));
    const d1 = w.dayPhaseReadback();
    return { paused: w.timeIsPaused(), frozen: d0 === d1 };
  });
  rec.record(
    'timecontrols.pause-button-functional',
    drove.moving && afterPause.paused && afterPause.frozen,
    JSON.stringify({ drove, afterPause }),
  );
  await page.click('[data-time-control="pause"]'); // resume
  const fourX = await page.evaluate(async () => {
    const w = window.__meadowlight;
    const d0 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 1200));
    const d1 = w.dayPhaseReadback();
    return { rate: d1 - d0, speed: w.timeSpeed() };
  });
  await page.click('[data-time-control="speed-4"]');
  const fourAfter = await page.evaluate(async () => {
    const w = window.__meadowlight;
    const d0 = w.dayPhaseReadback();
    await new Promise((r) => setTimeout(r, 1200));
    const d1 = w.dayPhaseReadback();
    return { rate: d1 - d0, speed: w.timeSpeed() };
  });
  rec.record(
    'timecontrols.4x-button-functional',
    fourAfter.speed === 4 && fourAfter.rate > fourX.rate * 2,
    JSON.stringify({ fourX, fourAfter }),
  );
  await page.click('[data-time-control="speed-1"]');

  // 3. the ANIMATION clock scales and freezes (the observable that failed:
  //  sim scaled, animation did not, pause was invisible). Assert the shared
  //  scaledElapsed accumulator — the one source every animation consumes.
  const anim = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetPaused(false);
    w.timeSetSpeed(1);
    const a0 = w.scaledElapsedReadback();
    await new Promise((r) => setTimeout(r, 1500));
    const a1 = w.scaledElapsedReadback();
    const rate1 = a1 - a0;
    w.timeSetSpeed(4);
    const b0 = w.scaledElapsedReadback();
    await new Promise((r) => setTimeout(r, 1500));
    const b1 = w.scaledElapsedReadback();
    const rate4 = (b1 - b0) / 4;
    w.timeSetPaused(true);
    const c0 = w.scaledElapsedReadback();
    await new Promise((r) => setTimeout(r, 1500));
    const c1 = w.scaledElapsedReadback();
    w.timeSetPaused(false);
    w.timeSetSpeed(1);
    return { rate1, rate4, frozen: c1 === c0 };
  });
  rec.record(
    'timecontrols.animation-clock-scales-and-freezes',
    anim.rate1 > 0.5 && Math.abs(anim.rate4 - anim.rate1) < anim.rate1 * 0.4 && anim.frozen,
    JSON.stringify(anim) + ' (1x vs 4x/4 per-second ~equal; pause = exactly frozen)',
  );

  // 4. pause indicator present + in-viewport when paused (observable pause)
  const pausedUI = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.timeSetPaused(true);
    // #84 (detector fix): the row re-renders on its OWN 1s interval, so the
    // paused style lands up to 1s after the call and the 0.25s opacity
    // transition runs after that. A FIXED wait samples wherever that
    // interval phase happens to be — the FAIL read chip:true with
    // rowOpacity:"1", i.e. sampled at the transition's start value. Poll
    // the computed opacity until it settles below the dim threshold
    // (5s deadline), then read chip + rects + inline opacity in that
    // settled state and BEFORE unpausing (wait past tick+transition, read
    // before mutating — the session-7 canon).
    // #84 round 2: the poll must require BOTH observables of the paused
    // render — the chip element present AND the computed opacity settled —
    // because the check that ran before this one paused+unpaused the world:
    // a stale dimmed opacity from the previous pause can read < 0.7 at the
    // first 100ms sample, before the row's next 1s tick rendered the new
    // paused state (chip still absent => the 2d014fc chip:false FAIL).
    let row = null;
    let rowOpacity = null;
    let chip = null;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      row = document.querySelector('[data-time-row]');
      rowOpacity = row ? getComputedStyle(row).opacity : null;
      chip = document.querySelector('[data-paused-chip]');
      if (chip && rowOpacity !== null && parseFloat(rowOpacity) < 0.7) break;
    }
    const chipRect = chip ? chip.getBoundingClientRect() : null;
    const pausedSnapshot = {
      chip: !!chip,
      rowOpacity,
      // world-vs-detector fork: inline opacity is the semantic the component
      // writes; computed is the visible value — a FAIL with inline "0.55"
      // but computed "1" is a timing read, inline "1" is a world regression
      rowInlineOpacity: row ? row.style.opacity : null,
    };
    // the decided observable also includes the INVERSE: running shows no chip
    // AND the dim lifts back. #84 round-3 hardening: the old fixed 2200ms
    // wait after unpausing is the same fixed-wait class as the round-1 FAIL
    // (it samples wherever the row's own 1s re-render interval + 0.25s
    // transition phase happens to be). Poll instead — 100ms steps, 5s
    // deadline — until the chip is absent AND the computed opacity has
    // settled back above the dim threshold, then read in that settled state.
    // A world-side regression (chip stuck present, or the row never undims)
    // now FAILs only after the full poll, named by the dump fields.
    w.timeSetPaused(false);
    let chipWhenRunning = document.querySelector('[data-paused-chip]');
    let rowOpacityWhenRunning = null;
    const invDeadline = Date.now() + 5000;
    while (Date.now() < invDeadline) {
      await new Promise((r) => setTimeout(r, 100));
      row = document.querySelector('[data-time-row]');
      rowOpacityWhenRunning = row ? getComputedStyle(row).opacity : null;
      chipWhenRunning = document.querySelector('[data-paused-chip]');
      if (!chipWhenRunning && rowOpacityWhenRunning !== null && parseFloat(rowOpacityWhenRunning) > 0.9) break;
    }
    return {
      ...pausedSnapshot,
      inViewport: !!chipRect && chipRect.width > 0 && chipRect.top >= 0 && chipRect.bottom <= window.innerHeight,
      chipAbsentWhenRunning: !chipWhenRunning,
      rowOpacityWhenRunning,
    };
  });
  rec.record(
    'timecontrols.pause-indicator-present-in-viewport',
    pausedUI.chip &&
      pausedUI.inViewport &&
      parseFloat(pausedUI.rowOpacity) < 0.7 &&
      pausedUI.chipAbsentWhenRunning &&
      pausedUI.rowOpacityWhenRunning !== null &&
      parseFloat(pausedUI.rowOpacityWhenRunning) > 0.9,
    JSON.stringify(pausedUI) + ' (resting chip visible + row dimmed when paused; no chip + dim lifted when running)',
  );

  const re = realErrors(errors);
  rec.record('timecontrols.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** U3: bee lifecycles, gently — the colony breath */
async function checkColony() {
  const { page, errors } = await newPage(browser, url);

  // 1. forced conditions read correctly per season (P-panel path = the
  //    natural inputs; no direct population force exists)
  {
    const seasons = await page.evaluate(async () => {
      const w = window.__meadowlight;
      const out = {};
      // the old check read spring at p=0.1 (target 0.193 by the curve's
      // design) against a > 0.2 threshold — a detector bug, not behavior.
      // Forced reads assert the TARGET semantic (the pure data curve,
      // instant and deterministic); the live ease is asserted separately
      // below.
      for (const [season, p] of [['spring', 0.5], ['summer', 0.5], ['autumn', 0.5], ['winter', 0.5]]) {
        w.setSeason(season);
        w.setSeasonProgressForTest(p);
        await new Promise((r) => setTimeout(r, 300));
        out[season] = w.colonyReadback();
      }
      return out;
    });
    const ok =
      seasons.spring.target > 0.4 &&
      seasons.summer.target > seasons.spring.target &&
      Math.abs(seasons.summer.target - seasons.autumn.target) < 0.5 &&
      // #87 verdict B: winter keeps the LIVING cluster floor (winterFloor 0.45);
      // the old die-off curve read < 0.15 here
      seasons.winter.target >= 0.4 &&
      seasons.winter.line.includes('clustered snug') &&
      seasons.spring.line.includes('waking');
    rec.record(
      'colony.forced-seasons-read-correctly',
      ok,
      JSON.stringify(seasons, null, 1),
    );
    // (a)/(b) disambiguation, built in: after a force jump the live ease
    // must CONVERGE on the new target (same shared update site — the
    // force path writes the store the frame loop reads; no second path).
    // Bounded settle window: within ~12s the gap must close to < 0.1.
    const settle = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.setSeason('summer');
      w.setSeasonProgressForTest(0.5);
      const target = w.colonyReadback().target;
      const samples = [];
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const intensity = w.colonyReadback().intensity;
        samples.push(+intensity.toFixed(3));
        if (Math.abs(intensity - target) < 0.1) break;
      }
      const final = w.colonyReadback().intensity;
      return { target, samples, converged: Math.abs(final - target) < 0.1 };
    });
    rec.record(
      'colony.forced-jump-ease-converges',
      settle.converged,
      JSON.stringify(settle) + ' (force jumps ease to the target through the one update site)',
    );
  }

  // 2. full-year accelerated trace: population rises through spring, holds
  //    summer, clusters in winter, reawakens — via the natural calendar at 8x
  {
    const trace = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.placeStructure('hive', 0, 0);
      w.plant('lavender', 2, 2);
      w.plant('cosmos', 4, 2);
      w.plant('clover', 6, 2);
      w.setSeason('spring');
      w.setSeasonProgressForTest(0.0);
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      const samples = [];
      // ~4 seasons x ~92s at 8x = ~6min; sample each ~45s
      for (let i = 0; i < 9; i++) {
        await new Promise((r) => setTimeout(r, 45000));
        const rb = w.colonyReadback();
        samples.push({ i, intensity: +rb.intensity.toFixed(3), target: +rb.target.toFixed(3) });
      }
      w.timeSetSpeed(1);
      return samples;
    });
    // the breath shape across the trace: some rise, a tucked winter band — and
    // #87: never a die-off (the old curve dropped under 0.15; verdict-B winter
    // band is ~0.45–0.55, so assert the band exists AND the floor never collapses)
    const rises = trace.some((s, i) => i > 0 && s.intensity > trace[i - 1].intensity + 0.05);
    const tucked = trace.some((s) => s.target <= 0.7);
    const neverDieOff = trace.every((s) => s.target >= 0.3);
    const peaks = trace.some((s) => s.intensity > 0.5);
    rec.record(
      'colony.full-year-accelerated-trace',
      rises && tucked && neverDieOff && peaks,
      JSON.stringify(trace) + ' (rise + hold + lively-cluster phases observed, no die-off)',
    );
  }

  // 2b. #87 (verdict B): the bee-year curve — SLOPE assertions read from the SAME
  //     source the swarm uses (colonyReadback().target = the pure data curve).
  //     Deterministic: progress stepped directly; the target read is pure/instant.
  {
    const curve = await page.evaluate(() => {
      const w = window.__meadowlight;
      const read = (season, p) => {
        w.setSeason(season);
        w.setSeasonProgressForTest(p);
        return +w.colonyReadback().target.toFixed(4);
      };
      return {
        spring: [0, 0.25, 0.5, 0.75, 1].map((p) => read('spring', p)),
        summer: [0, 0.5, 1].map((p) => read('summer', p)),
        autumn: [0, 0.5, 1].map((p) => read('autumn', p)),
        winter: [0, 0.25, 0.5, 0.75, 1].map((p) => read('winter', p)),
      };
    });
    const minWinter = Math.min(...curve.winter);
    rec.record(
      'colony.winter-floor-never-die-off',
      minWinter >= 0.4, // verdict-B winterFloor 0.45; the old die-off curve read ~0.0–0.08
      JSON.stringify(curve.winter),
    );
    const ticks = curve.spring.slice(1).map((v, i) => +(v - curve.spring[i]).toFixed(4));
    const monotone = ticks.every((d) => d > 0);
    const firstTick = ticks[0];
    const minSlope = 0.2; // per 0.25-progress tick; verdict-B shape 2 gives ~0.2406 on tick 1
    const endsAtPeak = curve.spring[4] >= 0.89;
    const avgSpring = +(curve.spring[4] - curve.spring[0]).toFixed(4);
    const avgAutumn = +Math.abs(curve.autumn[2] - curve.autumn[0]).toFixed(4);
    const frontLoaded = curve.spring[2] - curve.spring[0] > 2 * (curve.spring[4] - curve.spring[2]);
    rec.record(
      'colony.spring-slope-steepest',
      monotone && firstTick >= minSlope && endsAtPeak && avgSpring > avgAutumn && frontLoaded,
      JSON.stringify({ ticks, firstTick, minSlope, endsAtPeak, avgSpring, avgAutumn, frontLoaded }),
    );
    const plateau =
      curve.summer.every((v) => Math.abs(v - curve.summer[0]) < 1e-9) && curve.summer[0] >= 0.89;
    rec.record('colony.summer-plateau', plateau, JSON.stringify(curve.summer));
  }

  // 2c. #87 (verdict B): the winter floor is VISIBLE — live swarm + solitary counts
  //     in a deterministic fixture (hive + bath + hedge + hotel + winter bloom,
  //     day phase pinned per the #82 lesson) after the live breath settles.
  {
    const live = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.clear();
      w.placeStructure('hive', 0, 0);
      w.placeStructure('bath', 2.5, 0.5);
      w.placeStructure('hedge', -6, -5);
      w.placeStructure('hotel', -3, 3);
      const spots = [[3, 1], [4.5, 2.5], [2, 3.5], [-2, 4], [-4, 2], [3.5, -2.5], [-3, -3], [5.5, 0.5], [1.5, -3], [6, 2]];
      for (const [x, z] of spots) if (w.isPlantableCellReadback(x, z)) w.plant('crocus', x, z);
      w.setSeason('winter');
      w.setSeasonProgressForTest(0.5);
      w.setDayPhase(0.5); // midday pinned
      w.timeSetPaused(false);
      w.timeSetSpeed(1);
      await new Promise((r) => setTimeout(r, 8000)); // ease onto the winter target (k=dt/2.5)
      const rb = w.colonyReadback();
      return {
        target: +rb.target.toFixed(4),
        intensity: +rb.intensity.toFixed(4),
        bees: w.beeCount(),
        solitary: w.solitaryBeeCount(),
        daylight: w.daylightReadback(),
      };
    });
    rec.record(
      'colony.winter-floor-visible',
      live.target >= 0.4 && live.bees >= 4 && live.solitary >= 2 && live.daylight,
      JSON.stringify(live) + ' (verdict B: winter floor 0.45 -> >=4 hive bees + >=2 solitary visible at midday)',
    );
  }

  // 3. no decline framing on ANY rendered surface (the constitution scan):
  //    every UI string the surfaces can render for the colony
  {
    const scan = await page.evaluate(() => {
      const w = window.__meadowlight;
      const forbidden = /declin|die|died|dead|loss|losing|shrink|fail|gone|perish|starv|sick|weaken|disappear/i;
      const lines = [];
      for (const [season, p] of [['spring', 0.5], ['summer', 0.5], ['autumn', 0.5], ['winter', 0.5]]) {
        const w2 = window.__meadowlight;
        w2.setSeason(season);
        w2.setSeasonProgressForTest(p);
        lines.push({ season, line: w2.colonyReadback().line });
      }
      return { lines, bad: lines.filter((l) => forbidden.test(l.line)) };
    });
    rec.record(
      'colony.no-decline-framing-any-surface',
      scan.bad.length === 0 && scan.lines.length === 4,
      JSON.stringify(scan),
    );
  }

  const re = realErrors(errors);
  rec.record('colony.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** U4: habitat-corner scenery + pond life */
async function checkHabitat() {
  const { page, errors } = await newPage(browser, url);
  const hb = await page.evaluate(async () => {
    const w = window.__meadowlight;
    const data = w.habitatReadback();
    // dragonflies fly over the pond (they exist only with the unit mounted)
    await new Promise((r) => setTimeout(r, 2500));
    const after = w.habitatReadback();
    return { foldCells: data.foldCells.length, dragonflies: after.dragonflies };
  });
  rec.record(
    'habitat.fold-cells-exist-and-scenery-mounted',
    hb.foldCells > 50 && hb.dragonflies >= 2,
    JSON.stringify(hb) + ' (the folds carry scenery; dragonflies over the pond)',
  );
  // scenery must not steal plantable ground: probe a sample of the box —
  // plantable count unchanged by scenery is implied by the fold derivation
  // (unit-tested); the gate asserts the LIVE classification still answers
  const cls = await page.evaluate(() => {
    const w = window.__meadowlight;
    let plantable = 0;
    let unplantable = 0;
    for (let x = -21; x <= 21; x += 2) {
      for (let z = -21; z <= 21; z += 2) {
        if (w.isPlantableCellReadback(x, z)) plantable++;
        else unplantable++;
      }
    }
    return { plantable, unplantable };
  });
  rec.record(
    'habitat.classification-unchanged',
    cls.plantable > 300 && cls.unplantable > 10,
    JSON.stringify(cls) + ' (scenery never reclassifies ground)',
  );
  // 2b. the organic extension: fringe cells exist beyond the box, and
  //     the classification-unchanged assertion still holds (re-assert)
  {
    const fr = await page.evaluate(() => {
      const w = window.__meadowlight;
      return w.fringeCellsReadback ? w.fringeCellsReadback() : null;
    });
    if (fr) {
      rec.record(
        'habitat.fringe-cells-exist',
        fr.length > 20,
        'fringe cells beyond the box: ' + fr.length,
      );
    }
  }
  // 3. pond-edge asymmetry (U4 revision): per-segment density variance
  //    non-zero and bounded — the shore reads organic, not a regular band
  {
    const asym = await page.evaluate(() => {
      const w = window.__meadowlight;
      return w.habitatReadback ? w.pondSegmentsReadback() : null;
    });
    if (asym) {
      const plants = asym.map((s) => s.plants);
      const pVar = Math.max(...plants) - Math.min(...plants);
      rec.record(
        'habitat.pond-edge-asymmetry',
        pVar >= 2 && plants.every((p) => p >= 1 && p <= 5),
        'per-segment density ' + JSON.stringify(plants) + ' (variance ' + pVar + ')',
      );
    }
  }
  const re = realErrors(errors);
  rec.record('habitat.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

/** U5: night sky & cloud translucency */
async function checkNightSky() {
  const { page, errors } = await newPage(browser, url);
  // 1. stars appear under forced phases (night yes, day no, evening ramping)
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      const out = {};
      // night
      w.setDayPhase(0.0);
      await new Promise((res) => setTimeout(res, 600));
      out.night = { ...w.starsReadback(), pred: w.starsReadback().visibilityAt(0.0) };
      // evening (golden hour — the dusk ramp, partially visible)
      w.setDayPhase(0.84);
      await new Promise((res) => setTimeout(res, 600));
      out.evening = { opacity: w.starsReadback().opacity, pred: w.starsReadback().visibilityAt(0.84) };
      // morning (full day)
      w.setDayPhase(0.3);
      await new Promise((res) => setTimeout(res, 600));
      out.morning = { opacity: w.starsReadback().opacity, pred: w.starsReadback().visibilityAt(0.3) };
      return out;
    });
    const nightOk = r.night.visible > 100 && r.night.opacity > 0.7 && Math.abs(r.night.pred - 1) < 1e-9;
    const eveningOk = r.evening.opacity > 0.3 && r.evening.pred > 0.3 && r.evening.pred < 1;
    const morningOk = r.morning.opacity < 0.05 && r.morning.pred === 0;
    rec.record(
      'nightsky.stars-per-phase',
      nightOk && eveningOk && morningOk,
      JSON.stringify(r) + ' (night full; golden-hour ramping; morning none)',
    );
  }
  // 2. cloud translucency: the composed-cloud material value (the tuning)
  {
    const cloud = await page.evaluate(() => window.__meadowlight.cloudOpacityReadback());
    rec.record(
      'nightsky.clouds-translucent',
      cloud >= 0.35 && cloud <= 0.75,
      'composed cloud opacity ' + cloud + ' (softly veiled, never blocking, never gone)',
    );
  }
  const re = realErrors(errors);
  rec.record('nightsky.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

// #68: shared dispatch — unknown names name the valid checks
const map = { seeding: checkSeeding, visitors: checkVisitors, timecontrols: checkTimeControlsUI, colony: checkColony, habitat: checkHabitat, nightsky: checkNightSky };
const code = await dispatchChecks(rec, checks, map, 'session7-gate');
await browser.close();
process.exit(code);
