import { create } from 'zustand';
import type { PlacedItem } from '../engine/persistence';
import { loadWorld, saveWorld } from '../engine/persistence';

export interface PlacementState {
  items: PlacedItem[];
  selectedPlantId: string | null;
  ghostRotationY: number;
  plant: (item: PlacedItem) => void;
  removeAt: (id: string) => void;
  rotateGhost: () => void;
  select: (plantId: string | null) => void;
  save: () => void;
}

export const usePlacementStore = create<PlacementState>((set, get) => ({
  items: loadWorld(),
  selectedPlantId: null,
  ghostRotationY: 0,
  plant: (item) => set((s) => ({ items: [...s.items, item] })),
  removeAt: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  rotateGhost: () =>
    set((s) => ({ ghostRotationY: s.ghostRotationY + Math.PI / 6 })),
  select: (plantId) => set({ selectedPlantId: plantId }),
  save: () => saveWorld(get().items),
}));
