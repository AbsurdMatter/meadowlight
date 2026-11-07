/**
 * Session 10 P3 (ROADMAP v4 item 8): seed codes — a short string that
 * captures species + positions, deterministic from the seeded placement
 * hash (NOT the save: season, jars, notebook stay local).
 *
 * Format v2 (session 11, #89 — payload trimmed after measuring ML1: the old
 * 8 chars/plant were species padded to 2 (10 species need 1) plus centi-unit
 * (0.01u) positions at 3 chars/axis — far finer than any placement tolerance):
 *   ML2.<base36(worldSeed)>.<records>
 *   record = 1 char speciesIndex + 2 chars qx + 2 chars qz  (base36, padded)
 *   qx/qz = position quantized to 0.05u, offset by 420 -> 0..840 < 36^2
 *   => 5 chars per plant (was 8); the count is derivable from the fixed-width
 *      records (rest.length / 5), so it is no longer carried.
 *   A 24-plant meadow: ~212 chars (ML1) -> ~130 chars (ML2).
 *   (Roster invariant: PLANTS.length <= 36 so the species index stays 1 char;
 *    if the roster ever grows past 36 the format bumps to ML3.)
 *
 * Format v1 (legacy, #89 migration — still DECODED, never written):
 *   ML1.<base36(worldSeed)>.<base36(count)><8-char records:
 *   species 2 + qx 3 + qz 3 in centi-units, offset 2200>
 *   encodeSeedCodeLegacyML1 is exported for tests/migration fixtures only.
 *
 * Encoding is pure and deterministic; decoding validates strictly:
 *   - unknown version prefix -> null (caller boots fresh + backup)
 *   - truncated/garbled payload -> null
 *   - out-of-range or non-plantable cells -> the whole code is rejected
 *     (a friend's meadow must grow EXACTLY, never approximately)
 *
 * The world's own worldSeed is the seed-code's seed: same code -> same
 * layout across reloads AND machines (the hash is the shared seededHash).
 */
import { hash2 } from './seededHash';
import { PLANTS } from '../data/plants';
import { isPlantableCell, groundAt } from './ground';
import type { PlacedItem } from './persistence';

export const SEED_CODE_PREFIX = 'ML2';
export const LEGACY_SEED_CODE_PREFIX = 'ML1';
const QUANT = 20; // quantization: 0.05u — far below any placement tolerance
const OFFSET = 420; // quant units; covers |x| <= 21 (the placement box) with margin
const RECORD_CHARS = 5; // species 1 + qx 2 + qz 2 (base36 zero-padded; 840 < 36^2)
// legacy ML1 constants (centi-units)
const CENTI = 100;
const LEGACY_OFFSET = 2200;

const PLANT_INDEX: Record<string, number> = Object.fromEntries(PLANTS.map((p, i) => [p.id, i]));
const PLANT_BY_INDEX = PLANTS.map((p) => p.id);

function toB36(n: number): string {
  return n.toString(36);
}
function fromB36(s: string): number | null {
  if (!/^[0-9a-z]+$/.test(s)) return null;
  const v = parseInt(s, 36);
  return Number.isFinite(v) ? v : null;
}

function pushDecoded(items: PlacedItem[], worldSeed: number, i: number, plantId: string, x: number, z: number): boolean {
  if (!isPlantableCell(x, z)) return false; // exact layout or nothing
  const g = groundAt(x, z);
  items.push({
    id: `seeded:${worldSeed}:${i}`,
    plantId,
    position: [x, g.height, z],
    rotationY: hash2(worldSeed, i, 0x5eed) * Math.PI * 2,
    phase: hash2(i, worldSeed, 0x5eed) * Math.PI * 2,
    variation: {
      rotationY: hash2(worldSeed, i * 7 + 3, 0x5eed) * Math.PI * 2,
      heightJitter: 0,
      tiltX: 0,
      tiltZ: 0,
    },
  });
  return true;
}

/**
 * Encode the meadow's species + positions into a seed code (ML2 — always the
 * NEW format; legacy ML1 codes are decode-only, see decodeSeedCode).
 * Deterministic AND idempotent: records are sorted by QUANTIZED POSITION
 * (then species), so the code depends only on the SET of placements — not on
 * insertion order or the random uuids — and encode(decode(code)) === code
 * even past 10 items (lexical id sort would scramble 'seeded:…:10' vs ':2').
 * The world seed rides along as the code's seed.
 */
export function encodeSeedCode(worldSeed: number, items: PlacedItem[]): string {
  const recs: { pi: number; qx: number; qz: number }[] = [];
  for (const it of items) {
    const pi = PLANT_INDEX[it.plantId];
    if (pi === undefined) continue; // non-roster ids never enter a code
    const qx = Math.round(it.position[0] * QUANT) + OFFSET;
    const qz = Math.round(it.position[2] * QUANT) + OFFSET;
    // 2 base36 chars hold 0..1295; the placement box is |x| <= 21 -> 0..840.
    // Anything outside the encodable box never enters a code (decode would
    // reject it as non-plantable anyway).
    if (qx < 0 || qx > 1295 || qz < 0 || qz > 1295) continue;
    recs.push({ pi, qx, qz });
  }
  recs.sort((a, b) => a.qx - b.qx || a.qz - b.qz || a.pi - b.pi);
  let records = '';
  for (const r of recs) {
    // fixed-width record: species 1, qx 2, qz 2 (base36, zero-padded)
    records += toB36(r.pi) + toB36(r.qx).padStart(2, '0') + toB36(r.qz).padStart(2, '0');
  }
  return SEED_CODE_PREFIX + '.' + toB36(worldSeed) + '.' + records;
}

