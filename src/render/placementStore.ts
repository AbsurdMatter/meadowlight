import { create } from 'zustand';
import {
  loadWorld,
  saveWorld,
} from '../engine/persistence';
import type { PlacedItem } from '../engine/persistence';
import { variationFor, type PlacementVariation } from '../engine/variation';

export interface PlacementState {
  items: PlacedItem[];
  selectedPlantId: string | null;
  ghostRotationY: number;
  placementVariation: boolean;
  plant: (item: PlacedItem) => void;
  removeAt: (id: string) => void;
  rotateGhost: () => void;
  select: (plantId: string | null) => void;
  toggleVariation: () => void;
  save: () => void;
}

const initial = loadWorld();
export const usePlacementStore = create<PlacementState>((set, get) => ({
  items: initial.items,
  selectedPlantId: null,
  ghostRotationY: 0,
  placementVariation: initial.placementVariation,
  plant: (item) => set((s) => ({ items: [...s.items, item] })),
  removeAt: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  rotateGhost: () => set((s) => ({ ghostRotationY: s.ghostRotationY + Math.PI / 6 })),
  select: (plantId) => set({ selectedPlantId: plantId }),
  toggleVariation: () =>
    set((s) => {
      const next = !s.placementVariation;
      get().save();
      return { placementVariation: next };
    }),
  save: () => {
    const s = get();
    saveWorld({
      items: s.items,
      placementVariation: s.placementVariation,
    });
  },
}));

/** Roll placement variation respecting the persisted toggle. */
export function makeVariation(enabled: boolean): PlacementVariation {
  return variationFor(enabled);
}
