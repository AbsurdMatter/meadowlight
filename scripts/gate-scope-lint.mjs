#!/usr/bin/env node
/**
 * Static guard (#65 item 4): fail if a gate script references a browser
 * global (innerHeight/innerWidth/getComputedStyle/requestAnimationFrame)
 * in NODE scope — i.e. outside page.evaluate / waitForFunction /
 * addInitScript / exposeFunction callback bodies. This is the check that
 * would have caught session9-gate.mjs:249 (ReferenceError: innerHeight),
 * which silently aborted the chrome family after the first viewport.
 *
 * Runs in test:smoke, so CI goes red on any new instance.
 * Usage: node scripts/gate-scope-lint.mjs   (exit 1 on any hit)
 */
import { readFileSync, readdirSync } from 'node:fs';
const GLOBALS = ['innerHeight', 'innerWidth', 'getComputedStyle', 'requestAnimationFrame'];
const FILES = readdirSync('scripts').filter((f) => f.endsWith('.mjs') && f !== 'gate-scope-lint.mjs');

function stripCalls(src, names) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    let best = null;
    for (const n of names) {
      const m = src.slice(i).match(new RegExp('\\.' + n + '\\s*\\('));
      if (m && (!best || m.index < best.index)) best = { index: m.index, len: m[0].length };
    }
    if (!best) { out += src.slice(i); break; }
    const start = i + best.index;
    out += src.slice(i, start);
    let j = start + best.len - 1;
    let depth = 0, inStr = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    out += '(/*stripped*/)';
    i = j;
  }
  return out;
}

let hits = 0;
for (const f of FILES) {
  const src = readFileSync('scripts/' + f, 'utf8');
  const stripped = stripCalls(src, ['evaluate', 'waitForFunction', 'addInitScript', 'exposeFunction']);
  stripped.split('\n').forEach((l, idx) => {
    if (l.trim().startsWith('//') || l.trim().startsWith('*')) return;
    for (const g of GLOBALS) {
      if (new RegExp('(^|[^.a-zA-Z_$])' + g + '\\b').test(l)) {
        console.log(`${f}:${idx + 1}: ${g} :: ${l.trim().slice(0, 110)}`);
        hits++;
      }
    }
  });
}
console.log(hits === 0 ? 'CLEAN' : `${hits} NODE-SCOPE HIT(S)`);
process.exit(hits ? 1 : 0);
