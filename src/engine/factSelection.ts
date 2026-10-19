import {
  PLANT_FACTS,
  STRUCTURE_FACTS,
  SEASON_VARIANT_FACTS,
  CONTEXT_FACTS,
  MEADOW_FACTS,
  SEASON_FACTS,
  type FactEntry,
} from '../data/facts';
import type { Season } from '../data/seasons';
import type { PlacedItem, PlacedStructure } from './persistence';

/**
 * Pure fact selection for the ambient notebook: pick the fact variant to show
 * for a clicked object, preferring content the player hasn't seen yet and
 * preferring season/context-appropriate variants. Never hard-hides anything —
 * if everything has been seen, the most fitting variant is shown again.
 */

export interface FactChoice {
  fact: FactEntry;
  /** true if this exact fact was already seen before this pick */
  alreadySeen: boolean;
}

/** radius for "nearby context" checks (matches pollinator forage scale) */
const CONTEXT_RADIUS = 14;
/** a flower drift counts as a "big cluster" at this count nearby */
const CLUSTER_BIG = 12;

export function choosePlantFact(
  plantId: string,
  season: Season,
  items: PlacedItem[],
  structures: PlacedStructure[],
  seenFacts: string[],
  clickedPosition: [number, number, number],
): FactChoice {
  const base = PLANT_FACTS[plantId] ?? MEADOW_FACTS[0];
  const candidates: FactEntry[] = [base];

  const variant = SEASON_VARIANT_FACTS[season][base.id];
  if (variant) candidates.unshift(variant);

  // context facts the surroundings support
  const nearbySameSpecies = items.filter(
    (it) =>
      it.plantId === plantId &&
      Math.hypot(it.position[0] - clickedPosition[0], it.position[2] - clickedPosition[2]) <= 3.5,
  ).length;
  const near = (list: { position: [number, number, number] }[]) =>
    list.filter(
      (st) =>
        Math.hypot(st.position[0] - clickedPosition[0], st.position[2] - clickedPosition[2]) <=
        CONTEXT_RADIUS,
    );
  const hasBath = near(structures).some((s) => (s as PlacedStructure).structureId === 'bath');
  const hasHotel = near(structures).some((s) => (s as PlacedStructure).structureId === 'hotel');
  const hasHedge = near(structures).some((s) => (s as PlacedStructure).structureId === 'hedge');
  const hasWild = near(structures).some((s) => (s as PlacedStructure).structureId === 'wildcorner');
  if (hasBath) candidates.push(CONTEXT_FACTS['context:water-near']);
  if (nearbySameSpecies >= CLUSTER_BIG) candidates.push(CONTEXT_FACTS['context:cluster-big']);
  if (hasHotel) candidates.push(CONTEXT_FACTS['context:solitary-near']);
  if (hasHedge) candidates.push(CONTEXT_FACTS['context:shelter-near']);
  if (hasWild) candidates.push(CONTEXT_FACTS['context:wild-near']);

  return pick(candidates, seenFacts);
}

export function chooseStructureFact(
  structureId: string,
  season: Season,
  seenFacts: string[],
): FactChoice {
  const base = STRUCTURE_FACTS[structureId] ?? MEADOW_FACTS[0];
  const candidates: FactEntry[] = [base];
  const variant = SEASON_VARIANT_FACTS[season][base.id];
  if (variant) candidates.unshift(variant);
  return pick(candidates, seenFacts);
}

export function chooseMeadowFact(season: Season, seenFacts: string[]): FactChoice {
  const candidates: FactEntry[] = [...MEADOW_FACTS, SEASON_FACTS[season]];
  return pick(candidates, seenFacts);
}

function pick(candidates: FactEntry[], seenFacts: string[]): FactChoice {
  const unseen = candidates.filter((c) => !seenFacts.includes(c.id));
  if (unseen.length > 0) return { fact: unseen[0], alreadySeen: false };
  return { fact: candidates[0], alreadySeen: true };
}
