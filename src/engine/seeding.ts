/**
 * Session 7 U1: self-seeding — the pure decision engine.
 *
 * One roll per SEASON ROLLOVER, called from the single season-advance site
 * (placementStore.arriveAtSeason — the same path the dial, P panel, and
 * natural clock all cross). Determinism: every roll derives from the ONE
 * shared seeded-hash source (engine/seededHash) keyed by the world's named
 * seed state + a monotonically increasing seeding epoch — identical inputs
 * give identical volunteers across reloads and machines, and no Math.random
 * anywhere.
 *
 * Constitution: a returning visitor's meadow must read as RICHER, never as
 * encroached. Three brakes: rarity (tuning chance), regional caps (growth
 * reads as drifts filling in), and roster-compatible neighbors only (a
 * volunteer is "more of what already thrives here", never a weed).
 */
import { SEEDING_TUNING } from '../data/seeding';
import { PLANT_BY_ID, PLANTS } from '../data/plants';
import { hash3 } from './seededHash';
import type { PlacedItem } from './persistence';
import { inBloom } from './pollinator';
import type { Season } from '../data/seasons';

export interface VolunteerSeed {
  plantId: string;
  position: [number, number, number];
  /** deterministic sway phase for the new item (stable across reloads) */
  phase: number;
  /** deterministic variation for the new item (frozen at birth like any placement) */
  variation: {
    rotationY: number;
    heightJitter: number;
    tiltX: number;
    tiltZ: number;
  };
}

/**
 * roster-compatible neighbor: the same species, or a roster species sharing
 * at least one bloom season with the parent (they co-thrive by data already
 * verified per the session-5 roster rule). Excludes the parent itself and
 * any species not blooming in the NEW season — a seedling that could never
 * be seen blooming would read as a weed (the yearRoundBloom lesson).
 */
export function compatibleSeedling(parentId: string, newSeason: Season): string[] {
  const parent = PLANT_BY_ID[parentId];
  if (!parent) return [];
  const out: string[] = [parentId];
  for (const p of PLANTS) {
    if (p.id === parentId) continue;
    if (p.bloom.includes(newSeason) && p.bloom.some((s) => parent.bloom.includes(s))) {
      out.push(p.id);
    }
  }
  return out;
}

/** region key for the per-region cap (square grid of regionSize) */
function regionKey(x: number, z: number): string {
  const r = SEEDING_TUNING.regionSize;
  return `${Math.floor(x / r)}:${Math.floor(z / r)}`;
}

/**
 * Decide this rollover's volunteers.
 *
 * @param items        live meadow (parents = items blooming in `endedSeason`)
 * @param structures   placed structures (flowers never seed onto footprints)
 * @param endedSeason  the season that just ended (parents bloomed in it)
 * @param newSeason    the season that just began (seedlings must fit it)
 * @param worldSeed    the world's named seed state (stable across reloads)
 * @param epoch        this world's rollover count (rolls never repeat)
 * @param isPlantable  the RAW cell query — the same one the overlay, ghost,
 *                     and click path classify with (one source, no divergence)
 * @param flowerBlocked the existing collision oracle (no seeding on structures)
 */
export function rollVolunteers(
  items: PlacedItem[],
  endedSeason: Season,
  newSeason: Season,
  worldSeed: number,
  epoch: number,
  isPlantable: (x: number, z: number) => boolean,
  flowerBlockedFn: (x: number, z: number) => boolean,
): VolunteerSeed[] {
  if (items.length === 0) return [];
  // #37 finding 2 — the cumulative brake: volunteers may never exceed the
  // tuned share of the whole meadow. Seeding PAUSES above the share (never
  // removes anything — no fail state); planting more or clearing some
  // resumes it. This is the constraint the returning visitor actually feels.
  const existingVolunteers = items.filter((it) => it.volunteer === true).length;
  const maxVolunteers = Math.floor(items.length * SEEDING_TUNING.maxVolunteerFraction);
  if (existingVolunteers >= maxVolunteers) return [];
  // parents: flowers that bloomed during the season just ended
  const parents = items.filter((it) => inBloom(it.plantId, endedSeason));
  if (parents.length === 0) return [];
  const budget = maxVolunteers - existingVolunteers;
  const out: VolunteerSeed[] = [];
  const regionCount = new Map<string, number>();
  for (const parent of parents) {
    if (out.length >= Math.min(SEEDING_TUNING.maxPerSeason, budget)) break;
    const rk = regionKey(parent.position[0], parent.position[2]);
    if ((regionCount.get(rk) ?? 0) >= SEEDING_TUNING.maxPerRegionPerSeason) continue;
    // one deterministic roll per (worldSeed, epoch, parent id)
    const roll = hash3(worldSeed, epoch, strHash(parent.id), 701);
    if (roll >= SEEDING_TUNING.chancePerBloomingParent) continue;
    // probe candidate cells in hash order; first legal fit wins
    for (let c = 0; c < SEEDING_TUNING.candidateCells; c++) {
      const ang = hash3(worldSeed, epoch, c + strHash(parent.id) * 31, 702) * Math.PI * 2;
      const dist =
        SEEDING_TUNING.seedDistanceMin +
        hash3(worldSeed, epoch, c + strHash(parent.id) * 17, 703) *
          (SEEDING_TUNING.seedDistanceMax - SEEDING_TUNING.seedDistanceMin);
      const x = parent.position[0] + Math.cos(ang) * dist;
      const z = parent.position[2] + Math.sin(ang) * dist;
      if (!isPlantable(x, z)) continue;
      if (flowerBlockedFn(x, z)) continue;
      // spacing: never on top of an existing flower
      let crowded = false;
      for (const it of items) {
        if (Math.hypot(it.position[0] - x, it.position[2] - z) < SEEDING_TUNING.minSpacing) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      const choices = compatibleSeedling(parent.plantId, newSeason);
      if (choices.length === 0) continue;
      const pick = Math.floor(
        hash3(worldSeed, epoch, c + strHash(parent.id) * 13, 704) * choices.length,
      );
      const plantId = choices[Math.min(pick, choices.length - 1)];
      // terrain-accurate y comes from the caller (groundAt is the oracle);
      // the seed carries only the horizontal position decision
      out.push({
        plantId,
        position: [x, 0, z],
        phase: hash3(worldSeed, epoch, c + strHash(parent.id) * 7, 705) * Math.PI * 2,
        variation: {
          rotationY: hash3(worldSeed, epoch, c + strHash(parent.id) * 3, 706) * Math.PI * 2,
          heightJitter: 0,
          tiltX: 0,
          tiltZ: 0,
        },
      });
      regionCount.set(rk, (regionCount.get(rk) ?? 0) + 1);
      break;
    }
  }
  return out;
}

/** stable string hash for parent ids (the roll key must be content-stable) */
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h >>> 1;
}
