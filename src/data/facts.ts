import type { PlantDef } from './plants';
import type { StructureDef } from './structures';
import type { Season } from './seasons';

/**
 * Every fact below is drawn verbatim (lightly phrased to stay warm) from
 * EDUCATION.md. No other copy may be shown to players.
 *
 * Facts are addressable by ID so the save can track which ones the player
 * has seen. Each object has a base fact plus optional variants (seasonal or
 * context); the notebook prefers unseen content and marks seen ones.
 */

export interface FactEntry {
  id: string;
  text: string;
}

/** base facts, one per object */
export const PLANT_FACTS: Record<string, FactEntry> = {
  lavender: {
    id: 'plant:lavender',
    text: 'Lavender at peak bloom can feed dozens of bumblebees at once — plant enough and you\u2019ll hear the patch before you see it.',
  },
  clover: {
    id: 'plant:clover',
    text: 'A single mason bee can pollinate as many flowers as roughly 100 honeybees — wild bees often outperform hives at pollination.',
  },
  poppy: {
    id: 'plant:poppy',
    text: 'Bees can see ultraviolet — many flowers have landing-strip patterns invisible to us, guiding bees straight to the nectar.',
  },
  sunflower: {
    id: 'plant:sunflower',
    text: 'Bumblebees can shake pollen loose by buzzing at the right frequency — sunflowers in the daisy family love a good hum.',
  },
  thyme: {
    id: 'plant:thyme',
    text: 'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird — tiny thyme flowers are her first canteen.',
  },
  'forget-me-not': {
    id: 'plant:forget-me-not',
    text: 'One in three bites of food depends on pollinators — and this little blue flower opens early, when queens need it most.',
  },
  'crocus': {
    id: 'plant:crocus',
    text: 'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird — a crocus that opens in the cold is her first warm meal.',
  },
  'borage': {
    id: 'plant:borage',
    // verified before adding (AGENTS.md rule): borage refills its nectar within
    // minutes of a visit, unlike most flowers — RHS Plants for Pollinators lists
    // it; quantified by Stawiarz et al. 2020 (5.2g nectar sugar per m²).
    text: 'Borage refills its nectar within minutes of a visit, where most flowers take a day — a patch of these true-blue stars is a busy canteen all afternoon.',
  },
  'cosmos': {
    id: 'plant:cosmos',
    text: 'A meadow of one flower species is a feast-then-famine buffet — cosmos keeps the table set from midsummer deep into autumn.',
  },
  'aster': {
    id: 'plant:aster',
    // verified before adding: asters/michaelmas daisies are a noted late-season
    // nectar source for bees and butterflies (RHS Plants for Pollinators).
    text: 'Bees need blooms from early spring to late autumn — the aster is one of the last canteens open, feeding queens fuelling up before the cold.',
  },
};

export const STRUCTURE_FACTS: Record<string, FactEntry> = {
  hive: {
    // #36: the base fact must be EVERGREEN (the winter-cluster line as the base rendered in every season — the 'static content' read); the winter cluster line lives only in SEASON_VARIANT_FACTS.winter now.
    id: 'structure:hive',
    text: 'Honeybee workers visit 50–100 flowers per foraging trip — a colony can visit millions of flowers in a year.',
  },
  bath: {
    id: 'structure:bath',
    text: 'A shallow dish of water with pebbles gives bees a safe place to drink; without a perch, they can drown in even a birdbath.',
  },
  hotel: {
    id: 'structure:hotel',
    text: 'More than 70% of bee species are solitary — they don\u2019t live in hives, and most are gentle stingers because they have no colony to defend.',
  },
  hedge: {
    id: 'structure:hedge',
    text: 'Bees waste energy flying in wind — a hedge gives them a sheltered lane to forage along.',
  },
  bush: {
    id: 'structure:bush',
    text: 'Leaving a corner of the meadow unmown gives wild bees nesting sites and butterflies a place to overwinter — a low bush is a cozy shelter.',
  },
  wildcorner: {
    id: 'structure:wildcorner',
    text: 'Leaving a corner of the meadow unmown gives wild bees nesting sites and butterflies a place to overwinter.',
  },
};

