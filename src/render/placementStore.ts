import { create } from 'zustand';
import { loadWorld, saveWorld, DEFAULT_RANDOM_ROTATION } from '../engine/persistence';
import type { PlacedItem } from '../engine/persistence';

export interface PlacementState {
  items: PlacedItem[];
  selectedPlantId: string | null;
  ghostRotationY: number;
  randomRotation: boolean;
  plant: (item: PlacedItem) => void;
  removeAt: (id: string) => void;
  rotateGhost: () => void;
  select: (plantId: string | null) => void;
  toggleRandomRotation: () => void;
  save: () => void;
}

const initial = loadWorld();

export const usePlacementStore = create<PlacementState>((set, get) => ({
  items: initial.items,
  selectedPlantId: null,
  ghostRotationY: 0,
  randomRotation: initial.randomRotation ?? DEFAULT_RANDOM_ROTATION,
  plant: (item) => set((s) => ({ items: [...s.items, item] })),
  removeAt: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  rotateGhost: () =>
    set((s) => ({ ghostRotationY: s.ghostRotationY + Math.PI / 6 })),
  select: (plantId) => set({ selectedPlantId: plantId }),
  toggleRandomRotation: () =>
    set((s) => {
      const next = !s.randomRotation;
      saveWorld(get().items, next);
      return { randomRotation: next };
    }),
  save: () => saveWorld(get().items, get().randomRotation),
}));
