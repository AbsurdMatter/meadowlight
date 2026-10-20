#!/usr/bin/env node
/**
 * U4 revision 3/3 — trees-behind-the-pond PROPOSAL SHOTS (#6297184564).
 *
 * Captures before/after screenshots from the user's actual viewing angle:
 * a LOW angle at meadow center looking toward the pond (where a user
 * actually looks), plus a higher framing for composition. Manual-camera +
 * render + readback per capture (the session-5 OrbitControls-proof path:
 * the custom controls re-assert the camera every frame, so the capture
 * moves the camera directly, forces one render, and reads back the
 * projected result before the controls can re-assert).
 *
 * Usage (on the user's machine, dev server running):
 *   node scripts/tree-proposal-shots.mjs --url http://localhost:5199
 *
 * BEFORE = the current branch WITHOUT the proposed cluster (git stash the
 * environment.ts cluster line, or run on the parent commit); AFTER = with
 * it. Both shots are written as tree-before-low.png / tree-after-low.png /
 * tree-before-high.png / tree-after-high.png for the eyeball decision.
 */
import { chromium } from 'playwright-core';
import { parseArgs, launchChromium } from './gate-lib.mjs';
import { writeFileSync } from 'node:fs';

const { url = 'http://localhost:5199', 'lib-path': libPath = '', label = 'after' } = parseArgs();
const browser = await launchChromium(chromium, { libPath });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(2500);

/** capture from a camera pose: set camera, render one frame, read the PNG */
async function shot(name, cam) {
  const png = await page.evaluate(async (c) => {
    const w = window.__meadowlight;
    const three = w.__three;
    if (!three) return null;
    three.camera.position.set(c[0], c[1], c[2]);
    three.camera.lookAt(c[3], c[4], c[5]);
    three.gl.render(three.scene, three.camera);
    // read back after the forced render, before the controls re-assert
    return three.gl.domElement.toDataURL('image/png');
  }, cam);
  if (png) writeFileSync(`tree-${label}-${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`[shot] tree-${label}-${name}.png ${png ? 'written' : 'FAILED'}`);
}

// the pond is at (36,-14); the meadow center is the user's actual vantage.
// LOW: standing in the meadow looking at the pond (the eyeball angle).
await shot('low', [8, 2.2, 4, 36, 0.5, -14]);
// HIGH: a framing that shows the pond + its backdrop in composition.
await shot('high', [18, 12, 20, 36, 0, -14]);

await browser.close();
console.log(`[done] label=${label} — run once with the proposal stashed (label=before), once with it applied (label=after)`);
