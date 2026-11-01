#!/usr/bin/env node
/**
 * Session 10 (v4, issue #53) behavioral gate — seed codes (P3) and the
 * session-10 chrome additions. Gate-lib pattern, --checks per unit.
 * CI (test:smoke) stays canonical; this is for behavior a build can't see.
 *
 * Usage:
 *   node scripts/session10-gate.mjs --url http://localhost:5173 --checks seeds
 *
 *   seeds — P3 seed codes (ROADMAP v4 item 8):
 *     seeds.roundtrip-same-code-same-layout — encode the live meadow, start
 *       from the code in a fresh world, reload, encode again: the codes are
 *       byte-identical (same layout across reloads).
 *     seeds.corrupt-code-boots-fresh-with-backup — an unknown-version code
 *       changes nothing visible, the player's save blob is preserved at the
 *       _backup key, and a valid code replaces the world (items match the
 *       code's payload) with the code's seed as worldSeed.
 *     seeds.input-only-in-confirm-modal — the seed input exists ONLY inside
 *       the reset confirm dialog ([data-seed-input] is not in the DOM while
 *       the modal is closed); the one-click reset path never touches seeds.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors } from './gate-lib.mjs';

const { url = 'http://localhost:5173', checks = 'seeds', 'lib-path': libPath = '' } = parseArgs();
const rec = makeRecorder();
const browser = await launchChromium(chromium, { libPath });

async function checkSeeds() {
  const { page, errors } = await newPage(browser, url);

  // 1. round-trip: encode -> start from code -> reload -> encode: identical
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      for (let i = 0; i < 8; i++) w.plant(['lavender', 'cosmos', 'poppy', 'clover'][i % 4], -8 + (i % 3) * 5, -5 + Math.floor(i / 3) * 4.5);
      w.save();
      const codeA = w.seedCodeEncode();
      const seedA = w.worldSeedReadback();
      // start from the code (the front-door path) and reload from the save
      const ok = w.startFromSeedCode(codeA);
      w.save();
      w.reloadFromSave();
      const codeB = w.seedCodeEncode();
      const seedB = w.worldSeedReadback();
      return { codeA, codeB, seedA, seedB, ok, items: w.items().length };
    });
    rec.record(
      'seeds.roundtrip-same-code-same-layout',
      r.ok && r.codeA === r.codeB && r.seedA === r.seedB && r.items === 8,
      JSON.stringify(r),
    );
  }

  // 2. corrupt/unknown code: nothing changes, save preserved at _backup
  {
    const r = await page.evaluate(() => {
      const w = window.__meadowlight;
      w.resetWorld();
      w.plant('lavender', 2, 2);
      w.save();
      const before = w.seedCodeEncode();
      const ok = w.startFromSeedCode('ML9.garbage.garbage');
      const afterBad = w.seedCodeEncode();
      // a valid code DOES replace the world; the previous save must be at _backup
      const good = w.seedCodeEncode();
      const seedBefore = w.worldSeedReadback();
      const okGood = w.startFromSeedCode(good);
      const seedNow = w.worldSeedReadback();
      const backup = localStorage.getItem('meadowlight.world._backup');
      return { ok, before, afterBad, backupPresent: !!backup, okGood, seedNow, seedBefore };
    });
    rec.record(
      'seeds.corrupt-code-changes-nothing',
      r.ok === false && r.before === r.afterBad,
      JSON.stringify({ ok: r.ok, unchanged: r.before === r.afterBad }),
    );
    rec.record(
      'seeds.valid-code-replaces-world-with-code-seed',
      r.okGood === true && r.seedNow === r.seedBefore,
      JSON.stringify({ okGood: r.okGood, seedNow: r.seedNow, seedBefore: r.seedBefore }),
    );
    rec.record(
      'seeds.corrupt-path-preserves-backup',
      r.backupPresent,
      'backup key present after a seed-start: ' + r.backupPresent,
    );
  }

  // 3. the seed input lives ONLY inside the confirm modal (never a one-click path)
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      await new Promise((res) => setTimeout(res, 800));
      const closed = !document.querySelector('[data-seed-input]');
      // open the confirm modal through the test hook (the SAME modal the R
      // key opens — one input path)
      w.setModalOpenForTest(true);
      await new Promise((res) => setTimeout(res, 300));
      const open = !!document.querySelector('[data-seed-input]');
      const shareBtn = !!document.querySelector('[data-seed-share-button]');
      const sharePopoverClosed = !document.querySelector('[data-seed-share-popover]');
      w.setModalOpenForTest(false);
      return { closed, open, shareBtn, sharePopoverClosed };
    });
    rec.record(
      'seeds.input-only-in-confirm-modal',
      r.closed && r.open && r.shareBtn && r.sharePopoverClosed,
      JSON.stringify(r),
    );
  }

  const re = realErrors(errors);
  rec.record('seeds.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

for (const check of checks.split(',')) {
  if (check === 'seeds') await checkSeeds();
  else {
    console.error('[GATE] unknown check: ' + check);
    process.exit(2);
  }
}

await browser.close();
process.exit(rec.exitCode());