/** season variants — shown (preferred) when the meadow is in that season */
export const SEASON_VARIANT_FACTS: Record<Season, Record<string, FactEntry>> = {
  spring: {
    'plant:forget-me-not': {
      id: 'variant:fmn-spring',
      text: 'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird — your forget-me-nots are her first canteen.',
    },
    'plant:thyme': {
      id: 'variant:thyme-spring',
      text: 'In spring a queen bumblebee incubates her first eggs like a tiny bird — early thyme is one of the few tables set for her.',
    },
  },
  summer: {
    'plant:lavender': {
      id: 'variant:lavender-summer',
      text: 'Honeybee workers visit 50\u2013100 flowers per foraging trip — a summer lavender patch can feed dozens of bumblebees at once.',
    },
    'plant:sunflower': {
      id: 'variant:sunflower-summer',
      text: 'Bumblebees buzz at just the right frequency to shake pollen loose — tomatoes and sunflowers alike rely on this buzz pollination.',
    },
  },
  autumn: {
    'plant:cosmos': {
      id: 'variant:cosmos-autumn',
      text: 'Honeybee workers visit 50–100 flowers per foraging trip — a cosmos drift keeps them fed on the way to the last asters.',
    },
    'plant:aster': {
      id: 'variant:aster-autumn',
      text: 'A meadow of one flower species is a feast-then-famine buffet — asters are the bridge that carries the meadow into winter.',
    },
    'plant:poppy': {
      id: 'variant:poppy-autumn',
      text: 'A meadow of one flower species is a feast-then-famine buffet — late poppies help bridge the meadow into autumn.',
    },
    'plant:sunflower': {
      id: 'variant:sunflower-autumn',
      text: 'Bees need blooms from early spring to late autumn — a late sunflower is a warm snack before the cold.',
    },
  },
  winter: {
    'plant:crocus': {
      id: 'variant:crocus-winter',
      text: 'In winter, the honeybee colony clusters around the queen and shivers to keep her at a cozy ~21°C — on a mild day, crocuses open for the first brave foragers.',
    },
    'structure:hive': {
      id: 'variant:hive-winter',
      text: 'The colony clusters around the queen right now, shivering to keep her at a cozy ~21\u00b0C — listen, the meadow is quiet but never empty.',
    },
    'plant:lavender': {
      id: 'variant:lavender-winter',
      text: 'One in three bites of food depends on pollinators — the quiet winter patch is bees resting, not bees gone.',
    },
  },
};

/** context facts — surfaced when the surroundings support them (EDUCATION.md) */
export const CONTEXT_FACTS: Record<string, FactEntry> = {
  'context:water-near': {
    id: 'context:water-near',
    text: 'A shallow dish of water with pebbles gives bees a safe place to drink — thirsty foragers can visit this patch without a risky trip.',
  },
  'context:cluster-big': {
    id: 'context:cluster-big',
    text: 'Honeybee workers visit 50\u2013100 flowers per foraging trip, and a colony can visit millions of flowers in a year — drifts like this are a banquet.',
  },
  'context:solitary-near': {
    id: 'context:solitary-near',
    text: 'More than 70% of bee species are solitary — with a bee hotel nearby, some of your visitors don\u2019t belong to any hive at all.',
  },
  'context:shelter-near': {
    id: 'context:shelter-near',
    text: 'Bees waste energy flying in wind — this sheltered spot lets bees spend their energy on flowers instead of fighting the breeze.',
  },
  'context:wild-near': {
    id: 'context:wild-near',
    text: 'A single mason bee can pollinate as many flowers as roughly 100 honeybees — wild bees often outperform hives at pollination.',
  },
};

/** #15 (session 5): wild visitor facts — hoverfly mimicry verified against
 *  reliable sources before adding (Batesian mimicry: harmless hoverflies
 *  mimic stinging bees/wasps; NC State Extension, Wikipedia Syrphidae);
 *  butterfly fact reuses EDUCATION.md's overwintering line. */
export const WILD_VISITOR_FACTS: Record<string, FactEntry> = {
  butterfly: {
    id: 'wild:butterfly',
    text: 'Leaving a corner of the meadow unmown gives butterflies a place to overwinter — this visitor will be back next spring.',
  },
  hoverfly: {
    id: 'wild:hoverfly',
    text: 'This little "bee" is a hoverfly — a harmless mimic with no stinger at all; its disguise fools hungry birds while it sips nectar.',
  },
  // session 7 U2: the seasonal visitors' facts live beside their species'
  // tuning with in-file citations (src/data/seasonalVisitors.ts) — the
  // notebook records share the verified fact text from there
  queenbumble: {
    id: 'wild:queenbumble',
    text: 'A queen bumblebee emerges from winter sleep hungry — the first crocuses of spring are exactly the warm meal she needs to start her whole colony.',
  },
  lavendermoth: {
    id: 'wild:lavendermoth',
    text: 'When the bees go home, moths take the late shift — a lavender patch hums with night visitors long after dusk, pollinating in the dark.',
  },
};

export const MEADOW_FACTS: FactEntry[] = [
  {
    id: 'meadow:one-in-three',
    text: 'One in three bites of food depends on pollinators.',
  },
  {
    id: 'meadow:succession',
    text: 'A meadow of one flower species is a feast-then-famine buffet; bees need blooms from early spring to late autumn.',
  },
  {
    id: 'meadow:wild-corner',
    text: 'Leaving a corner of the meadow unmown gives wild bees nesting sites and butterflies a place to overwinter.',
  },
];

export const SEASON_FACTS: Record<Season, FactEntry> = {
  spring: {
    id: 'season:spring',
    text: 'A queen bumblebee starts the colony alone in spring, incubating her first eggs like a tiny bird.',
  },
  summer: {
    id: 'season:summer',
    text: 'Honeybee workers visit 50\u2013100 flowers per foraging trip, and a colony can visit millions of flowers in a year.',
  },
  autumn: {
    id: 'season:autumn',
    text: 'A meadow of one flower species is a feast-then-famine buffet; bees need blooms from early spring to late autumn.',
  },
  winter: {
    id: 'season:winter',
    text: 'In winter, the honeybee colony clusters around the queen and shivers to keep her at a cozy ~21\u00b0C, feeding on stored honey.',
  },
};

export function factForPlant(def: PlantDef): FactEntry {
  return PLANT_FACTS[def.id] ?? MEADOW_FACTS[0];
}

export function factForStructure(def: StructureDef): FactEntry {
  return STRUCTURE_FACTS[def.id] ?? MEADOW_FACTS[0];
}
