export interface PlacedItem {
  id: string;
  plantId: string;
  position: [number, number, number];
  rotationY: number;
  /** deterministic per-item phase for idle sway, so instances stay stable */
  phase: number;
}

const STORAGE_KEY = 'meadowlight.world.v1';

export function loadWorld(): PlacedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
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
      .map((p) => ({ ...p, phase: typeof p.phase === 'number' ? p.phase : Math.random() * Math.PI * 2 }));
  } catch {
    return [];
  }
}

export function saveWorld(items: PlacedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage may be unavailable (private mode); the meadow just lives in memory
  }
}
