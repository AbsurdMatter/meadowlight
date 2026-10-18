import type { PlantPart } from './plants';

export type StructureId = 'hive' | 'bath' | 'hotel' | 'hedge' | 'wildcorner';

export interface StructureDef {
  id: StructureId;
  name: string;
  emoji: string;
  /** world radius used for placement delete hit-testing */
  radius: number;
  /** footprint radius for collision: nothing may be placed overlapping this */
  footprint: number;
  parts: PlantPart[];
}

const WOOD = '#8a5a2b';
const DARK_WOOD = '#6d4420';
const STRAW = '#d9b36a';

const TUFT_GREEN = '#7d9b4e';
const TUFT_DRY = '#b0a45f';
const STALK = '#a98d4f';

export const STRUCTURES: StructureDef[] = [
  {
    id: 'hive',
    name: 'Skep Hive',
    emoji: '\u{1F41D}',
    radius: 1.4,
    footprint: 1.5,
    parts: [
      { size: [1.2, 0.22, 1.2], offset: [0, 0.11, 0], color: DARK_WOOD },
      { size: [1.1, 0.42, 1.1], offset: [0, 0.42, 0], color: STRAW },
      { size: [0.95, 0.42, 0.95], offset: [0, 0.83, 0], color: '#e0bc78' },
      { size: [0.75, 0.42, 0.75], offset: [0, 1.24, 0], color: STRAW },
      { size: [0.55, 0.38, 0.55], offset: [0, 1.62, 0], color: '#e0bc78' },
      { size: [0.2, 0.16, 0.2], offset: [0, 1.85, 0], color: DARK_WOOD },
      { size: [0.5, 0.2, 0.06], offset: [0, 0.28, 0.56], color: '#5a3a18' },
      { size: [0.14, 0.14, 0.14], offset: [0.34, 1.86, 0], color: '#f2c14e' },
    ],
  },
  {
    id: 'bath',
    name: 'Bee Bath',
    emoji: '\u{1FA7B}',
    radius: 1.1,
    footprint: 1.2,
    parts: [
      { size: [0.9, 0.4, 0.9], offset: [0, 0.2, 0], color: '#b8b0a0' },
      { size: [1.1, 0.16, 1.1], offset: [0, 0.46, 0], color: '#cfc8ba' },
      { size: [0.96, 0.08, 0.96], offset: [0, 0.56, 0], color: '#8fc1dd' },
      { size: [0.18, 0.1, 0.18], offset: [0.28, 0.62, 0.12], color: '#9a8f7d' },
      { size: [0.15, 0.09, 0.15], offset: [-0.22, 0.61, -0.18], color: '#8a7f6c' },
      { size: [0.12, 0.08, 0.12], offset: [0.02, 0.62, -0.3], color: '#a39886' },
    ],
  },
  {
    id: 'hotel',
    name: 'Bee Hotel',
    emoji: '\u{1F3E8}',
    radius: 0.9,
    footprint: 1.0,
    parts: [
      { size: [0.5, 1.5, 0.5], offset: [0, 0.55, 0], color: WOOD },
      { size: [0.8, 0.1, 0.8], offset: [0, 1.36, 0], color: DARK_WOOD },
      { size: [0.16, 0.16, 0.1], offset: [-0.12, 0.45, 0.26], color: '#c9a26a' },
      { size: [0.16, 0.16, 0.1], offset: [0.13, 0.45, 0.26], color: '#7d9f54' },
      { size: [0.16, 0.16, 0.1], offset: [-0.12, 0.75, 0.26], color: '#d8c49a' },
      { size: [0.16, 0.16, 0.1], offset: [0.13, 0.75, 0.26], color: '#c98a4a' },
      { size: [0.16, 0.16, 0.1], offset: [-0.12, 1.05, 0.26], color: '#7d9f54' },
      { size: [0.16, 0.16, 0.1], offset: [0.13, 1.05, 0.26], color: '#c9a26a' },
    ],
  },
  {
    id: 'hedge',
    name: 'Hedge',
    emoji: '\u{1F33F}',
    radius: 1.2,
    footprint: 1.4,
    parts: [
      { size: [2.0, 0.5, 0.55], offset: [-0.6, 0.25, 0], color: '#5f7a45' },
      { size: [1.7, 0.5, 0.5], offset: [0.55, 0.25, 0.06], color: '#6c8a4f' },
      { size: [1.6, 0.45, 0.45], offset: [-0.5, 0.7, 0.04], color: '#6c8a4f' },
      { size: [1.4, 0.42, 0.42], offset: [0.5, 0.68, 0.02], color: '#5f7a45' },
      { size: [1.2, 0.35, 0.38], offset: [-0.1, 1.02, 0.02], color: '#77995b' },
      { size: [0.3, 0.25, 0.2], offset: [-0.85, 0.55, 0.28], color: '#77995b' },
      { size: [0.28, 0.2, 0.2], offset: [0.9, 0.5, 0.3], color: '#77995b' },
    ],
  },
  {
    id: 'wildcorner',
    name: 'Wild Corner',
    emoji: '\u{1F33F}',
    radius: 1.3,
    footprint: 0.9,
    parts: [
      { size: [1.6, 0.12, 1.6], offset: [0, 0.06, 0], color: '#9a8352' },
      { size: [0.16, 0.7, 0.16], offset: [-0.5, 0.35, -0.3], color: TUFT_GREEN },
      { size: [0.14, 0.55, 0.14], offset: [-0.28, 0.28, 0.32], color: TUFT_DRY },
      { size: [0.18, 0.85, 0.18], offset: [0.02, 0.43, -0.48], color: TUFT_GREEN },
      { size: [0.13, 0.5, 0.13], offset: [0.34, 0.25, 0.4], color: TUFT_DRY },
      { size: [0.12, 0.9, 0.12], offset: [0.5, 0.45, 0.05], color: TUFT_GREEN },
      { size: [0.1, 0.6, 0.1], offset: [-0.12, 0.3, 0.55], color: STALK },
      { size: [0.22, 0.18, 0.22], offset: [0.42, 0.09, -0.42], color: '#8a7343' },
      { size: [0.1, 0.45, 0.1], offset: [-0.62, 0.22, 0.18], color: STALK },
    ],
  },
];

export const STRUCTURE_BY_ID: Record<StructureId, StructureDef> = Object.fromEntries(
  STRUCTURES.map((s) => [s.id, s]),
) as Record<StructureId, StructureDef>;
