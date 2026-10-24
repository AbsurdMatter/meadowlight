export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/**
 * #11 (session 6): auto-advancing season length, seconds. 12 sits in the
 * approved 10–15 min window and pairs with the 12-minute day — one day
 * of in-world light per season reads as a gentle "week" of meadow time.
 * Tuning value: lives here, never hardcoded in components.
 */
/**
 * Session-8 close round (#6384616654): seasons shortened 25% for pacing
 * (720s -> 540s, a 9-minute season). ONE source: the season clock, the
 * rain windows (gap/len are season fractions — they compress with it),
 * bloom windows (relative), and every pacing reference derive from this
 * constant; nothing hand-copies the number.
 */
export const SEASON_SECONDS = 540;
/** gentle toast copy when the calendar rolls into a new season (#11) */
export const SEASON_ARRIVAL: Record<Season, string> = {
  spring: 'The meadow turns to spring — early blooms wake the queens.',
  summer: 'The meadow turns to summer — lavender and borage hum before you see them.',
  autumn: 'The meadow turns to autumn — asters keep the table set late.',
  winter: 'The meadow settles into winter — the hive clusters, cozy and quiet.',
};

export const SEASON_INFO: Record<Season, { label: string; emoji: string; tip: string }> = {
  spring: {
    label: 'Spring',
    emoji: '\u{1F33C}',
    tip: 'Early blooms wake the queens \u2014 crocuses, thyme and forget-me-nots lead.',
  },
  summer: {
    label: 'Summer',
    emoji: '\u{1F41D}',
    tip: 'Peak forage \u2014 lavender and borage hum before you see them.',
  },
  autumn: {
    label: 'Autumn',
    emoji: '\u{1F341}',
    tip: 'Cosmos, asters and poppies keep the table set late.',
  },
  winter: {
    label: 'Winter',
    emoji: '\u2744\uFE0F',
    tip: 'Quiet days — crocuses open early for the first brave foragers.',
  },
};