/**
 * #89 MIGRATION/TESTS ONLY — encode in the legacy ML1 format (8 chars/plant,
 * centi-units, explicit count). Never used by the app: the share panel,
 * reset entry, and postcard stamp all emit ML2. Exists so the migration gate
 * can build a real legacy code from the live meadow.
 */
export function encodeSeedCodeLegacyML1(worldSeed: number, items: PlacedItem[]): string {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let payload = toB36(worldSeed) + '.' + toB36(sorted.length);
  for (const it of sorted) {
    const pi = PLANT_INDEX[it.plantId];
    if (pi === undefined) continue;
    const qx = Math.round(it.position[0] * CENTI) + LEGACY_OFFSET;
    const qz = Math.round(it.position[2] * CENTI) + LEGACY_OFFSET;
    payload += toB36(pi).padStart(2, '0') + toB36(qx).padStart(3, '0') + toB36(qz).padStart(3, '0');
  }
  return LEGACY_SEED_CODE_PREFIX + '.' + payload;
}

export interface DecodedSeed {
  worldSeed: number;
  items: PlacedItem[];
}

/** Decode + validate an ML2 code (5-char records; count = rest/5). */
function decodeSeedCodeML2(trimmed: string): DecodedSeed | null {
  const payload = trimmed.slice(SEED_CODE_PREFIX.length + 1);
  const dot = payload.indexOf('.');
  if (dot <= 0) return null;
  const worldSeed = fromB36(payload.slice(0, dot));
  if (worldSeed === null || worldSeed <= 0) return null;
  const rest = payload.slice(dot + 1);
  if (rest.length % RECORD_CHARS !== 0) return null; // trailing garbage / truncation
  const count = rest.length / RECORD_CHARS;
  if (count > 512) return null;
  const items: PlacedItem[] = [];
  for (let i = 0; i < count; i++) {
    const c = i * RECORD_CHARS;
    const sp = fromB36(rest.slice(c, c + 1));
    const qx = fromB36(rest.slice(c + 1, c + 3));
    const qz = fromB36(rest.slice(c + 3, c + 5));
    if (sp === null || qx === null || qz === null) return null;
    const plantId = PLANT_BY_INDEX[sp];
    if (!plantId) return null;
    const x = (qx - OFFSET) / QUANT;
    const z = (qz - OFFSET) / QUANT;
    if (!pushDecoded(items, worldSeed, i, plantId, x, z)) return null;
  }
  return { worldSeed, items };
}

/** Decode + validate a legacy ML1 code (8-char records, centi-units, count field). */
function decodeSeedCodeLegacyML1(trimmed: string): DecodedSeed | null {
  const payload = trimmed.slice(LEGACY_SEED_CODE_PREFIX.length + 1);
  const dot = payload.indexOf('.');
  if (dot <= 0) return null;
  const rest = payload.slice(dot + 1);
  const worldSeed = fromB36(payload.slice(0, dot));
  if (worldSeed === null || worldSeed <= 0) return null;
  // the count field is the LONGEST base36 prefix such that the remaining
  // bytes are exactly count * 8 fixed-width record chars (species 2 + qx 3
  // + qz 3). Try each possible prefix length and accept the unique fit.
  let count = null;
  let cursor = 0;
  for (let len = 1; len <= 4 && len <= rest.length; len++) {
    const v = fromB36(rest.slice(0, len));
    if (v === null || v <= 0 || v > 512) continue;
    if ((rest.length - len) === v * 8) { count = v; cursor = len; break; }
  }
  if (count === null) return null;
  const items: PlacedItem[] = [];
  for (let i = 0; i < count; i++) {
    if (cursor + 8 > rest.length) return null;
    const sp = fromB36(rest.slice(cursor, cursor + 2));
    const qx = fromB36(rest.slice(cursor + 2, cursor + 5));
    const qz = fromB36(rest.slice(cursor + 5, cursor + 8));
    cursor += 8;
    if (sp === null || qx === null || qz === null) return null;
    const plantId = PLANT_BY_INDEX[sp];
    if (!plantId) return null;
    const x = (qx - LEGACY_OFFSET) / CENTI;
    const z = (qz - LEGACY_OFFSET) / CENTI;
    if (!pushDecoded(items, worldSeed, i, plantId, x, z)) return null;
  }
  if (cursor !== rest.length) return null; // trailing garbage
  return { worldSeed, items };
}

/**
 * Decode + validate a seed code in EITHER version — ML2 (current) or ML1
 * (legacy, migration: existing shared codes keep loading). Returns null for
 * ANY unknown/corrupt/out-of-range code — the caller then boots a fresh
 * world and preserves the player's existing save via the corrupt-blob backup
 * pattern. Encoding always writes the new format (write-new on save).
 */
export function decodeSeedCode(code: string): DecodedSeed | null {
  const trimmed = code.trim();
  if (trimmed.startsWith(SEED_CODE_PREFIX + '.')) return decodeSeedCodeML2(trimmed);
  if (trimmed.startsWith(LEGACY_SEED_CODE_PREFIX + '.')) return decodeSeedCodeLegacyML1(trimmed);
  return null;
}
