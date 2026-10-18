import { create } from 'zustand';
import {
  loadWorld,
  saveWorld,
} from '../engine/persistence';
import type { PlacedItem, PlacedStructure } from '../engine/persistence';
import { variationFor, type PlacementVariation } from '../engine/variation';
import type { Season } from '../data/seasons';
import type { MilestoneId } from '../data/milestones';

export interface Toast {
  id: number;
  title: string;
  body: string;
}

export interface PlacementState {
  items: PlacedItem[];
  structures: PlacedStructure[];
  milestones: MilestoneId[];
  season: Season;
  selectedPlantId: string | null;
  selectedStructureId: string | null;
  ghostRotationY: number;
  placementVariation: boolean;
  /** the milestone that most recently fired (for the toast stack) */
  toasts: Toast[];
  plant: (item: PlacedItem) => void;
  placeStructure: (s: PlacedStructure) => void;
  removeAt: (id: string) => void;
  removeStructure: (id: string) => void;
  rotateGhost: () => void;
  select: (plantId: string | null) => void;
  selectStructure: (structureId: string | null) => void;
  toggleVariation: () => void;
  setSeason: (season: Season) => void;
  earnMilestone: (id: MilestoneId, label: string, detail: string) => void;
  dismissToast: (id: number) => void;
  save: () => void;
}

const initial = loadWorld();
let toastSeq = 1;

export const usePlacementStore = create<PlacementState>((set, get) => ({
  items: initial.items,
  structures: initial.structures,
  milestones: initial.milestones,
  season: initial.season,
  selectedPlantId: null,
  selectedStructureId: null,
  ghostRotationY: 0,
  placementVariation: initial.placementVariation,
  toasts: [],
  plant: (item) => set((s) => ({ items: [...s.items, item] })),
  placeStructure: (structure) => set((s) => ({ structures: [...s.structures, structure] })),
  removeAt: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  removeStructure: (id) =>
    set((s) => ({ structures: s.structures.filter((it) => it.id !== id) })),
  rotateGhost: () => set((s) => ({ ghostRotationY: s.ghostRotationY + Math.PI / 6 })),
  select: (plantId) => set({ selectedPlantId: plantId, selectedStructureId: null }),
  selectStructure: (structureId) =>
    set({ selectedStructureId: structureId, selectedPlantId: null }),
  toggleVariation: () =>
    set((s) => {
      const next = !s.placementVariation;
      get().save();
      return { placementVariation: next };
    }),
  setSeason: (season) => {
    set({ season });
    get().save();
  },
  earnMilestone: (id, label, detail) => {
    const s = get();
    if (s.milestones.includes(id)) return;
    set({
      milestones: [...s.milestones, id],
      toasts: [...s.toasts, { id: toastSeq++, title: label, body: detail }],
    });
    get().save();
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  save: () => {
    const s = get();
    saveWorld({
      items: s.items,
      structures: s.structures,
      milestones: s.milestones,
      season: s.season,
      placementVariation: s.placementVariation,
      randomRotation: s.placementVariation,
    });
  },
}));

/** Roll placement variation respecting the persisted toggle. */
export function makeVariation(enabled: boolean): PlacementVariation {
  return variationFor(enabled);
}
