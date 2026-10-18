import { STRUCTURE_BY_ID } from '../data/structures';
import type { StructureId } from '../data/structures';
import type { PlacedItem, PlacedStructure } from './persistence';

/**
 * Pure collision checks for freeform placement. Slight overlap is fine for
 * flowers (the meadow aesthetic), but structures claim exclusive ground:
 * nothing may be placed on a structure's footprint, and structures can't
 * overlap flowers or each other.
 */

/** flowers are small: only the immediate spot they occupy */
const FLOWER_RADIUS = 0.45;
/** extra breathing room kept between a new structure and existing things */
const STRUCTURE_MARGIN = 0.3;

export function flowerBlocked(
  x: number,
  z: number,
  structures: PlacedStructure[],
): boolean {
  for (const st of structures) {
    const def = STRUCTURE_BY_ID[st.structureId];
    if (!def) continue;
    const d = Math.hypot(st.position[0] - x, st.position[2] - z);
    if (d < def.footprint) return true;
  }
  return false;
}

export function structureBlocked(
  x: number,
  z: number,
  structureId: StructureId,
  structures: PlacedStructure[],
  items: PlacedItem[],
  ignoreId?: string,
): boolean {
  const def = STRUCTURE_BY_ID[structureId];
  if (!def) return false;
  const own = def.footprint + STRUCTURE_MARGIN;
  for (const st of structures) {
    if (st.id === ignoreId) continue;
    const other = STRUCTURE_BY_ID[st.structureId];
    if (!other) continue;
    const d = Math.hypot(st.position[0] - x, st.position[2] - z);
    if (d < own + other.footprint) return true;
  }
  for (const it of items) {
    const d = Math.hypot(it.position[0] - x, it.position[2] - z);
    if (d < own + FLOWER_RADIUS) return true;
  }
  return false;
}
