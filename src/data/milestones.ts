export type MilestoneId =
  | 'firstFlower'
  | 'firstSwarm'
  | 'fiveSpecies'
  | 'tenSpecies'
  | 'firstHive'
  | 'beeBath'
  | 'hedgesUnlocked'
  | 'yearRoundBloom'
  | 'hotelGuests'
  | 'rarePollinator'
  | 'wildYearSurvived';

export interface MilestoneDef {
  id: MilestoneId;
  /** soft toast title */
  label: string;
  /** warm toast body (from EDUCATION.md facts or plain cozy copy) */
  detail: string;
  /** structure this unlock makes placeable, if any */
  unlocks?: 'bath' | 'hotel' | 'hedge' | 'wildcorner';
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: 'firstFlower',
    label: 'The first bloom',
    detail: 'Your first flower is in the ground — every meadow starts with one.',
  },
  {
    id: 'firstSwarm',
    label: 'Wings in the air',
    detail: 'Bees are foraging! A colony visits flowers at its own gentle rhythm.',
  },
  {
    id: 'fiveSpecies',
    label: 'A varied buffet',
    detail: 'Five flower species planted! Diverse pollen keeps more bee species visiting.',
    unlocks: 'bath',
  },
  {
    id: 'beeBath',
    label: 'Bee bath placed',
    detail: 'A shallow drink with pebbles \u2014 now thirsty bees have a safe perch.',
  },
  {
    id: 'firstHive',
    label: 'The hive hums',
    detail: 'Your first hive is settled. A colony visits flowers at its own gentle rhythm.',
    unlocks: 'hedge',
  },
  {
    id: 'tenSpecies',
    label: 'Room for everyone',
    detail: 'Solitary bees can check in \u2014 most bee species don\u2019t live in hives at all.',
    unlocks: 'hotel',
  },
  {
    id: 'hedgesUnlocked',
    label: 'Sheltered lanes',
    detail: 'Hedges planted! Bees waste energy flying in wind \u2014 sheltered plots forage better.',
  },
  {
    id: 'yearRoundBloom',
    label: 'No feast, no famine',
    detail: 'Blooms in every season \u2014 your meadow never goes hungry.',
  },
  {
    id: 'hotelGuests',
    label: 'Room 1 is occupied',
    detail: 'Solitary bees have checked into your bee hotel \u2014 more than 70% of bee species live alone, not in hives.',
    unlocks: 'wildcorner',
  },
  {
    id: 'rarePollinator',
    label: 'A rare visitor',
    detail: 'A wool carder bee patrols your wild corner \u2014 unmown corners are the best habitat for wild pollinators.',
  },
  {
    id: 'wildYearSurvived',
    label: 'The corner lived a full year',
    detail: 'Your wild corner has seen every season \u2014 butterflies now have a place to overwinter here.',
  },
];

export const MILESTONE_BY_ID: Record<MilestoneId, MilestoneDef> = Object.fromEntries(
  MILESTONES.map((m) => [m.id, m]),
) as Record<MilestoneId, MilestoneDef>;
