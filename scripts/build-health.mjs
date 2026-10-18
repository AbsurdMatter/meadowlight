#!/usr/bin/env node
/**
 * Build gate: tsc --noEmit && vite build, failing on any TypeScript error
 * or any vite build warning. No browser involved. Catches the "no console
 * errors" requirement at the type/build level.
 */
import { spawnSync } from 'node:child_process';

const commands = [
  { name: 'tsc --noEmit', cmd: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'vite build', cmd: 'npx', args: ['vite', 'build'] },
];

let failed = false;
for (const { name, cmd, args } of commands) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' });
  const out = (res.stdout || '') + (res.stderr || '');
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
