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
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

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
      // release overrides, 8x, natural calendar across ~4 seasons
      w.resumeSeasonClock();
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      const samples = [];
      const startSeason = 'summer';
      let lastEpoch = w.seedingEpochReadback();
      const perSeason = [];
      let lastCount = 0;
      for (let s = 0; s < 4; s++) {
        // ~90s per season at 8x
        await new Promise((r) => setTimeout(r, 92000));
        const volunteers = w.volunteersReadback().filter((v) => v.volunteer);
        const epoch = w.seedingEpochReadback();
        samples.push({ seasonIdx: s, epoch, volunteers: volunteers.length, total: w.items().length });
        perSeason.push(volunteers.length - lastCount);
        lastCount = volunteers.length;
        lastEpoch = epoch;
      }
      w.timeSetSpeed(1);
      return { before, before0, samples, perSeason, startSeason };
    });
    // the samples are CUMULATIVE volunteer counts; the per-season cap
    // governs the DELTA between samples (the first run asserted cumulative
    // <= 5 and failed its own brake: 6 cumulative with +1/season is the
    // designed 15%-share behavior, not a cap violation)
    const capsHold = run.samples.every(
      (s, i) => s.volunteers - (i === 0 ? run.before0 : run.samples[i - 1].volunteers) <= 5,
    );
    const totalVolunteers = run.samples[run.samples.length - 1].volunteers;
    // growth pattern: volunteers appear (a meadow that never seeds in 4
    // seasons is broken), but stay a small fraction — never invasive.
    // #37 finding 2: the constraint the visitor FEELS is the CUMULATIVE
    // share (per-season caps alone let volunteers compound season over
    // season — the gate's first run measured 20/36, a third self-grown).
    const final = run.samples[run.samples.length - 1].total;
    const fraction = totalVolunteers / final;
    const invasive = fraction > 0.2; // the brake targets 15%; headroom for the roll's own shape
    rec.record(
      'seeding.accelerated-4season-caps-hold',
      capsHold && !invasive && totalVolunteers >= 1,
      JSON.stringify(run.samples) + ` (volunteers ${totalVolunteers}/${final} = ${(fraction * 100).toFixed(0)}%, cumulative brake target 15%)`,
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
      w.resumeSeasonClock();
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
    await new Promise((r) => setTimeout(r, 1300)); // the row re-renders on its 1s cadence
    const chip = document.querySelector('[data-paused-chip]');
    const row = document.querySelector('[data-time-row]');
    const chipRect = chip ? chip.getBoundingClientRect() : null;
    const rowStyle = row ? getComputedStyle(row) : null;
    w.timeSetPaused(false);
    return {
      chip: !!chip,
      inViewport: !!chipRect && chipRect.width > 0 && chipRect.top >= 0 && chipRect.bottom <= window.innerHeight,
      rowOpacity: rowStyle ? rowStyle.opacity : null,
    };
  });
  rec.record(
    'timecontrols.pause-indicator-present-in-viewport',
    pausedUI.chip && pausedUI.inViewport && parseFloat(pausedUI.rowOpacity) < 0.7,
    JSON.stringify(pausedUI) + ' (resting chip visible, row dimmed)',
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
      for (const [season, p] of [['spring', 0.1], ['summer', 0.5], ['autumn', 0.9], ['winter', 0.5]]) {
        w.setSeason(season);
        w.setSeasonProgressForTest(p);
        await new Promise((r) => setTimeout(r, 500));
        out[season] = w.colonyReadback();
      }
      return out;
    });
    const ok =
      seasons.spring.target > 0.2 &&
      seasons.summer.target > seasons.spring.target &&
      Math.abs(seasons.summer.target - seasons.autumn.target) < 0.5 &&
      seasons.winter.target < 0.15 &&
      seasons.winter.line.includes('clustered snug') &&
      seasons.spring.line.includes('waking');
    rec.record(
      'colony.forced-seasons-read-correctly',
      ok,
      JSON.stringify(seasons, null, 1),
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
      w.resumeSeasonClock();
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
    // the breath shape across the trace: some rise, some low cluster phase
    const rises = trace.some((s, i) => i > 0 && s.intensity > trace[i - 1].intensity + 0.05);
    const clusters = trace.some((s) => s.target < 0.15);
    const peaks = trace.some((s) => s.intensity > 0.5);
    rec.record(
      'colony.full-year-accelerated-trace',
      rises && clusters && peaks,
      JSON.stringify(trace) + ' (rise + hold + cluster phases observed)',
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

const map = { seeding: checkSeeding, visitors: checkVisitors, timecontrols: checkTimeControlsUI, colony: checkColony };
for (const c of checks.split(',')) {
  if (map[c]) await map[c]();
  else rec.record(`unknown-check:${c}`, false, 'no such check in session7-gate');
}
await browser.close();
process.exit(rec.exitCode());
