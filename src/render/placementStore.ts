import { create } from 'zustand';
import {
  loadWorld,
  saveWorld,
  clearSavedWorld,
} from '../engine/persistence';
import type { PlacedItem, PlacedStructure } from '../engine/persistence';
import { variationFor, type PlacementVariation } from '../engine/variation';
import type { Season } from '../data/seasons';
import { setDayPhase, dayPhase } from '../engine/dayCycle';
import {
  forceSeason,
  resumeSeasonClock,
  seasonProgress,
  setSeasonProgressForTest,
} from '../engine/seasonClock';
import { SEASON_ARRIVAL } from '../data/seasons';
import { newlyFormed, companionSet } from '../engine/companions';
import { combReady, fillAfterHarvest } from '../engine/honey';
import { HONEY_FACTS } from '../data/honey';
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
  notebook:
    | { kind: 'plant' | 'structure' | 'meadow'; id: string; instanceId?: string }
    | null;
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
  /** #11: natural season rollover — store label + gentle toast, one path */
  arriveAtSeason: (season: Season, announce: boolean) => void;
  /** #11: P panel / tests — release the manual override, calendar drifts */
  resumeSeasonClock: () => void;
  /** #11: readback for the P panel / test hook */
  seasonProgress: () => number;
  /** #11: tests only — drive the calendar boundary directly */
  setSeasonProgressForTest: (p: number) => void;
  /** #9: discovered companion-recipe ids (persisted, v6 additive) */
  foundRecipes: string[];
  /** #9: scan for newly formed recipes — toast + unlock on first form */
  checkCompanions: () => void;
  /** #9: P panel readback — which recipes are currently formed */
  activeRecipes: () => string[];
  /** #10: per-hive comb fill 0..1 (ONE shared source; persisted v6) */
  hiveCombs: Record<string, number>;
  /** #10: set a hive's comb fill (the foraging loop + P panel write here) */
  setComb: (hiveId: string, fill: number) => void;
  /** #10: lifetime jars of honey brought in (persisted v6) */
  honeyJars: number;
  /** #10: harvest a ready hive — jar + ceremony state + warm fact toast */
  harvestHoney: (hiveId: string) => boolean;
  /** #10: hive ids currently mid-harvest-dip (the render reads this) */
  harvestDips: Record<string, number>;
  /** #36 hive popup: the hive the popup is anchored to (null = closed) */
  hivePopup: string | null;
  openHivePopup: (hiveId: string) => void;
  closeHivePopup: () => void;
  earnMilestone: (id: MilestoneId, label: string, detail: string) => void;
  dismissToast: (id: number) => void;
  openNotebook: (entry: PlacementState['notebook']) => void;
  closeNotebook: () => void;
  /** full reset: empty world + cleared save + default season/milestones */
  resetWorld: () => void;
  /**
   * #30: dev-only reload-from-save. Discards ALL in-memory state and
   * rehydrates purely from the localStorage blob — the exact loadWorld()
   * path a fresh page load takes (including the corrupt/unknown-version
   * fallback: blob backed up, fresh world booted). Critically does NOT
   * save() first, so a save round-trip test observes what was actually
   * persisted, never the live objects it was saved from.
   */
  reloadFromSave: () => void;
  save: () => void;
}

