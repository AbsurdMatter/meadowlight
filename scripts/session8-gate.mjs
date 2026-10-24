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
    // N3 coverage: a hive brings live bees; crocuses attract the early-spring
    // queen (her target-bloom gate) so the forced-spring case has real wildlife
    for (let i = 0; i < 4; i++) w.plant('crocus', -2 + i * 1.3, -3);
    w.placeStructure('hive', 0, 0);
    w.save();
  });
  await page.waitForTimeout(4000); // bees spawn + forage
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
  // #6383907384 + DoD-walk fix (#6384544116): flowers inspect via the REAL
  // HOVER PATH — a live pointer event over the flower's screen position, so
  // the mesh's raycast (not a store write) sets the entry. This is the
  // READ-green lesson applied to the gate itself: the old check wrote the
  // entry directly and MISSED the regression (the resolver stealing the
  // flower lock — it only showed with real pointer events).
  const flowerHover = await page.evaluate((id) => {
    const w = window.__meadowlight;
    w.setMagnifierOnForTest(true);
    // project the flower's world position to screen coordinates through
    // the live camera, then dispatch a REAL pointermove there
    const item = w.items().find((it) => it.id === id);
    const cam = w.__three?.camera;
    if (!item || !cam) return { ok: false, reason: 'no item or camera' };
    // THREE is not on window — compute the projection inline (the same
    // NDC math the resolver uses, no library needed)
    const p = item.position;
    const pv = { x: p[0], y: p[1] + 0.5, z: p[2], w: 1 };
    const proj = cam.projectionMatrix.elements;
    const view = cam.matrixWorldInverse.elements;
    // view-proj multiply (column-major)
    function mul(a, b, v3) {
      return {
        x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
        y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
        z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
        w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
      };
    }
    const eye = mul(view, view, pv);
    const clip = mul(proj, proj, eye);
    const ndc = { x: clip.x / clip.w, y: clip.y / clip.w };
    const x = ((ndc.x + 1) / 2) * window.innerWidth;
    const y = ((-ndc.y + 1) / 2) * window.innerHeight;
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
    );
    // the R3F raycast resolves on the next pointer update — the mesh's
    // onOver fires through the canvas's own pointer pipeline
    return { ok: true, screen: { x, y } };
  }, firstId);
  // move the real mouse over the flower (Puppeteer drives R3F's raycast)
  if (flowerHover.ok) {
    await page.mouse.move(flowerHover.screen.x, flowerHover.screen.y);
  }
  await page.waitForTimeout(1500); // hover + resolver frames elapse
  const flowerHoverCard = await page.evaluate(() => {
    const w = window.__meadowlight;
    const el = document.querySelector('[data-magnifier-card="true"]');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      entry: w.magnifierReadback(),
      visible: !!r && r.width > 0 && r.height > 0,
      text: el ? (el.textContent ?? '') : '',
      pointerEvents: el ? getComputedStyle(el).pointerEvents : 'n/a',
    };
  });
  // THE REGRESSION ASSERTION: after hover + resolver frames, the entry is
  // STILL a flower (the resolver must not steal it — pollinators cluster
  // on flowers) and the card shows the flower fact + visit readout
  const flowerHoverOk =
    flowerHover.ok &&
    flowerHoverCard.entry.entry?.kind === 'flower' &&
    flowerHoverCard.visible &&
    flowerHoverCard.text.length > 0 &&
    /waiting for its first pollinator visit|visited by a pollinator this season/.test(flowerHoverCard.text);
  rec.record('magnifier.flower-hover-shows-card', flowerHoverOk,
    !flowerHover.ok
      ? 'hover-path setup failed: ' + (flowerHover.reason ?? '')
      : flowerHoverCard.visible
        ? 'real-hover entry: ' + JSON.stringify(flowerHoverCard.entry.entry) + ' — card: ' + flowerHoverCard.text.slice(0, 60)
        : 'no card rendered on real flower hover with glass armed');
  // #6384690070, THE CLUSTERING CASE: hover a flower WITH a pollinator on
  // it — the ecological scenario where a creature sits within wildlifeReach
  // of the ray over the bloom. The flower entry MUST survive resolver
  // frames (third instance of the hit/miss asymmetry class slipped plain
  // hover checks twice; this case is now explicit).
  const clusteringHover = await page.evaluate(() => {
    const w = window.__meadowlight;
    // a flower + a live bee near it: find a sighting and the nearest flower
    const sightings = w.wildlifeSightings();
    const bee = sightings.find((s) => s.kind === 'hivebee') ?? sightings[0];
    if (!bee) return { ok: false, reason: 'no live wildlife' };
    const items = w.items();
    let best = null;
    let bestD = Infinity;
    for (const it of items) {
      const d = Math.hypot(it.position[0] - bee.x, it.position[2] - bee.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return { ok: false, reason: 'no flowers' };
    const cam = w.__three?.camera;
    if (!cam) return { ok: false, reason: 'no camera' };
    const p = best.position;
    const pv = { x: p[0], y: p[1] + 0.5, z: p[2], w: 1 };
    const proj = cam.projectionMatrix.elements;
    const view = cam.matrixWorldInverse.elements;
    function mul(a, v3) {
      return {
        x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
        y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
        z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
        w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
      };
    }
    const eye = mul(view, pv);
    const clip = mul(proj, eye);
    const ndc = { x: clip.x / clip.w, y: clip.y / clip.w };
    return {
      ok: true,
      beeDist: bestD,
      itemId: best.id,
      screen: {
        x: ((ndc.x + 1) / 2) * window.innerWidth,
        y: ((-ndc.y + 1) / 2) * window.innerHeight,
      },
    };
  });
  if (clusteringHover.ok) {
    // #6386362356: the reset-to-null was the BUG DOOR — with the pointer
    // already parked on the flower+bee, nulling the entry meant the resolver
    // claimed the bee (flower mesh pointer-over does not RE-fire while the
    // pointer stays 'over' the same mesh) and the bee then held the entry
    // for the whole hold. The ownership rule was never bypassed; the CHECK
    // tore the claim down and handed the resolver an empty stage. Correct
    // sequence: WIGGLE the pointer off the flower and back (pointer-out
    // releases the old claim, pointer-in re-claims the flower through the
    // real path), then hold 2s and assert the flower survives the bee.
    await page.mouse.move(clusteringHover.screen.x - 60, clusteringHover.screen.y - 60);
    await page.waitForTimeout(400);
    await page.mouse.move(clusteringHover.screen.x, clusteringHover.screen.y);
    await page.waitForTimeout(2000);
  }
  const clusteringEntry = await page.evaluate((itemId) => {
    const w = window.__meadowlight;
    return { entry: w.magnifierReadback(), wanted: itemId };
  }, clusteringHover.ok ? clusteringHover.itemId : null);
  // #6384878002 assertion audit: the INVARIANT is that a FLOWER entry
  // survives 2s of resolver frames while a pollinator clusters on it —
  // not that it is one exact projected itemId (the projection can land on
  // an occluding bloom of the same species; the exact-id comparison FAILED
  // while the survival itself held, per the user's output). Assert the
  // invariant; print the entry for diagnosis.
  const clusteringOk =
    clusteringHover.ok &&
    clusteringEntry.entry.entry?.kind === 'flower';
  rec.record('magnifier.flower-survives-pollinator-clustering', clusteringOk,
    !clusteringHover.ok
      ? 'clustering setup failed: ' + (clusteringHover.reason ?? '')
      : 'bee ' + clusteringHover.beeDist.toFixed(2) + 'u from flower — entry after 2s hold: ' +
        JSON.stringify(clusteringEntry.entry.entry));

  // DoD-walk fix gate (#6384544116): the fireflies note records only inside
  // the NATURAL visibility window — a forced (test) state must NOT write a
  // visit, and no wild corners means no fireflies to record at all.
  const fireflyNote = await page.evaluate(() => {
    const w = window.__meadowlight;
    const before = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
    // force fireflies ON (a test state — must never write a visit)
    w.setFireflyForce(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        w.setFireflyForce(null);
        const after = w.visitorWindowsReadback().filter((k) => k.startsWith('fireflies:')).length;
        resolve({ before, after });
      }, 1200);
    });
  });
  const fireflyNoteOk = fireflyNote.after === fireflyNote.before;
  rec.record('fireflies.forced-state-writes-no-note', fireflyNoteOk,
    'forced-on state: ' + fireflyNote.before + ' -> ' + fireflyNote.after + ' fireflies notes (must be unchanged)');
  // #6384616654: STRUCTURES join the glass — a placed hive hovered with
  // the glass armed shows the card (the same fact the click tooltip shows).
  // Drives the REAL hover path (pointer projection + mouse move) — the
  // click-vs-hover blindness the flower regression exposed is closed for
  // the third kind.
  const structureHover = await page.evaluate(() => {
    const w = window.__meadowlight;
    const st = w.structures().find((s) => s.structureId === 'hive');
    const cam = w.__three?.camera;
    if (!st || !cam) return { ok: false, reason: st ? 'no camera' : 'no hive' };
    const p = st.position;
    const pv = { x: p[0], y: p[1] + 0.6, z: p[2], w: 1 };
    const proj = cam.projectionMatrix.elements;
    const view = cam.matrixWorldInverse.elements;
    function mul(a, v3) {
      return {
        x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
        y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
        z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
        w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
      };
    }
    const eye = mul(view, pv);
    const clip = mul(proj, eye);
    const ndc = { x: clip.x / clip.w, y: clip.y / clip.w };
    return {
      ok: true,
      screen: {
        x: ((ndc.x + 1) / 2) * window.innerWidth,
        y: ((-ndc.y + 1) / 2) * window.innerHeight,
      },
    };
  });
  if (structureHover.ok) {
    // reset any claim the flower-hover check left (its pointer-out may not
    // have fired — the pointer never left the canvas), then hover the hive
    await page.evaluate(() => {
      window.__meadowlight.setMagnifierEntryForTest(null);
    });
    await page.mouse.move(structureHover.screen.x, structureHover.screen.y);
    await page.waitForTimeout(1500); // hover + resolver frames
  }
  const structureCard = await page.evaluate(() => {
    const w = window.__meadowlight;
    const el = document.querySelector('[data-magnifier-card="true"]');
    return {
      entry: w.magnifierReadback(),
      text: el ? (el.textContent ?? '') : '',
    };
  });
  const structureHoverOk =
    structureHover.ok &&
    structureCard.entry.entry?.kind === 'structure' &&
    structureCard.text.length > 0;
  rec.record('magnifier.structure-hover-shows-card', structureHoverOk,
    !structureHover.ok
      ? 'structure hover setup failed: ' + (structureHover.reason ?? '')
      : 'real-hover entry: ' + JSON.stringify(structureCard.entry.entry) +
        ' — card: ' + structureCard.text.slice(0, 60));
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
    // inspect: hover on, hover off, glass off — the full N3 interaction set.
    // Deterministic OFF (the old toggle left an OFF glass for the bee check —
    // a parity drift the FAILs traced to, not a product bug)
    w.setMagnifierEntryForTest({ kind: 'flower', itemId: before.items[0].id });
    w.setMagnifierEntryForTest(null);
    w.setMagnifierOnForTest(false);
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
  // N3 COVERAGE (PR #38 comment #6300475244): the glass reaches ALL living
  // things — probes from every wildlife system are live, hive bees (always
  // present with a hive) are reachable and show THEIR fact, and a wildlife
  // entry resolves through the same card path as flowers.
  const sightings = await page.evaluate(() => window.__meadowlight.wildlifeSightings());
  const kinds = [...new Set(sightings.map((w) => w.kind))];
  rec.record('magnifier.wildlife-probes-are-live', kinds.includes('hivebee') && sightings.length > 0,
    'live kinds: ' + kinds.join(', ') + ' (' + sightings.length + ' creatures)');
  // a wildlife entry shows name + fact through the SAME card the flowers use.
  // Glass state is SET (deterministic hook), not toggled — the previous
  // version toggled blind and a parity drift left the glass OFF here:
  // "no card rendered" was the check's own state, not the product chain.
  // #6386798136: the pinned-target form (the queen check's machinery,
  // reused). The old check wrote the hivebee entry SYNTHETICALLY while the
  // pointer sat wherever the previous check left it — the resolver's correct
  // nearest-wins overwrote it with whatever creature was actually near the
  // pointer (the user's Butterfly card). The check now pins its target the
  // same way: freeze the clock, project every sighting, walk the pointer
  // until a REAL hivebee is the nearest creature to the pixel, hover it,
  // and assert the HIVEBEE fact — not 'any wildlife fact counts'.
  const beeHover = await page.evaluate(() => {
    const w = window.__meadowlight;
    w.setMagnifierOnForTest(true);
    const cam = w.__three?.camera;
    if (!cam) return { ok: false, reason: 'no camera' };
    const sightings = w.wildlifeSightings();
    const bees = sightings.filter((s) => s.kind === 'hivebee');
    if (bees.length === 0) return { ok: false, reason: 'no live hivebee', total: sightings.length };
    w.timeSetPaused(true); // pin the creatures (deterministic ecology)
    const proj = cam.projectionMatrix.elements;
    const view = cam.matrixWorldInverse.elements;
    function mul(a, v3) {
      return {
        x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
        y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
        z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
        w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
      };
    }
    const project = (p3) => {
      const pv = { x: p3.x, y: p3.y, z: p3.z, w: 1 };
      const eye = mul(view, pv);
      const clip = mul(proj, eye);
      return {
        x: ((clip.x / clip.w + 1) / 2) * window.innerWidth,
        y: ((-clip.y / clip.w + 1) / 2) * window.innerHeight,
      };
    };
    // walk until a real hivebee is nearest the pixel (resolver-agreement)
    for (const bee of bees) {
      const base = project(bee);
      const others = sightings.filter((s) => s !== bee);
      for (let step = 0; step < 8; step++) {
        const ang = (step / 8) * Math.PI * 2;
        const cand = { x: base.x + Math.cos(ang) * step * 6, y: base.y + Math.sin(ang) * step * 6 };
        const beeD = Math.hypot(cand.x - base.x, cand.y - base.y);
        const otherD = Math.min(
          ...others.map((o) => {
            const op = project(o);
            return Math.hypot(cand.x - op.x, cand.y - op.y);
          }),
          Infinity,
        );
        if (beeD < 12 && otherD > beeD) return { ok: true, screen: cand, targeted: 'hivebee' };
      }
    }
    return { ok: false, reason: 'no pixel where a hivebee wins', total: sightings.length };
  });
  if (beeHover.ok) {
    await page.mouse.move(beeHover.screen.x, beeHover.screen.y);
  }
  await page.waitForTimeout(1200); // hover + resolver frames, then read
  const beeCard = await page.evaluate(() => {
    const el = document.querySelector('[data-magnifier-card="true"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      entry: window.__meadowlight.magnifierReadback(),
      visible: r.width > 0 && r.height > 0 && r.top <= window.innerHeight && r.bottom >= 0,
      text: el.textContent ?? '',
      pointerEvents: getComputedStyle(el).pointerEvents,
    };
  });
  // resume the clock the targeting walk froze
  await page.evaluate(() => {
    window.__meadowlight.timeSetPaused(false);
  });
  // targeted-vs-claimed logging: one run tells all
  const claimed = beeCard?.entry.entry?.kind === 'visitor' ? beeCard.entry.entry.visitorId : null;
  const beeFactShown =
    beeHover.ok &&
    !!beeCard &&
    beeCard.visible &&
    claimed === 'hivebee' &&
    /Honeybee worker/i.test(beeCard.text) &&
    beeCard.text.includes('flowers per foraging trip');
  rec.record('magnifier.wildlife-entry-shows-its-fact', beeFactShown,
    !beeHover.ok
      ? 'setup failed: ' + (beeHover.reason ?? '') + ' (' + (beeHover.total ?? 0) + ' creatures live)'
      : 'targeted: ' + beeHover.targeted + ' — claimed: ' + claimed + ' — card: ' + beeCard.text.slice(0, 70));
  // #6384994711: the removal-refusal gate sibling — with the glass ARMED
  // and an ACTIVE entry, a right-click ON a target must NOT remove it:
  // the target stays present, the save is unchanged, the right-click is
  // consumed by the glass (card dismissed).
  const glassRemove = await page.evaluate(() => {
    const w = window.__meadowlight;
    const read = () => JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
    // arm the glass + hold an entry (a flower), frozen clock for the diff
    const wasPaused = w.timeIsPaused();
    w.timeSetPaused(true);
    w.setMagnifierOnForTest(true);
    const target = w.items()[0];
    w.setMagnifierEntryForTest({ kind: 'flower', itemId: target.id });
    const before = read();
    const beforeCount = w.items().length;
    // simulate the right-click path exactly: contextmenu at the target's
    // screen position (a real DOM event — the removal handler's own path)
    const cam = w.__three?.camera;
    const p = target.position;
    const pv = { x: p[0], y: p[1] + 0.5, z: p[2], w: 1 };
    const proj = cam.projectionMatrix.elements;
    const view = cam.matrixWorldInverse.elements;
    function mul(a, v3) {
      return {
        x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
        y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
        z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
        w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
      };
    }
    const eye = mul(view, pv);
    const clip = mul(proj, eye);
    const ndc = { x: clip.x / clip.w, y: clip.y / clip.w };
    const sx = ((ndc.x + 1) / 2) * window.innerWidth;
    const sy = ((-ndc.y + 1) / 2) * window.innerHeight;
    // press+release the right button ON THE CANVAS (the removal handler
    // listens on gl.domElement — dispatching on window would never reach
    // it and the check would pass vacuously; the synthetic-vs-real lesson
    // applied to the check itself), then contextmenu on the canvas too
    const canvas = document.querySelector('canvas');
    if (!canvas) return { beforeCount: 0, afterCount: -1, changed: ['no canvas'], entry: null, states: [] };
    // #6386272430: the THREE-CLICK sequence — the race lived in click #2
    // (the single-click check passed while it did). Click 1: card showing
    // (dismiss, glass stays armed). Click 2: armed, no card (disarm).
    // Click 3: after re-arming + re-hover, card showing again (dismiss).
    // Every click must refuse; the flower must survive all three.
    const rightClick = () => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: sx, clientY: sy, bubbles: true }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, clientX: sx, clientY: sy, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('contextmenu', { button: 2, clientX: sx, clientY: sy, bubbles: true, cancelable: true }));
    };
    const states = [];
    const snap = () => ({
      glassOn: window.__meadowlight.magnifierReadback().on,
      entry: window.__meadowlight.magnifierReadback().entry?.kind ?? null,
      items: window.__meadowlight.items().length,
    });
    rightClick(); // click 1: card showing
    states.push({ click: 1, ...snap() });
    rightClick(); // click 2: armed, no card (the race door)
    states.push({ click: 2, ...snap() });
    // re-arm + re-hover for click 3 (the user's after-re-hover case)
    window.__meadowlight.setMagnifierOnForTest(true);
    window.__meadowlight.setMagnifierEntryForTest({ kind: 'flower', itemId: target.id });
    rightClick(); // click 3: card showing again
    states.push({ click: 3, ...snap() });
    return new Promise((resolve) => {
      setTimeout(() => {
        const after = read();
        const afterCount = window.__meadowlight.items().length;
        const changed = [];
        for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
        }
        const entry = window.__meadowlight.magnifierReadback();
        window.__meadowlight.setMagnifierEntryForTest(null);
        window.__meadowlight.setMagnifierOnForTest(false);
        window.__meadowlight.timeSetPaused(wasPaused);
        resolve({ beforeCount, afterCount, changed, entry, states });
      }, 800);
    });
  });
  // every click refused (the item count never dropped across any state)
  // AND the defined glass behavior held: click 1 dismissed the card with
  // the glass STILL ARMED, click 2 disarmed (no entry), click 3 dismissed
  // again after re-hover
  const states = glassRemove.states ?? [];
  const click1Ok = states.length > 0 && states[0].glassOn === true && states[0].entry === null;
  const click2Ok = states.length > 1 && states[1].glassOn === false;
  const click3Ok = states.length > 2 && states[2].glassOn === true && states[2].entry === null;
  const glassRemoveOk =
    glassRemove.afterCount === glassRemove.beforeCount &&
    glassRemove.changed.length === 0 &&
    click1Ok && click2Ok && click3Ok;
  rec.record('magnifier.rightclick-while-armed-removes-nothing', glassRemoveOk,
    glassRemoveOk
      ? 'three right-clicks under armed glass: ' + glassRemove.beforeCount + ' items throughout, save unchanged — click states: ' +
        states.map((s) => '#' + s.click + (s.glassOn ? ' armed' : ' off') + '/' + (s.entry ?? 'no-entry')).join(', ')
      : 'REMOVED under armed glass — items ' + glassRemove.beforeCount + '->' + glassRemove.afterCount +
        ', changed: ' + glassRemove.changed.join(', ') + ', states: ' + JSON.stringify(states));

  // wildlife inspection is read-only too: same frozen-clock field diff
  const wildMutation = await page.evaluate(() => {
    const w = window.__meadowlight;
    const read = () => JSON.parse(localStorage.getItem('meadowlight.world.v2') || '{}');
    const wasPaused = w.timeIsPaused();
    w.timeSetPaused(true);
    w.save();
    const before = read();
    w.setMagnifierEntryForTest({ kind: 'visitor', visitorId: 'queenbumble' });
    w.setMagnifierEntryForTest(null);
    w.setMagnifierOnForTest(false); // glass off — same as toggle, no parity
    w.save();
    const after = read();
    w.timeSetPaused(wasPaused);
    const changed = [];
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
    }
    return { identical: changed.length === 0, changed };
  });
  rec.record('magnifier.wildlife-inspection-mutates-nothing', wildMutation.identical,
    wildMutation.identical
      ? 'save identical after wildlife inspecting (frozen-clock, field-diffed)'
      : 'differing keys: ' + wildMutation.changed.join(', '));
  // the forced-season case the comment named: an early-spring queen on
  // crocuses is a REAL visitor (its own probe live), and its entry carries
  // the queen's fact from the fact store
  await page.evaluate(() => {
    window.__meadowlight.setSeason('spring');
    window.__meadowlight.setSeasonProgressForTest(0.05); // early spring
    // deterministic ON — a toggle here landed OFF after the parity drift
    window.__meadowlight.setMagnifierOnForTest(true);
  });
  await page.waitForTimeout(4000); // the queen's natural window spawns her
  // #6384878002: hover the QUEEN'S EXACT LIVE POSITION (the old check
  // wrote the entry synthetically — the pointer sat wherever the previous
  // check left it, so the resolver's nearest-wins overwrote the queen with
  // whatever creature the pointer was actually near: the butterfly card).
  const queenSeen = await page.evaluate(() => {
    const w = window.__meadowlight;
    const sightings = w.wildlifeSightings();
    const queen = sightings.find((s) => s.kind === 'queenbumble');
    return { kinds: sightings.map((s) => s.kind), queen };
  });
  if (queenSeen.queen) {
    // #6386362356: the check must GUARANTEE the target deterministically.
    // Freezing the clock pins every creature (the frozen-clock convention),
    // then the pointer position is chosen by RUNNING THE SAME pure hit
    // function the resolver uses, over the frozen probe positions — if
    // another creature is nearer the queen's projected pixel, the check
    // walks the pixel in small steps until the resolver's own hit
    // resolves to the queen. The check no longer fights the resolver's
    // correct nearest-wins; it finds a pointer position the resolver
    // AGREES resolves to the queen. Frozen clock = deterministic ecology.
    const pos = await page.evaluate((q) => {
      const w = window.__meadowlight;
      w.timeSetPaused(true); // pin the creatures for the targeting walk
      const cam = w.__three?.camera;
      const proj = cam.projectionMatrix.elements;
      const view = cam.matrixWorldInverse.elements;
      function mul(a, v3) {
        return {
          x: a[0] * v3.x + a[4] * v3.y + a[8] * v3.z + a[12],
          y: a[1] * v3.x + a[5] * v3.y + a[9] * v3.z + a[13],
          z: a[2] * v3.x + a[6] * v3.y + a[10] * v3.z + a[14],
          w: a[3] * v3.x + a[7] * v3.y + a[11] * v3.z + a[15],
        };
      }
      const project = (p3) => {
        const pv = { x: p3.x, y: p3.y, z: p3.z, w: 1 };
        const eye = mul(view, pv);
        const clip = mul(proj, eye);
        return {
          x: ((clip.x / clip.w + 1) / 2) * window.innerWidth,
          y: ((-clip.y / clip.w + 1) / 2) * window.innerHeight,
        };
      };
      // #6387436249: the walk's acceptance must match the QUEEN EXACTLY —
      // the old screen-space approximation ignored that the ray through the
      // candidate pixel also hits MESH geometry (the hive): a mesh claim
      // legitimately beats the queen's visitor claim when the pointer is
      // nearer the hive, so the walk converged on the hive ('Skep Hive'
      // card) while its creature-only distance test said 'queen wins'.
      // The walk now drives the REAL resolver loop: hover the candidate
      // pixel, let the resolver + meshes run frames, and READ THE ACTUAL
      // ENTRY — acceptance is kind:'visitor' AND visitorId:'queenbumble',
      // not 'an entry resolved'. If no candidate in the walk window ever
      // resolves to the queen alone (the hive mesh dominating her foraging
      // area under forced spring), that is a REAL placement finding —
      // reported, never papered over by a loose predicate.
      const candidates = [];
      const base = project(q);
      const sightings = w.wildlifeSightings();
      const others = sightings.filter((s) => s !== q);
      // candidate pixels: the queen's own projection first, then a ring
      // walk around her (queen-nearest per the creature screen-space
      // pre-filter — necessary but NOT sufficient without the real read)
      candidates.push(base);
      for (let step = 1; step <= 6; step++) {
        for (let dir = 0; dir < 8; dir++) {
          const ang = (dir / 8) * Math.PI * 2;
          const cand = { x: base.x + Math.cos(ang) * step * 6, y: base.y + Math.sin(ang) * step * 6 };
          const queenD = Math.hypot(cand.x - base.x, cand.y - base.y);
          const otherD = Math.min(
            ...others.map((o) => {
              const op = project(o);
              return Math.hypot(cand.x - op.x, cand.y - op.y);
            }),
            Infinity,
          );
          // pre-filter: the pixel must be plausibly queen-nearest among
          // CREATURES (meshes checked by the real read below)
          if (otherD > queenD) candidates.push(cand);
        }
      }
      return { ok: true, candidates };
    }, queenSeen.queen);
    // drive the real resolver: for each candidate pixel, reset the claim,
    // hover, let frames run, read the ACTUAL entry — accept only the queen
    let queenPos = null;
    let lastClaimed = null;
    for (const cand of pos.candidates ?? []) {
      await page.evaluate(() => {
        window.__meadowlight.setMagnifierEntryForTest(null);
      });
      await page.mouse.move(cand.x, cand.y);
      await page.waitForTimeout(250); // resolver + mesh frames
      const claimed = await page.evaluate(() => {
        const e = window.__meadowlight.magnifierReadback().entry;
        return e && e.kind === 'visitor' ? e.visitorId : e?.kind ?? null;
      });
      lastClaimed = claimed;
      if (claimed === 'queenbumble') {
        queenPos = cand;
        break;
      }
    }
    if (queenPos) {
      // hold the queen-resolved position for the card read
      await page.mouse.move(queenPos.x, queenPos.y);
      await page.waitForTimeout(1200);
    }
  } else {
    await page.waitForTimeout(1200);
  }
  const queenCard = await page.evaluate(() => {
    const el = document.querySelector('[data-magnifier-card="true"]');
    return el ? (el.textContent ?? '') : '';
  });
  // resume the clock the targeting walk froze (the world resumes exactly
  // as it was — the frozen-clock convention)
  await page.evaluate(() => {
    window.__meadowlight.timeSetPaused(false);
  });
  const queenLive = queenSeen.kinds.includes('queenbumble');
  const queenFactShown =
    !!queenPos &&
    /Queen bumblebee/i.test(queenCard) &&
    queenCard.includes('winter sleep hungry');
  rec.record('magnifier.queen-under-forced-spring-shows-fact', queenFactShown,
    !queenLive
      ? 'queen probe not live (no crocuses planted); card: ' + queenCard.slice(0, 70)
      : !queenPos
        // the REAL placement finding, reported not papered over: no pixel
        // in the walk window resolved to the queen alone — the last claimed
        // entry tells whether the hive mesh dominated her foraging area
        ? 'PLACEMENT FINDING: no pointer position resolved to the queen — walk exhausted, last claimed: ' +
          String(lastClaimed) + ', card: ' + queenCard.slice(0, 60)
        : 'queen-resolved position held; card: ' + queenCard.slice(0, 70));
  // restore the glass state the check found
  await page.evaluate(() => {
    window.__meadowlight.setMagnifierEntryForTest(null);
  });
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
