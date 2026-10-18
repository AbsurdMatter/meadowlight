export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_INFO: Record<Season, { label: string; emoji: string; tip: string }> = {
  spring: {
    label: 'Spring',
    emoji: '\u{1F33C}',
    tip: 'Early blooms wake the queens \u2014 thyme and forget-me-nots lead.',
  },
  summer: {
    label: 'Summer',
    emoji: '\u{1F41D}',
    tip: 'Peak forage \u2014 lavender hums before you see it.',
  },
  autumn: {
    label: 'Autumn',
    emoji: '\u{1F341}',
    tip: 'Poppies and sunflowers keep the table set late.',
  },
  winter: {
    label: 'Winter',
    emoji: '\u2744\uFE0F',
    tip: 'The colony clusters round the queen, living on stored honey.',
  },
};
