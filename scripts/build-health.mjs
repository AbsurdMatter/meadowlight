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
];

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
