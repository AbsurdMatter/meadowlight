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

/**
 * World schema:
 *   v1: { items: PlacedItem[] }            (implicit, unversioned)
 *   v2: { version: 2, items, randomRotation }
 *   v3: { version: 3, items, placementVariation }  (additive; v1/v2 load fine)
 */
const STORAGE_KEY = 'meadowlight.world.v2';
const LEGACY_KEY = 'meadowlight.world.v1';

export interface WorldData {
  version: 3;
  items: PlacedItem[];
  placementVariation: boolean;
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

export function loadWorld(): WorldData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      return {
        version: 3,
        items: [],
        placementVariation: DEFAULT_PLACEMENT_VARIATION,
      };
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as WorldData).items)) {
      const data = parsed as WorldData;
      const variation =
        typeof data.placementVariation === 'boolean'
          ? data.placementVariation
          : DEFAULT_PLACEMENT_VARIATION;
      return {
        version: 3,
        items: parseItems(data.items),
        placementVariation: variation,
      };
    }
    // v1 shape: bare array of items
    return {
      version: 3,
      items: parseItems(parsed),
      placementVariation: DEFAULT_PLACEMENT_VARIATION,
    };
  } catch {
    return {
      version: 3,
      items: [],
      placementVariation: DEFAULT_PLACEMENT_VARIATION,
    };
  }
}

export function saveWorld(data: Omit<WorldData, 'version'>): void {
  try {
    const payload: WorldData = { version: 3, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage may be unavailable (private mode); the meadow just lives in memory
  }
}
