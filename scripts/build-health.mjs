#!/usr/bin/env node
/**
 * Build gate: tsc --noEmit && vite build, failing on any TypeScript error
 * or any vite build warning. No browser involved.
 *
 * Cross-platform: invokes the project-local TypeScript and Vite entry files
 * directly with the running Node binary (process.execPath) — no npx/.bin
 * shim or PATH resolution involved, identical behavior on Windows/macOS/Linux.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cwd } from 'node:process';

const TSC_ENTRY = 'node_modules/typescript/bin/tsc';
const VITE_ENTRY = 'node_modules/vite/bin/vite.js';

const commands = [
  { name: 'tsc --noEmit', entry: TSC_ENTRY, args: ['--noEmit'] },
  { name: 'vite build', entry: VITE_ENTRY, args: ['build'] },
  // #6387729576: the gate scripts join the smoke — CI green can never again
  // claim a gate that cannot even parse. HONEST LIMIT, stated: --check is
  // SYNTAX only; execution-time errors (the queenPos block-scope class)
  // still only surface on a real run — the reference-level guard is the
  // user's machine run, per the standing READ-green/RUN-green convention.
];
// #6387729576: the gate scripts join the smoke — parse-checked per file
for (const f of ['scripts/session8-gate.mjs', 'scripts/gate-lib.mjs']) {
  const res = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`\n[SMOKE] gate script parse FAILED (${f}):\n` + (res.stderr || ''));
    process.exitCode = 1;
  } else {
    console.log(`[SMOKE] gate script parse OK: ${f}`);
  }
}

let failed = false;
for (const { name, entry, args } of commands) {
  if (!existsSync(entry)) {
    console.error(`\n[SMOKE] ${name}: missing dependency entry "${entry}" — run npm install`);
    failed = true;
    break;
  }
  const res = spawnSync(process.execPath, [entry, ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd: cwd(),
    shell: false,
  });
  const out = (res.stdout || '') + (res.stderr || '');
  if (res.error) {
    console.error(`\n[SMOKE] ${name} could not be spawned: ${res.error.message}`);
    failed = true;
    break;
  }
  if (res.status !== 0) {
    console.error(`\n[SMOKE] ${name} FAILED (exit ${res.status}):\n${out}`);
    failed = true;
    break;
  }
  const warnings = out
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('>'))
    .filter((l) => /\b(warn|warning|\(!)\b/i.test(l));
  if (warnings.length > 0) {
    console.error(`\n[SMOKE] ${name} produced warnings (not allowed):\n${warnings.join('\n')}`);
    failed = true;
    break;
  }
  console.log(`[SMOKE] ${name}: OK`);
}
process.exit(failed ? 1 : 0);