const initial = loadWorld();
// #13: resume the day cycle where the save left it (absent = golden hour)
if (typeof initial.dayPhase === 'number') setDayPhase(initial.dayPhase);
// #11: resume the season calendar where the save left it (absent = season
// start). Boundary semantics live in ONE place: a loaded position < 1.0 is
// mid-season by definition; the rollover math (advanceSeasons) is the only
// code that ever crosses a season boundary, so save->reload->resume can
// never re-interpret a boundary differently than live play did.
setSeasonProgressForTest(initial.seasonProgress ?? 0);
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
  plant: (item) => {
    set((s) => ({ items: [...s.items, item] }));
    // #9: a new flower may complete a recipe — discover it warmly
    get().checkCompanions();
  },
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
    // #11: the manual dial is the SAME override path the P panel uses —
    // one trigger pattern (forceSeason holds the calendar; resume releases)
    forceSeason(season);
    set((s) => {
      const hasWildCorner = s.structures.some((st) => st.structureId === 'wildcorner');
      if (!hasWildCorner || s.wildSeasons.includes(season)) return { season };
      return { season, wildSeasons: [...s.wildSeasons, season] };
    });
    get().save();
  },
  arriveAtSeason: (season, announce) => {
    set((s) => {
      const hasWildCorner = s.structures.some((st) => st.structureId === 'wildcorner');
      const wildSeasons =
        hasWildCorner && !s.wildSeasons.includes(season)
          ? [...s.wildSeasons, season]
          : s.wildSeasons;
      const toast = announce
        ? { id: toastSeq++, title: 'A season drifts in', body: SEASON_ARRIVAL[season] }
        : null;
      return toast ? { season, wildSeasons, toasts: [...s.toasts, toast] } : { season, wildSeasons };
    });
    get().save();
  },
  resumeSeasonClock: () => {
    resumeSeasonClock();
    get().save();
  },
  seasonProgress: () => seasonProgress(),
  setSeasonProgressForTest: (p) => setSeasonProgressForTest(p),
  foundRecipes: initial.foundRecipes ?? [],
  checkCompanions: () => {
    const s = get();
    const fresh = newlyFormed(s.items, s.foundRecipes);
    if (fresh.length === 0) return;
    // discovery is a delight, never a lecture: one warm toast per recipe,
    // notebook entry unlocks silently beside it
    set({
      foundRecipes: [...s.foundRecipes, ...fresh.map((r) => r.id)],
      toasts: [
        ...s.toasts,
        ...fresh.map((r) => ({
          id: toastSeq++,
          title: 'A garden recipe!',
          body: `${r.label} — ${r.fact}`,
        })),
      ],
    });
    get().save();
  },
  activeRecipes: () => companionSet(get().items).active.map((r) => r.id),
  hiveCombs: initial.hiveCombs ?? {},
  setComb: (hiveId, fill) => {
    const s = get();
    const next = Math.min(1, Math.max(0, fill));
    if (s.hiveCombs[hiveId] === next) return;
    set({ hiveCombs: { ...s.hiveCombs, [hiveId]: next } });
  },
  honeyJars: initial.honeyJars ?? 0,
  harvestDips: {},
  hivePopup: null,
  openHivePopup: (hiveId) => set({ hivePopup: hiveId }),
  closeHivePopup: () => set({ hivePopup: null }),
  harvestHoney: (hiveId) => {
    const s = get();
    const fill = s.hiveCombs[hiveId] ?? 0;
    if (!combReady(fill)) return false;
    // the ceremony: the hive dips and settles (render reads harvestDips),
    // the jar arrives with a toast carrying a real EDUCATION.md fact
    set({
      honeyJars: s.honeyJars + 1,
      hiveCombs: { ...s.hiveCombs, [hiveId]: fillAfterHarvest() },
      harvestDips: { ...s.harvestDips, [hiveId]: performance.now() },
      toasts: [
        ...s.toasts,
        {
          id: toastSeq++,
          title: '\u{1F36B} A jar of honey!',
          body: HONEY_FACTS.harvest,
        },
      ],
    });
    get().save();
    return true;
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
      // #11: reset returns the calendar to a fresh summer start, unheld
      toasts: [],
      modalOpen: false,
      seenFacts: [],
      wildSeasons: [],
      onboardingDismissed: false,
      foundRecipes: [],
      hiveCombs: {},
      honeyJars: 0,
      harvestDips: {},
      hivePopup: null,
    });
    forceSeason('summer');
    resumeSeasonClock();
    setSeasonProgressForTest(0);
    get().save();
  },
  reloadFromSave: () => {
    const w = loadWorld();
    const n = w.items.length + w.structures.length;
    console.log(
      `[reload] reloaded from save — ${w.items.length} items, ${w.structures.length} structures (blob v${w.version})`,
    );
    set({
      items: w.items,
      structures: w.structures,
      milestones: w.milestones,
      season: w.season,
      selectedPlantId: null,
      selectedStructureId: null,
      notebook: null,
      toasts: [
        {
          id: toastSeq++,
          title: 'Reloaded from save',
          body: `${n} piece${n === 1 ? '' : 's'} of the meadow came back from the saved blob.`,
        },
      ],
      modalOpen: false,
      seenFacts: w.seenFacts ?? [],
      wildSeasons: w.wildSeasons ?? [],
      onboardingDismissed: w.onboardingDismissed ?? false,
      placementVariation: w.placementVariation,
      foundRecipes: w.foundRecipes ?? [],
      hiveCombs: w.hiveCombs ?? {},
      honeyJars: w.honeyJars ?? 0,
    });
    // #11: the reload must re-derive the calendar position from the blob —
    // same semantics as a fresh page load, not the live clock
    setSeasonProgressForTest(w.seasonProgress ?? 0);
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
      dayPhase: dayPhase(),
      seasonProgress: seasonProgress(),
      foundRecipes: s.foundRecipes,
      hiveCombs: s.hiveCombs,
      honeyJars: s.honeyJars,
    });
  },
}));

/** Roll placement variation respecting the persisted toggle. */
export function makeVariation(enabled: boolean): PlacementVariation {
  return variationFor(enabled);
}
