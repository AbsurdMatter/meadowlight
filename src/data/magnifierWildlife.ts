/**
 * Session 8 N3 coverage round (PR #38 comment #6300475244): the magnifier
 * shows info for EVERY living thing the hover can reach — hive bees,
 * solitary bees (mason/leafcutter), the rare wool-carder bee, queen
 * bumble, lavender moth, butterflies, hoverflies, fireflies, dragonflies.
 *
 * This is HOVER-WIRING COVERAGE, not new content: every fact below is
 * REUSED from the existing fact store / visitor data (one source — the
 * glass invents no facts, no new state). Sources noted per entry.
 */
export interface WildlifeEntry {
  /** display name (existing naming from the data files) */
  name: string;
  /** the creature's fact — reused verbatim from its existing home */
  fact: string;
  /** the visitor-window key this creature records under (live state source) */
  visitorKey: string | null;
}

import { QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING } from './seasonalVisitors';
import { WILD_VISITOR_FACTS } from './facts';
import { HABITAT_TUNING } from './habitatScenery';
import { MILESTONES } from './milestones';

const rareDetail = MILESTONES.find((m) => m.id === 'rarePollinator')?.detail ?? '';

/** the ONE wildlife table the glass reads (names + facts, all reused) */
export const MAGNIFIER_WILDLIFE: Record<string, WildlifeEntry> = {
  hivebee: {
    name: 'Honeybee worker',
    // source: facts.ts 'context:cluster-big' (the notebook's own bee fact)
    fact: 'Honeybee workers visit 50\u2013100 flowers per foraging trip, and a colony can visit millions of flowers in a year \u2014 drifts like this are a banquet.',
    visitorKey: null,
  },
  solitarybee: {
    name: 'Solitary bee',
    // source: facts.ts 'plant:' store, the mason-bee line the notebook uses
    fact: 'A single mason bee can pollinate as many flowers as roughly 100 honeybees \u2014 wild bees often outperform hives at pollination.',
    visitorKey: null,
  },
  rarebee: {
    name: 'Wool carder bee',
    // source: milestones.ts rarePollinator detail (the toast's own words)
    fact: rareDetail,
    visitorKey: null,
  },
  queenbumble: {
    name: QUEEN_BUMBLE_TUNING.name,
    fact: WILD_VISITOR_FACTS.queenbumble.text,
    visitorKey: 'queenbumble',
  },
  lavendermoth: {
    name: LAVENDER_MOTH_TUNING.name,
    fact: WILD_VISITOR_FACTS.lavendermoth.text,
    visitorKey: 'lavendermoth',
  },
  butterfly: {
    name: 'Butterfly',
    fact: WILD_VISITOR_FACTS.butterfly.text,
    visitorKey: 'butterfly',
  },
  hoverfly: {
    name: 'Hoverfly',
    fact: WILD_VISITOR_FACTS.hoverfly.text,
    visitorKey: 'hoverfly',
  },
  fireflies: {
    name: 'Fireflies',
    // source: the notebook hub's own firefly line (NotebookHub.tsx)
    fact: 'On summer evenings the meadow glows \u2014 fireflies drift over the wild corners while the hive sleeps.',
    visitorKey: 'fireflies',
  },
  dragonfly: {
    name: 'Dragonfly',
    // source: habitatScenery.ts dragonflies.fact (verified, in-file citation)
    fact: HABITAT_TUNING.dragonflies.fact,
    visitorKey: null,
  },
};
