import type { Season } from './seasons';

export interface PlantPart {
  size: [number, number, number];
  offset: [number, number, number];
  color: string;
  /** bloom parts shrink + dull when this species is out of season */
  petal?: boolean;
}

export interface PlantDef {
  id: string;
  name: string;
  /** approximate visual height in world units */
  height: number;
  /** gentle idle sway strength */
  sway: number;
  /** seasons in which this species is in bloom (succession) */
  bloom: Season[];
  parts: PlantPart[];
}

const STEM_GREEN = '#7a9d54';

export const PLANTS: PlantDef[] = [
  {
    id: 'lavender',
    name: 'Lavender',
    height: 1.1,
    sway: 0.08,
    bloom: ['summer'],
    parts: [
      { size: [0.1, 0.7, 0.1], offset: [0, 0.35, 0], color: STEM_GREEN },
      { size: [0.16, 0.34, 0.16], offset: [0, 0.86, 0], color: '#8f7ec9', petal: true },
      { size: [0.12, 0.22, 0.12], offset: [0, 1.1, 0], color: '#a893d6', petal: true },
    ],
  },
  {
    id: 'clover',
    name: 'Clover',
    height: 0.6,
    sway: 0.05,
    bloom: ['spring', 'summer'],
    parts: [
      { size: [0.08, 0.35, 0.08], offset: [0, 0.18, 0], color: '#6f9a4c' },
      { size: [0.28, 0.24, 0.28], offset: [0, 0.46, 0], color: '#e2a3bd', petal: true },
      { size: [0.18, 0.14, 0.18], offset: [0, 0.62, 0], color: '#f0c1d3', petal: true },
    ],
  },
  {
    id: 'poppy',
    name: 'Wild Poppy',
    height: 1.0,
    sway: 0.12,
    bloom: ['summer', 'autumn'],
    parts: [
      { size: [0.08, 0.6, 0.08], offset: [0, 0.3, 0], color: '#8fae67' },
      { size: [0.34, 0.2, 0.34], offset: [0, 0.72, 0], color: '#d24a43', petal: true },
      { size: [0.2, 0.12, 0.2], offset: [0, 0.9, 0], color: '#4a3527', petal: true },
    ],
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    height: 2.0,
    sway: 0.06,
    bloom: ['summer', 'autumn'],
    parts: [
      { size: [0.14, 1.3, 0.14], offset: [0, 0.65, 0], color: '#6d8f4a' },
      { size: [0.4, 0.14, 0.4], offset: [0.14, 0.9, 0], color: '#6d8f4a' },
      { size: [0.44, 0.16, 0.44], offset: [0, 1.42, 0], color: '#f2c14e', petal: true },
      { size: [0.26, 0.14, 0.26], offset: [0, 1.6, 0], color: '#8a5a2b', petal: true },
    ],
  },
  {
    id: 'thyme',
    name: 'Wild Thyme',
    height: 0.4,
    sway: 0.04,
    bloom: ['spring', 'summer'],
    parts: [
      { size: [0.1, 0.18, 0.1], offset: [0, 0.09, 0], color: '#6f8f52' },
      { size: [0.36, 0.16, 0.36], offset: [0, 0.24, 0], color: '#9a7fae', petal: true },
      { size: [0.22, 0.1, 0.22], offset: [0, 0.38, 0], color: '#b79ac9', petal: true },
    ],
  },
  {
    id: 'crocus',
    name: 'Crocus',
    height: 0.35,
    sway: 0.03,
    bloom: ['winter', 'spring'],
    parts: [
      { size: [0.07, 0.12, 0.07], offset: [0, 0.06, 0], color: '#6f8f52' },
      { size: [0.3, 0.22, 0.3], offset: [0, 0.2, 0], color: '#b98fd4', petal: true },
      { size: [0.16, 0.1, 0.16], offset: [0.05, 0.3, 0.02], color: '#cfb0e0', petal: true },
      { size: [0.1, 0.08, 0.1], offset: [-0.04, 0.29, -0.05], color: '#f2c14e', petal: true },
    ],
  },
  {
    id: 'borage',
    name: 'Borage',
    height: 0.9,
    sway: 0.07,
    bloom: ['summer'],
    parts: [
      { size: [0.1, 0.55, 0.1], offset: [0, 0.28, 0], color: '#7a9d54' },
      { size: [0.2, 0.16, 0.2], offset: [0.1, 0.35, 0], color: '#5f8a4a' },
      { size: [0.26, 0.1, 0.26], offset: [0, 0.72, 0], color: '#5b7fc4', petal: true },
      { size: [0.14, 0.1, 0.14], offset: [0, 0.82, 0], color: '#7d9bd8', petal: true },
      { size: [0.08, 0.08, 0.08], offset: [0, 0.9, 0], color: '#4a3527', petal: true },
    ],
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    height: 1.2,
    sway: 0.1,
    bloom: ['summer', 'autumn'],
    parts: [
      { size: [0.08, 0.75, 0.08], offset: [0, 0.38, 0], color: '#8fae67' },
      { size: [0.16, 0.14, 0.16], offset: [-0.14, 0.5, 0.05], color: '#8fae67' },
      { size: [0.36, 0.08, 0.36], offset: [0, 1.0, 0], color: '#e08ba8', petal: true },
      { size: [0.2, 0.12, 0.2], offset: [0, 1.12, 0], color: '#f2c1cf', petal: true },
      { size: [0.1, 0.08, 0.1], offset: [0, 1.2, 0], color: '#8a5a2b', petal: true },
    ],
  },
  {
    id: 'aster',
    name: 'Aster',
    height: 0.8,
    sway: 0.08,
    bloom: ['autumn'],
    parts: [
      { size: [0.09, 0.5, 0.09], offset: [0, 0.25, 0], color: '#6f8f52' },
      { size: [0.3, 0.1, 0.3], offset: [0, 0.62, 0], color: '#8f7ec9', petal: true },
      { size: [0.16, 0.12, 0.16], offset: [0, 0.74, 0], color: '#f2c14e', petal: true },
    ],
  },
  {
    id: 'forget-me-not',
    name: 'Forget-me-not',
    height: 0.55,
    sway: 0.07,
    bloom: ['spring'],
    parts: [
      { size: [0.07, 0.3, 0.07], offset: [0, 0.15, 0], color: '#7a9d54' },
      { size: [0.2, 0.12, 0.2], offset: [0.08, 0.34, 0], color: '#6f9fd8', petal: true },
      { size: [0.2, 0.12, 0.2], offset: [-0.08, 0.3, 0.05], color: '#89b4e6', petal: true },
      { size: [0.16, 0.1, 0.16], offset: [0.02, 0.44, -0.06], color: '#6f9fd8', petal: true },
    ],
  },
];

export const PLANT_BY_ID: Record<string, PlantDef> = Object.fromEntries(
  PLANTS.map((p) => [p.id, p]),
);
