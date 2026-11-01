/**
 * Session 10 P3 (ROADMAP v4 item 8): seed codes — a short string that
 * captures species + positions, deterministic from the seeded placement
 * hash (NOT the save: season, jars, notebook stay local).
 *
 * Format (versioned, compact, URL-safe):
 *   ML1.<payload>
 *   payload = base36(worldSeed) + '.' + base36(count) + per-item
 *             base36(speciesIndex) + base36(qx) + base36(qz)
 *   qx/qz = quantized position in centi-units offset from -2200..2200
 *   (MEADOW_SIZE 44 => |x|,|z| <= 22 => 0..4400 => fits base36 in 3 chars)
 *
 * Encoding is pure and deterministic; decoding validates strictly:
 *   - unknown version prefix -> undefined (caller boots fresh + backup)
 *   - truncated/garbled payload -> undefined
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

export const SEED_CODE_PREFIX = 'ML1';
const CENTI = 100; // quantization: 0.01u — far below any placement tolerance
const OFFSET = 2200; // centi-units; covers |x| <= 22 with margin

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

/**
 * Encode the meadow's species + positions into a seed code. Deterministic:
 * items are sorted by id so the code depends only on the SET of placements,
 * not insertion order. The world seed rides along as the code's seed.
 */
export function encodeSeedCode(worldSeed: number, items: PlacedItem[]): string {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let payload = toB36(worldSeed) + '.' + toB36(sorted.length);
  for (const it of sorted) {
    const pi = PLANT_INDEX[it.plantId];
    if (pi === undefined) continue; // non-roster ids never enter a code
    const qx = Math.round(it.position[0] * CENTI) + OFFSET;
    const qz = Math.round(it.position[2] * CENTI) + OFFSET;
    // fixed-width fields: species 2, qx 3, qz 3 (base36; 4400 -> '3e8')
    payload += toB36(pi).padStart(2, '0') + toB36(qx).padStart(3, '0') + toB36(qz).padStart(3, '0');
  }
  return SEED_CODE_PREFIX + '.' + payload;
}

export interface DecodedSeed {
  worldSeed: number;
  items: PlacedItem[];
}

/**
 * Decode + validate a seed code. Returns null for ANY unknown/corrupt/
 * out-of-range code — the caller then boots a fresh world and preserves
 * the player's existing save via the corrupt-blob backup pattern.
 */
export function decodeSeedCode(code: string): DecodedSeed | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SEED_CODE_PREFIX + '.')) return null;
  const payload = trimmed.slice(SEED_CODE_PREFIX.length + 1);
  const dot = payload.indexOf('.');
  if (dot <= 0) return null;
  const seedPart = payload.slice(0, dot);
  const rest = payload.slice(dot + 1);
  const worldSeed = fromB36(seedPart);
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
    const x = (qx - OFFSET) / CENTI;
    const z = (qz - OFFSET) / CENTI;
    if (!isPlantableCell(x, z)) return null; // exact layout or nothing
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
  }
  if (cursor !== rest.length) return null; // trailing garbage
  return { worldSeed, items };
}
