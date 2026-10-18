import type { PlantDef } from './plants';
import type { StructureDef } from './structures';
import type { Season } from './seasons';

/**
 * Every fact below is drawn verbatim (lightly phrased to stay warm) from
 * EDUCATION.md. No other copy may be shown to players.
 */
export const PLANT_FACTS: Record<string, string> = {
  lavender:
    'Lavender at peak bloom can feed dozens of bumblebees at once \u2014 plant enough and you\u2019ll hear the patch before you see it.',
  clover:
    'A single mason bee can pollinate as many flowers as roughly 100 honeybees \u2014 wild bees often outperform hives at pollination.',
  poppy:
    'Bees can see ultraviolet \u2014 many flowers have landing-strip patterns invisible to us, guiding bees straight to the nectar.',
  sunflower:
    'Bumblebees can shake pollen loose by buzzing at the right frequency \u2014 sunflowers in the daisy family love a good hum.',
  thyme:
    'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird \u2014 tiny thyme flowers are her first canteen.',
  'forget-me-not':
    'One in three bites of food depends on pollinators \u2014 and this little blue flower opens early, when queens need it most.',
};

export const STRUCTURE_FACTS: Record<string, string> = {
  hive:
    'In winter, the honeybee colony clusters around the queen and shivers to keep her at a cozy ~21\u00b0C, feeding on stored honey.',
  bath:
    'A shallow dish of water with pebbles gives bees a safe place to drink; without a perch, they can drown in even a birdbath.',
  hotel:
    'More than 70% of bee species are solitary \u2014 they don\u2019t live in hives, and most are gentle stingers because they have no colony to defend.',
  hedge:
    'Bees waste energy flying in wind \u2014 a hedge gives them a sheltered lane to forage along.',
};

export const SEASON_FACTS: Record<Season, string> = {
  spring:
    'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird.',
  summer:
    'Honeybee workers visit 50\u2013100 flowers per foraging trip, and a colony can visit millions of flowers in a year.',
  autumn:
    'A meadow of one flower species is a feast-then-famine buffet; bees need blooms from early spring to late autumn.',
  winter:
    'In winter, the honeybee colony clusters around the queen and shivers to keep her at a cozy ~21\u00b0C, feeding on stored honey.',
};

export const MEADOW_FACTS = [
  'One in three bites of food depends on pollinators.',
  'A meadow of one flower species is a feast-then-famine buffet; bees need blooms from early spring to late autumn.',
  'Leaving a corner of the meadow unmown gives wild bees nesting sites and butterflies a place to overwinter.',
];

export function factForPlant(def: PlantDef): string {
  return PLANT_FACTS[def.id] ?? MEADOW_FACTS[0];
}

export function factForStructure(def: StructureDef): string {
  return STRUCTURE_FACTS[def.id] ?? MEADOW_FACTS[0];
}
