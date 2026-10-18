import type { StructureId } from '../data/structures';
import type { Season } from '../data/seasons';
import type { MilestoneId } from '../data/milestones';
import { DEFAULT_PLACEMENT_VARIATION } from './variation';

export interface PlacedItem {
  id: string;
  plantId: string;
  position: [number, number, number];
  rotationY: number;
  /** deterministic per-item phase for idle sway, so instances stay stable */
  phase: number;
  /**
   * Placement-variation jitter, decided once at placement time and frozen
   * into the save. Items saved before session 2 have undefined fields and
   * are NEVER re-randomized: loaders backfill neutral values (jitter 0).
   */
  variation?: {
    /** extra Y rotation beyond the player's R-rotation */
    rotationY: number;
    /** small vertical offset so plants follow the rolling terrain */
    heightJitter: number;
    /** small lean, radians (a few degrees) */
    tiltX: number;
    tiltZ: number;
  };
}

export interface PlacedStructure {
  id: string;
  structureId: StructureId;
  position: [number, number, number];
  rotationY: number;
  variation?: PlacedItem['variation'];
}

/**
 * World schema:
 *   v1: { items: PlacedItem[] }            (implicit, unversioned)
 *   v2: { version: 2, items, randomRotation }
 *   v3: { version: 3, items, structures, milestones, season,
 *         placementVariation, seenFacts }  (all additive; v1/v2 load fine)
 *   v4: { version: 4, ..., wildSeasons, onboardingDismissed }
 *         (seasons a wild corner has survived; onboarding show-once;
 *         both additive — existing saves see no onboarding retroactively)
 */
const STORAGE_KEY = 'meadowlight.world.v2';
const LEGACY_KEY = 'meadowlight.world.v1';

export interface WorldData {
  version: 4;
  items: PlacedItem[];
  structures: PlacedStructure[];
  milestones: MilestoneId[];
  season: Season;
  placementVariation: boolean;
  /** kept from v2 so the F toggle state persists across versions */
  randomRotation: boolean;
  /** ids of facts the player has seen (additive; older saves just have none) */
  seenFacts?: string[];
  /** seasons the meadow's wild corner has survived (v4, additive) */
  wildSeasons?: string[];
  /** true once the player has dismissed the onboarding (v4, additive) */
  onboardingDismissed?: boolean;
}

function parseItems(parsed: unknown): PlacedItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (p): p is PlacedItem =>
        p &&
        typeof p.id === 'string' &&
        typeof p.plantId === 'string' &&
        Array.isArray(p.position) &&
        p.position.length === 3 &&
        typeof p.rotationY === 'number',
    )
    .map((p) => ({
      ...p,
      // preserve saved phase and variation; backfill neutrally (never
      // re-randomize already-placed items)
      phase: typeof (p as PlacedItem).phase === 'number' ? (p as PlacedItem).phase : 0,
      variation: p.variation ?? { rotationY: 0, heightJitter: 0, tiltX: 0, tiltZ: 0 },
    }));
}

function parseStructures(parsed: unknown): PlacedStructure[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is PlacedStructure =>
      p &&
      typeof p.id === 'string' &&
      typeof p.structureId === 'string' &&
      Array.isArray(p.position) &&
      p.position.length === 3 &&
      typeof p.rotationY === 'number',
  );
}

function parseSeason(parsed: unknown): Season {
  const s = parsed as Season;
  if (s === 'spring' || s === 'summer' || s === 'autumn' || s === 'winter') return s;
  return 'summer';
}

function parseMilestones(parsed: unknown): MilestoneId[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((m): m is MilestoneId => typeof m === 'string');
}

function parseSeenFacts(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((f): f is string => typeof f === 'string');
}

function parseWildSeasons(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((f): f is string => typeof f === 'string');
}

function parseOnboardingDismissed(parsed: unknown): boolean {
  return parsed === true;
}

export function loadWorld(): WorldData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      return {
        version: 4,
        items: [],
        structures: [],
        milestones: [],
        season: 'summer',
        placementVariation: DEFAULT_PLACEMENT_VARIATION,
        randomRotation: DEFAULT_PLACEMENT_VARIATION,
        seenFacts: [],
        wildSeasons: [],
      };
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as WorldData).items)) {
      const data = parsed as WorldData;
      const variation =
        typeof data.placementVariation === 'boolean'
          ? data.placementVariation
          : typeof data.randomRotation === 'boolean'
            ? data.randomRotation
            : DEFAULT_PLACEMENT_VARIATION;
      return {
        version: 4,
        items: parseItems(data.items),
        structures: parseStructures(data.structures),
        milestones: parseMilestones(data.milestones),
        season: parseSeason(data.season),
        placementVariation: variation,
        randomRotation: variation,
        seenFacts: parseSeenFacts(data.seenFacts),
        wildSeasons: parseWildSeasons(data.wildSeasons),
        onboardingDismissed: parseOnboardingDismissed(data.onboardingDismissed),
      };
    }
    // v1 shape: bare array of items
    return {
      version: 4,
      items: parseItems(parsed),
      structures: [],
      milestones: [],
      season: 'summer',
      placementVariation: DEFAULT_PLACEMENT_VARIATION,
      randomRotation: DEFAULT_PLACEMENT_VARIATION,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: false,
    };
  } catch {
    return {
      version: 4,
      items: [],
      structures: [],
      milestones: [],
      season: 'summer',
      placementVariation: DEFAULT_PLACEMENT_VARIATION,
      randomRotation: DEFAULT_PLACEMENT_VARIATION,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: false,
    };
  }
}

/** Remove the saved world entirely (used by Reset — the save must not survive). */
export function clearSavedWorld(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage unavailable: nothing persisted, nothing to clear
  }
}

export function saveWorld(data: Omit<WorldData, 'version'>): void {
  try {
    const payload: WorldData = { version: 4, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage may be unavailable (private mode); the meadow just lives in memory
  }
}
