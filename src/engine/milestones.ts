import { plantedSpecies, yearRoundBloom } from './pollinator';
import { SEASONS } from '../data/seasons';
import type { PlacedItem, PlacedStructure } from './persistence';
import { MILESTONE_BY_ID } from '../data/milestones';
import type { MilestoneId } from '../data/milestones';

export interface MilestoneEvent {
  id: MilestoneId;
  label: string;
  detail: string;
}

/**
 * Pure function: given the world state and already-earned milestones,
 * return the milestones that should fire now (each at most once).
 */
export function checkMilestones(
  items: PlacedItem[],
  structures: PlacedStructure[],
  earned: MilestoneId[],
): MilestoneEvent[] {
  const events: MilestoneEvent[] = [];
  const has = (id: MilestoneId) => earned.includes(id);
  const fire = (id: MilestoneId) => {
    const def = MILESTONE_BY_ID[id];
    events.push({ id, label: def.label, detail: def.detail });
  };

  const species = plantedSpecies(items.map((i) => i.plantId));
  const structureIds = structures.map((s) => s.structureId);

  // firstFlower: the very first placement deserves a celebration
  if (items.length >= 1 && !has('firstFlower')) fire('firstFlower');

  // fiveSpecies: 5 distinct species planted -> unlocks bee bath
  if (species.length >= 5 && !has('fiveSpecies')) fire('fiveSpecies');

  // beeBath: first bath placed (also placeable via fiveSpecies unlock)
  if (structureIds.includes('bath') && !has('beeBath')) fire('beeBath');

  // firstHive: first hive placed -> unlocks hedges
  if (structureIds.includes('hive') && !has('firstHive')) fire('firstHive');

  // hedgesUnlocked -> once a hedge exists (milestone copy celebrates shelter)
  if (structureIds.includes('hedge') && !has('hedgesUnlocked')) fire('hedgesUnlocked');

  // tenSpecies: 6 species is the whole palette; the milestone spirit is
  // "maximal diversity" \u2014 with the session-2 palette we award it when the
  // meadow blooms in all four seasons plus every species planted.
  if (species.length >= 6 && !has('tenSpecies')) fire('tenSpecies');

  // yearRoundBloom: every season has at least one blooming species
  if (
    yearRoundBloom(items.map((i) => i.plantId), SEASONS) &&
    !has('yearRoundBloom')
  ) {
    fire('yearRoundBloom');
  }

  return events;
}
