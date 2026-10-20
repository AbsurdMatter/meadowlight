/**
 * Shared helpers for the headless behavioral gates (browser-gate.mjs,
 * bee-gate.mjs, session5-gate.mjs). Launch args, page-with-error-capture,
 * and PASS/FAIL recording live here so gates only describe their checks.
 *
 * Requires the playwright-core devDependency and a chromium install
 * (node_modules/playwright-core/cli.js install chromium). On minimal Linux
 * images, pass --lib-path (a dir with the extracted GLib/X11 shared
 * libraries) — exported as LD_LIBRARY_PATH before launch, same workaround
 * as browser-gate.mjs.
 */

export function parseArgs(defaults = {}) {
  const args = process.argv.slice(2);
  const out = { ...defaults };
  for (let i = 0; i < args.length; i += 2) {
    if (args[i]?.startsWith('--')) out[args[i].slice(2)] = args[i + 1];
  }
  return out;
}

export async function launchChromium(chromium, { libPath = '' } = {}) {
  if (libPath && !process.env.LD_LIBRARY_PATH) {
    process.env.LD_LIBRARY_PATH = libPath;
  }
  return chromium.launch({
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
}

/** new page that captures console/page errors for the no-console-errors check.
 *  A dev server that isn't running reads as a clean, actionable message —
 *  never a raw ERR_CONNECTION_REFUSED stack (a wrong-port run is a usage
 *  error, not a test failure). */
export async function newPage(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('net::ERR')) {
      console.error(
        `[GATE] dev server not reachable at ${url} — start it first (npm run dev, then pass --url with the right port).`,
      );
      process.exit(2);
    }
    throw e;
  }
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.waitForTimeout(2500);
  return { page, errors };
}

export function makeRecorder(log = console.log) {
  const results = [];
  return {
    record(name, pass, detail) {
      results.push({ name, pass, detail });
      log(`[GATE] ${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    },
    exitCode() {
      return results.some((r) => !r.pass) ? 1 : 0;
    },
    all() {
      return results;
    },
  };
}

/** the standard "no console errors" companion check */
export function realErrors(errors) {
  return errors.filter((e) => !/favicon/.test(e));
}
