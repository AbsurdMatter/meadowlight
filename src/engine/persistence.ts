export interface PlacedItem {
  id: string;
  plantId: string;
  position: [number, number, number];
  rotationY: number;
  /** deterministic per-item phase for idle sway, so instances stay stable */
  phase: number;
}

/**
 * World schema v2:
 *   v1: { items: PlacedItem[] }            (implicit, unversioned)
 *   v2: { version: 2, items: PlacedItem[], randomRotation: boolean }
 * v1 payloads load unchanged; the version field is added on next save.
 */
const STORAGE_KEY = 'meadowlight.world.v2';
const LEGACY_KEY = 'meadowlight.world.v1';

export interface WorldData {
  version: 2;
  items: PlacedItem[];
  randomRotation: boolean;
}

export const DEFAULT_RANDOM_ROTATION = true;

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
      // preserve saved phase; only backfill if absent (never re-randomize
      // already-placed items)
      phase: typeof (p as PlacedItem).phase === 'number' ? (p as PlacedItem).phase : Math.random() * Math.PI * 2,
    }));
}

export function loadWorld(): WorldData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return { version: 2, items: [], randomRotation: DEFAULT_RANDOM_ROTATION };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as WorldData).items)) {
      const data = parsed as WorldData;
      return {
        version: 2,
        items: parseItems(data.items),
        randomRotation: typeof data.randomRotation === 'boolean' ? data.randomRotation : DEFAULT_RANDOM_ROTATION,
      };
    }
    // v1 shape: bare array of items
    return {
      version: 2,
      items: parseItems(parsed),
      randomRotation: DEFAULT_RANDOM_ROTATION,
    };
  } catch {
    return { version: 2, items: [], randomRotation: DEFAULT_RANDOM_ROTATION };
  }
}

export function saveWorld(items: PlacedItem[], randomRotation: boolean): void {
  try {
    const data: WorldData = { version: 2, items, randomRotation };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage may be unavailable (private mode); the meadow just lives in memory
  }
}
