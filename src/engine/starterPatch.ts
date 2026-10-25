/**
 * O1 (v4, #39): the seeded starter patch — a few flowers + a hive already
 * placed, so the meadow is ALIVE on frame one for a first-time visitor.
 *
 * Determinism: every position derives from the world's named seed state
 * (worldSeed) through the shared seeded hash (engine/seededHash) — NEVER
 * Math.random. The same seed grows the same welcome meadow across reloads
 * and machines; a different seed grows a different one. The ground oracle
 * (isPlantableCell — the same classification the ghost and click path use)
 * is consulted per candidate: a fold/water cell never receives a plant, the
 * patch simply lands on the next candidate slot.
 */
import { hash2 } from './seededHash';
import { groundAt } from './ground';
import { isPlantableCell } from './ground';
import { ONBOARDING_TUNING } from '../data/onboarding';
import type { PlacedItem, PlacedStructure } from './persistence';

export interface StarterPatch {
  items: PlacedItem[];
  structures: PlacedStructure[];
}

/**
 * Build the starter patch for a world seed. Pure: no store, no DOM, no
 * Math.random. Items carry stable ids (`starter:<seed>:<i>`) so a reload
 * never duplicates them (the caller seeds only an EMPTY world).
 */
export function starterPatchFor(worldSeed: number): StarterPatch {
  const t = ONBOARDING_TUNING.starter;
  const items: PlacedItem[] = [];
  const structures: PlacedStructure[] = [];
  let slot = 0;
  for (const f of t.flowers) {
    // candidate slots spiral outward from the ring position; the seeded
    // jitter keeps the drift organic, the oracle keeps it legal
    for (let attempt = 0; attempt < 8 && items.length <= f.ring; attempt++) {
      const a = (f.ring / Math.max(1, t.flowers.length)) * Math.PI * 2 +
        hash2(worldSeed, slot * 31 + 7, 0x5eed) * t.jitter;
      const r = t.ringRadius * (0.8 + hash2(slot, worldSeed, 0x5eed) * 0.4);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      slot++;
      if (!isPlantableCell(x, z)) continue;
      items.push({
        id: `starter:${worldSeed}:${f.ring}`,
        plantId: f.plantId,
        position: [x, groundAt(x, z).height, z],
        rotationY: hash2(worldSeed, f.ring, 0x5eed) * Math.PI * 2,
        phase: hash2(f.ring, worldSeed, 0x5eed) * Math.PI * 2,
        variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 },
      });
      break;
    }
  }
  // the hive — alive on frame one
  for (let attempt = 0; attempt < 16; attempt++) {
    const a = hash2(worldSeed, 99 + attempt, 0x5eed) * Math.PI * 2;
    const r = t.hiveRing * (0.9 + hash2(attempt, worldSeed, 0x5eed) * 0.3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!isPlantableCell(x, z)) continue;
    structures.push({
      id: `starter:${worldSeed}:hive`,
      structureId: 'hive',
      position: [x, groundAt(x, z).height, z],
      rotationY: hash2(worldSeed, 55, 0x5eed) * Math.PI * 2,
      variation: { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 },
    });
    break;
  }
  return { items, structures };
}
