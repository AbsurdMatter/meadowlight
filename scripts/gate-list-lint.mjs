#!/usr/bin/env node
/**
 * #74: static consistency check between scripts/run-all-gates.ps1 and the
 * gates' own check registries. CI-runnable (node-side, no PowerShell, no
 * Windows): parses the ps1's --checks lists and asserts every name exists in
 * the corresponding gate script's dispatchChecks map. A gate rename that
 * doesn't propagate to the runner turns CI red (wired into test:smoke).
 *
 * Method: read each gate script's source, extract the object literal passed
 * to dispatchChecks (keys = valid check names), and the ps1's invocations
 * (script + --checks list). Compare.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptsDir = join(root, 'scripts');

/** extract the valid check names from a gate's dispatchChecks call.
 *  Handles both the inline-object form dispatchChecks(rec, checks, { ... }, 'name')
 *  and the named-map form dispatchChecks(rec, checks, map, 'name') — for the
 *  latter the map is a top-level `const map = { ... }`. */
function gateChecks(gateFile) {
  const src = readFileSync(join(scriptsDir, gateFile), 'utf8');
  let body = null;
  const inline = src.match(/dispatchChecks\(\s*rec\s*,\s*checks\s*,\s*\{([\s\S]*?)\}\s*(?:,\s*'[^']+')?\s*\)/);
  if (inline) body = inline[1];
  else {
    const mapVar = src.match(/dispatchChecks\(\s*rec\s*,\s*checks\s*,\s*map\s*,/);
    if (mapVar) {
      const mapDef = src.match(/const map = \{([\s\S]*?)\};/);
      if (mapDef) body = mapDef[1];
    }
  }
  if (!body) return null;
  const names = [];
  for (const km of body.matchAll(/(?:^|[,{]|\n)([ \t]*)(?:'([^']+)'|([a-zA-Z0-9_-]+))\s*:/g)) {
    names.push(km[2] ?? km[3]);
  }
  return names;
}

/** parse run-all-gates.ps1 into [{script, checks|null}] */
function ps1Jobs() {
  const src = readFileSync(join(scriptsDir, 'run-all-gates.ps1'), 'utf8');
  const jobs = [];
  // match entries like: @{ Script = 'scripts\session7-gate.mjs'; Args = @('--url', $Url, '--checks', 'seeding') }
  for (const m of src.matchAll(/@\{\s*Script\s*=\s*'([^']+)';\s*Args\s*=\s*@\(([^)]*)\)\s*\}/g)) {
    const script = m[1].replace(/\\/g, '/');
    const argsRaw = m[2];
    const ci = argsRaw.indexOf("'--checks'");
    let checks = null;
    if (ci >= 0) {
      const cm = argsRaw.slice(ci).match(/'--checks'\s*,\s*'([^']+)'/);
      checks = cm ? cm[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    }
    jobs.push({ script, checks });
  }
  return jobs;
}

const problems = [];
const jobs = ps1Jobs();
if (jobs.length === 0) problems.push('no jobs parsed from run-all-gates.ps1 — the parser regex may be stale');

for (const job of jobs) {
  const gateFile = job.script.split('/').pop();
  if (gateFile === 'browser-gate.mjs' || gateFile === 'bee-gate.mjs') continue; // fixed-scenario gates, no --checks registry
  const valid = gateChecks(gateFile);
  if (!valid) { problems.push(gateFile + ': no dispatchChecks registry found — gate may have reverted to inline dispatch'); continue; }
  if (job.checks === null) continue; // no --checks flag (session10 default) — fine
  for (const c of job.checks) {
    if (!valid.includes(c)) {
      problems.push(`${gateFile}: runner passes unknown check '${c}' — valid: ${valid.join(', ')}`);
    }
  }
}

// every gate script with a dispatchChecks registry should appear in the runner
const gateFiles = readdirSync(scriptsDir).filter((f) => f.endsWith('-gate.mjs'));
for (const gf of gateFiles) {
  if (gf === 'browser-gate.mjs' || gf === 'bee-gate.mjs') continue; // fixed-scenario gates, no --checks registry
  const valid = gateChecks(gf);
  if (!valid) { problems.push(gf + ': no dispatchChecks registry found'); continue; }
  const inRunner = jobs.some((j) => j.script.endsWith(gf));
  if (!inRunner) problems.push(`${gf}: has a check registry but is missing from run-all-gates.ps1`);
}

if (problems.length > 0) {
  console.error('[GATE-LIST-LINT] FAIL');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('[GATE-LIST-LINT] OK — runner check lists match every gate registry (' + jobs.length + ' invocations)');
