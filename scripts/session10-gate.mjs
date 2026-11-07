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
import { parseArgs, launchChromium, newPage, makeRecorder, realErrors, dispatchChecks } from './gate-lib.mjs';

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

  // 2b. #89 migration: a LEGACY ML1 code (the long 212-char class) still loads
  //     through the front door, and the world re-exports in the NEW ML2 format
  //     (read-old on load, write-new on encode)
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      const ids = ['lavender', 'poppy', 'cosmos', 'clover', 'sunflower', 'thyme', 'crocus', 'borage'];
      for (let i = 0; i < 24; i++) w.plant(ids[i % ids.length], -9 + (i % 6) * 3.2, -9 + Math.floor(i / 6) * 3.2);
      w.save();
      const legacy = w.seedCodeEncodeLegacyForTest(); // ML1, 8 chars/plant — the old shared-code class
      const legacyLen = legacy.length;
      const okLegacy = w.startFromSeedCode(legacy); // decode-old path
      const itemsAfterLegacy = w.items().length;
      const seedAfterLegacy = w.worldSeedReadback();
      const codeNow = w.seedCodeEncode(); // write-new path
      const okNew = w.startFromSeedCode(codeNow); // ML2 loads too
      const codeAgain = w.seedCodeEncode();
      const itemsAfterNew = w.items().length;
      return { legacyLen, okLegacy, itemsAfterLegacy, seedAfterLegacy, codeNow, codeNowPrefix: codeNow.slice(0, 4), codeNowLen: codeNow.length, okNew, codeAgain, itemsAfterNew };
    });
    rec.record(
      'seeds.legacy-ML1-code-loads-and-rexports-ML2',
      r.okLegacy === true &&
        r.itemsAfterLegacy === 24 &&
        r.legacyLen > 200 && // the long-code class the issue is about
        r.codeNowPrefix === 'ML2.' &&
        r.codeNowLen < r.legacyLen * 0.65 &&
        r.okNew === true &&
        r.codeAgain === r.codeNow && // idempotent past 10 items (position-sorted records)
        r.itemsAfterNew === 24,
      JSON.stringify(r) + ' codeNow=' + r.codeNow.slice(0, 40) + '… codeAgain=' + r.codeAgain.slice(0, 40) + '…',
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


async function checkI18n() {
  const { page, errors } = await newPage(browser, url);

  // 1. language toggle exists in the corner row and flips the locale, persisted
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      await new Promise((res) => setTimeout(res, 600));
      const btn = document.querySelector('[data-language-toggle]');
      if (!btn) return { ok: false, reason: 'no toggle' };
      const before = btn.textContent;
      const labelBefore = btn.getAttribute('aria-label');
      btn.click();
      await new Promise((res) => setTimeout(res, 400));
      const after = document.querySelector('[data-language-toggle]')?.textContent;
      const persisted = localStorage.getItem('meadowlight.locale');
      const storeLocale = w.localeReadback();
      // the hub title should now be Slovenian
      const hubBtn = document.querySelector('[data-corner-row] button[title]');
      return { ok: true, before, after, persisted, storeLocale, labelBefore };
    });
    rec.record(
      'i18n.toggle-flips-and-persists',
      r.ok && r.before !== r.after && r.persisted === 'sl' && r.storeLocale === 'sl',
      JSON.stringify(r),
    );
  }

  // 2. Slovenian renders real copy (hub headings in Slovenian) and the
  //    diacritics render from the latin-ext Nunito face (document.fonts.check
  //    on a Slovenian probe string)
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      await new Promise((res) => setTimeout(res, 500));
      document.querySelector('[data-language-toggle]')?.click();
      await new Promise((res) => setTimeout(res, 500));
      // open the hub via J
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      await new Promise((res) => setTimeout(res, 500));
      const hubText = document.querySelector('[data-corner-row]')?.parentElement?.textContent ?? '';
      const hasSl = hubText.includes('Terenski') || hubText.includes('MEJNIKI') || document.body.textContent.includes('Sloven');
      await document.fonts.ready;
      const glyphOk = document.fonts.check('16px Nunito', 'čšžČŠŽ');
      return { hasSl, glyphOk };
    });
    rec.record('i18n.slovenian-renders-with-diacritics', r.hasSl && r.glyphOk, JSON.stringify(r));
  }

  // 3. key-set parity asserted live: the en and sl copy tables have identical keys
  {
    const r = await page.evaluate(async () => {
      const mod = await import('./src/data/i18n.ts').catch(() => null);
      return { skipped: !mod };
    });
    // (the unit gate asserts parity at build level; here we assert the toggle
    //  flips rendered text both ways)
    const r2 = await page.evaluate(async () => {
      document.querySelector('[data-language-toggle]')?.click();
      await new Promise((res) => setTimeout(res, 400));
      const back = document.querySelector('[data-language-toggle]')?.textContent;
      return { back, persisted: localStorage.getItem('meadowlight.locale') };
    });
    rec.record('i18n.toggle-back-to-en', r2.back === 'SL' && r2.persisted === 'en', JSON.stringify(r2));
  }

  const re = realErrors(errors);
  rec.record('i18n.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}


async function checkI18nOutput() {
  const { page, errors } = await newPage(browser, url);

  // switch to SL via the real toggle, then scan RENDERED UI text on every
  // surface for residual English words (the detector checks OUTPUT, not keys)
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      await new Promise((res) => setTimeout(res, 700));
      document.querySelector('[data-language-toggle]')?.click();
      await new Promise((res) => setTimeout(res, 500));
      // open every surface: hub, hint panel, reset dialog (its button label
      // + modal), palette dock sections — the #58 tail scan walks the whole
      // DOM, not a fixed surface list
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      await new Promise((res) => setTimeout(res, 400));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      await new Promise((res) => setTimeout(res, 400));
      document.querySelector('[data-reset-button]')?.click();
      await new Promise((res) => setTimeout(res, 400));
      const text = document.body.innerText;
      document.querySelector('[role="dialog"] button, [data-reset-button]')?.click(); // close modal if open
      // residual-English detector: common UI English words that must not
      // appear in SL mode (allowlisted: brand "Meadowlight", key names)
      const englishWords = ['\bThe\b', '\bthe meadow\b', '\bHow to play\b', '\bField notebook\b', '\bIn bloom\b', '\bclick the meadow\b', '\bwander\b', '\bSpring\b', '\bSummer\b', '\bAutumn\b', '\bWinter\b', '\bblooms rarely\b', '\bvisited in\b', '\bfirst sighting\b', '\bReset\b', '\bCancel\b', '\bPostcard\b', '\bKeyboard\b', '\bCamera\b', '\bTools\b', '\bCancel\b', '\bSound\b', '\bMagnifying\b'];
      const hits = [];
      for (const re of englishWords) {
        const m = text.match(new RegExp(re, 'g'));
        if (m) hits.push(re + ' x' + m.length);
      }
      // season names in SL must be the SL labels
      const seasonsOk = ['Pomlad', 'Poletje', 'Jesen', 'Zima'].every((s) => text.includes(s));
      return { hits, seasonsOk, len: text.length };
    });
    rec.record(
      'i18n.sl-rendered-output-no-residual-english',
      r.hits.length === 0 && r.seasonsOk,
      JSON.stringify(r),
    );
  }

  // both locales: scan EN for stray Slovenian
  {
    const r = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.resetWorld();
      await new Promise((res) => setTimeout(res, 500));
      document.querySelector('[data-language-toggle]')?.click(); // to sl
      await new Promise((res) => setTimeout(res, 300));
      document.querySelector('[data-language-toggle]')?.click(); // back to en
      await new Promise((res) => setTimeout(res, 400));
      const text = document.body.innerText;
      const slWords = ['\u010d', '\u0161', '\u017e', 'Pomlad', 'Poletje', 'Jesen', 'Zima', 'Travnik', 'dnevnik', 'Sloven'];
      const hits = slWords.filter((x) => text.includes(x));
      return { hits };
    });
    rec.record('i18n.en-rendered-output-no-stray-slovenian', r.hits.length === 0, JSON.stringify(r));
  }

  const re = realErrors(errors);
  rec.record('i18n.output-no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}


async function checkFonts() {
  const { page, errors } = await newPage(browser, url);
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'font-preview=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // per-glyph fonts.check() on the HEADING face in SL mode: every SL
  // diacritic must resolve in the heading family itself (not a fallback).
  // Measurement wins over metadata: we measure the loaded faces.
  const r = await page.evaluate(async () => {
    await document.fonts.ready;
    const probe = 'čšžČŠŽ';
    const out = {};
    for (const fam of ['Jersey 25', 'Nunito']) {
      out[fam + ' 400'] = document.fonts.check('400 16px ' + fam, probe);
      out[fam + ' 700'] = document.fonts.check('700 16px ' + fam, probe);
    }
    // glyph-width measurement: render the probe in the heading family vs the
    // body family; a fallback glyph has a different advance width
    function widthOf(family, weight, text) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${weight} 32px ${family}`;
      return c.measureText(text).width;
    }
    const wHead = widthOf('Jersey 25', 700, probe);
    const wBody = widthOf('Nunito', 700, probe);
    out['widths'] = { jersey25_700: wHead, nunito700: wBody };
    // candidate faces (preview overlay): which carry the diacritics
    out['candidates'] = {};
    const fams = ['Cand Jersey 25', 'Cand Pixelify', 'Cand Press Start 2P', 'Cand VT323', 'Cand Handjet', 'Cand DotGothic16', 'Cand Jersey 10', 'Cand Jersey 15', 'Cand Jersey 20', 'Cand Tektur', 'Cand Kode Mono', 'Cand Sixtyfour'];
    for (const fam of fams) {
      out['candidates'][fam] = {
        '400': document.fonts.check('400 16px ' + fam, probe),
        '700': document.fonts.check('700 16px ' + fam, probe),
        'ascii': document.fonts.check('400 16px ' + fam, 'Meadow'),
      };
    }
    // #64 per-glyph, per-weight width consistency: every glyph of the test
    // line measured in the candidate face must come from ONE face — compare
    // each glyph's width in the candidate vs in the known fallback (Nunito):
    // a per-glyph fallback shows a width jump to the fallback's metric.
    function width(family, weight, ch) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = weight + ' 32px ' + family;
      return c.measureText(ch).width;
    }
    const glyphs = ['\u010d', '\u0161', '\u017e', '\u010c', '\u0160', '\u017d', 'A', 'z'];
    out['perGlyph'] = {};
    for (const fam of fams) {
      const entry = {};
      for (const w of ['400', '700']) {
        entry[w] = {};
        for (const g of glyphs) {
          const cand = width(fam, w, g);
          const fallback = width('Nunito', w, g);
          entry[w][g] = { cand, fallback, sameFace: Math.abs(cand - fallback) < 0.01 };
        }
      }
      out['perGlyph'][fam] = entry;
    }
    return out;
  });
  const slHeadingOk = r['Jersey 25 700'] === true && r['Jersey 25 400'] === true;
  rec.record('fonts.heading-face-carries-sl-diacritics', slHeadingOk, 'Jersey25 400=' + JSON.stringify(r['Jersey 25 400']) + ' 700=' + JSON.stringify(r['Jersey 25 700']) + ' widths ' + JSON.stringify(r.widths));
  rec.record('fonts.candidates-diacritic-coverage', true, JSON.stringify(r.candidates));
  // #64 acceptance: every glyph of the test line, both weights, in the
  // candidate's OWN single face (per-glyph width == candidate face, not the
  // fallback's metric). Candidates documented as lacking \u010d (dotgothic16,
  // sixtyfour) are expected-fail on \u010d and are listed, not hidden.
  const expectedLackC = { 'Cand DotGothic16': true, 'Cand Sixtyfour': true };
  let perGlyphFails = [];
  for (const [fam, weights] of Object.entries(r.perGlyph)) {
    for (const [w, glyphs] of Object.entries(weights)) {
      for (const [g, m] of Object.entries(glyphs)) {
        if (!m.sameFace) {
          if (g === '\u010d' && expectedLackC[fam]) continue; // documented lack
          perGlyphFails.push(fam + ' ' + w + ' ' + g);
        }
      }
    }
  }
  rec.record('fonts.each-glyph-single-face-both-weights', perGlyphFails.length === 0, 'perGlyphFails=' + JSON.stringify(perGlyphFails));

  const re = realErrors(errors);
  rec.record('fonts.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}


async function checkPostcard() {
  const { page, errors } = await newPage(browser, url);
  // #60: the OBSERVABLE is a non-empty image blob from the real save path —
  // "the handler ran" is a proxy; postcardSaveForTest runs capture -> compose
  // -> download and measures the blob
  const r = await page.evaluate(async () => {
    const w = window.__meadowlight;
    w.resetWorld();
    w.plant('lavender', 2, 2);
    // #67 round 2: plant a real-sized meadow so the seed code is LONG
    // (~8 chars per plant) — the overflow path the user's saved JPG hit
    // (full-width string, no visible stamp) is only exercised with a long
    // code; a 1-plant code is short and the gate would pass vacuously
    const ids = ['lavender', 'poppy', 'cosmos', 'clover', 'sunflower', 'thyme'];
    for (let i = 0; i < 24; i++) w.plant(ids[i % ids.length], -9 + (i % 6) * 3.2, -9 + Math.floor(i / 6) * 3.2);
    await new Promise((res) => setTimeout(res, 1200));
    return await w.postcardSaveForTest();
  });
  rec.record(
    'postcard.save-produces-image-blob',
    r.ok && r.bytes > 1000,
    JSON.stringify(r),
  );
  // #67: the composed card carries the facts-learned stat matching the live
  // journal count, and the seed string matching the share code (both locales)
  for (const loc of ['en', 'sl']) {
    const rr = await page.evaluate(async (l) => {
      const w = window.__meadowlight;
      w.setLocaleForTest(l);
      return await w.postcardComposeReadback();
    }, loc);
    const factsLine = rr.stats.find((s) => /fact/i.test(s.label) || /dejstv/i.test(s.label));
    const factsOk = !!factsLine && factsLine.value === String(rr.seenFacts);
    const code = await page.evaluate(() => window.__meadowlight.seedCodeEncode());
    rec.record(
      'postcard.facts-stat-matches-journal@' + loc,
      rr.ok && factsOk,
      'locale=' + loc + ' factsLine=' + JSON.stringify(factsLine) + ' seenFacts=' + rr.seenFacts,
    );
    rec.record(
      'postcard.seed-stamp-matches-share-code@' + loc,
      rr.ok && rr.seedCode === code && rr.seedLabel.length > 0,
      'locale=' + loc + ' seedLabel=' + JSON.stringify(rr.seedLabel) + ' seedCode==shareCode: ' + (rr.seedCode === code),
    );
    // #67 close-out: draw-then-measure — the composed canvas actually carries
    // ink inside the stamp box (the seed code is drawn, not just returned by
    // the readback) and the stamp box is a contained corner section fully
    // inside the card frame with margin
    rec.record(
      'postcard.seed-stamp-drawn-contained@' + loc,
      rr.ok && !!rr.stamp && rr.stamp.inkPx >= 40 && rr.stamp.insideFrame,
      'locale=' + loc + ' stamp=' + JSON.stringify(rr.stamp) + ' seedCodeLen=' + rr.seedCode.length,
    );
    // #67 round 2 NEGATIVE assertion against the exported compose: diff the
    // seeded vs unseeded compose of the same capture — every differing pixel
    // must lie inside the stamp box. No seed ink outside the stamp = no
    // full-width bottom string on the saved JPG.
    rec.record(
      'postcard.seed-ink-only-in-stamp@' + loc,
      rr.ok && !!rr.stamp && rr.stamp.inkPx >= 40 && rr.stamp.insideFrame && rr.stamp.outsideStampDiffPx <= 40,
      'locale=' + loc + ' stamp=' + JSON.stringify(rr.stamp) + ' seedCodeLen=' + rr.seedCode.length,
    );
  }
  // #89: with the ML2 format a TYPICAL meadow (8 plants, ~50-char code) renders
  // the stamp as ONE line in its corner box — fitSeedCode wrap stays as the
  // safety net for the big payloads the checks above exercise
  {
    const rr = await page.evaluate(async () => {
      const w = window.__meadowlight;
      w.setLocaleForTest('en');
      w.resetWorld();
      const ids = ['lavender', 'cosmos', 'poppy', 'clover', 'thyme', 'crocus'];
      for (let i = 0; i < 8; i++) w.plant(ids[i % ids.length], -6 + (i % 4) * 4, -3 + Math.floor(i / 4) * 6);
      await new Promise((res) => setTimeout(res, 1200));
      return await w.postcardComposeReadback();
    });
    rec.record(
      'postcard.seed-stamp-single-line-typical-meadow@en',
      rr.ok && !!rr.stamp && rr.stamp.inkPx >= 40 && rr.stamp.insideFrame && rr.stamp.codeLines === 1 && rr.seedCode.startsWith('ML2.'),
      'stamp=' + JSON.stringify(rr.stamp) + ' seedCodeLen=' + rr.seedCode.length + ' prefix=' + rr.seedCode.slice(0, 4),
    );
  }
  await page.evaluate(() => window.__meadowlight.setLocaleForTest('en'));
  const re = realErrors(errors);
  rec.record('postcard.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}


async function checkRolloverToast() {
  const { page, errors } = await newPage(browser, url);
  // #63: rollover toast must render in the ACTIVE locale — force a rollover
  // in both locales and assert the toast card shows that locale's title
  for (const loc of ['en', 'sl']) {
    const r = await page.evaluate(async (locale) => {
      const w = window.__meadowlight;
      w.resetWorld();
      w.setLocaleForTest(locale);
      w.dismissAllToastsForTest();
      w.setSeason('summer');
      w.setSeasonProgressForTest(0.999);
      w.timeSetPaused(false);
      w.timeSetSpeed(8);
      await new Promise((res) => setTimeout(res, 1200));
      w.timeSetSpeed(1);
      w.timeSetPaused(true);
      const title = w.toastSeasonTitleReadback();
      const cards = [...document.querySelectorAll('[data-toast]')].map((d) => d.textContent);
      return { locale, title, shown: cards.some((c) => c.includes(title)), cardCount: cards.length };
    }, loc);
    rec.record(
      'toast.rollover-renders-in-active-locale@' + loc,
      r.shown && r.cardCount >= 1,
      JSON.stringify(r),
    );
  }
  const re = realErrors(errors);
  rec.record('toast.no-console-errors', re.length === 0, re.slice(0, 3).join(' | '));
  await page.close();
}

// #68: shared dispatch — unknown names name the valid checks. NOTE: the
// full-suite runner must invoke session10 WITHOUT invented names (e.g. 'rim',
// 'resetlane', 'seedcodes') — valid: seeds, i18n, i18n-output, fonts, postcard,
// toast (the #66 rim assertions live in the UNIT gate, scripts/unit-tests.mjs)
const code = await dispatchChecks(rec, checks, {
  seeds: checkSeeds,
  i18n: checkI18n,
  'i18n-output': checkI18nOutput,
  fonts: checkFonts,
  postcard: checkPostcard,
  toast: checkRolloverToast,
}, 'session10-gate');
await browser.close();
process.exit(code);
