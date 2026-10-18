import { create } from 'zustand';
import {
  loadWorld,
  saveWorld,
  clearSavedWorld,
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
  notebook: { kind: 'plant' | 'structure' | 'meadow'; id: string } | null;
  /** ids of facts the player has seen (persisted, additive save field) */
  seenFacts: string[];
  markFactSeen: (id: string) => void;
  /** seasons a wild corner has been present for (persisted, v4 additive) */
  wildSeasons: string[];
  /** true once onboarding was dismissed — overlay never shows again (v4) */
  onboardingDismissed: boolean;
  dismissOnboarding: () => void;
  /** true while a blocking dialog (reset confirmation) is open: no placement */
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
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
  openNotebook: (entry: PlacementState['notebook']) => void;
  closeNotebook: () => void;
  /** full reset: empty world + cleared save + default season/milestones */
  resetWorld: () => void;
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
  notebook: null,
  modalOpen: false,
  seenFacts: initial.seenFacts ?? [],
  wildSeasons: initial.wildSeasons ?? [],
  onboardingDismissed: initial.onboardingDismissed ?? false,
  dismissOnboarding: () => {
    set({ onboardingDismissed: true });
    get().save();
  },
  markFactSeen: (id) =>
    set((s) => (s.seenFacts.includes(id) ? s : { seenFacts: [...s.seenFacts, id] })),
  setModalOpen: (open) => set({ modalOpen: open }),
  plant: (item) => set((s) => ({ items: [...s.items, item] })),
  placeStructure: (structure) =>
    set((s) => ({
      structures: [...s.structures, structure],
      wildSeasons:
        structure.structureId === 'wildcorner' && !s.wildSeasons.includes(s.season)
          ? [...s.wildSeasons, s.season]
          : s.wildSeasons,
    })),
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
    set((s) => {
      const hasWildCorner = s.structures.some((st) => st.structureId === 'wildcorner');
      if (!hasWildCorner || s.wildSeasons.includes(season)) return { season };
      return { season, wildSeasons: [...s.wildSeasons, season] };
    });
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
  openNotebook: (entry) => set({ notebook: entry }),
  closeNotebook: () => set({ notebook: null }),
  resetWorld: () => {
    clearSavedWorld();
    set({
      items: [],
      structures: [],
      milestones: [],
      season: 'summer',
      selectedPlantId: null,
      selectedStructureId: null,
      notebook: null,
      toasts: [],
      modalOpen: false,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: false,
    });
    get().save();
  },
  save: () => {
    const s = get();
    saveWorld({
      items: s.items,
      structures: s.structures,
      milestones: s.milestones,
      season: s.season,
      placementVariation: s.placementVariation,
      randomRotation: s.placementVariation,
      seenFacts: s.seenFacts,
      wildSeasons: s.wildSeasons,
      onboardingDismissed: s.onboardingDismissed,
    });
  },
}));

/** Roll placement variation respecting the persisted toggle. */
export function makeVariation(enabled: boolean): PlacementVariation {
  return variationFor(enabled);
}
