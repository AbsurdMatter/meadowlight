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
import { SEEDING_FACTS } from '../data/seeding';
import { rollVolunteers } from '../engine/seeding';
import { isPlantableCell } from '../engine/ground';
import { flowerBlocked } from '../engine/collision';
import { groundAt } from '../engine/ground';
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
  /**
   * U1 (session 7): the world's named seed state — deterministic key for
   * every seeding roll, the exact counterpart of dayPhase/season (one
   * definition, persisted v7 additive). Old saves got theirs derived at
   * load; fresh worlds roll one at boot.
   */
  worldSeed: number;
  /** U1: season rollovers this world has seeded (persisted v7 additive) */
  seedingEpoch: number;
  /**
   * U2: seasonal visitor windows — (visitorId, season) pairs, one entry
   * per visit-window (persisted v7 additive; the notebook reads it).
   */
  visitorWindows: string[];
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
/** one quiet mention of self-seeding per world, ever (the meadow teaches once) */
let volunteerToastShown = initial.items.some((it) => it.volunteer);

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
    // U1: crossing into a different season is a rollover for the flora —
    // the dial seeds exactly like the natural calendar (one shared site)
    if (get().season !== season) seedVolunteers(season, false);
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
    // U1 (session 7): self-seeding rides the ONE season-advance site — one
    // deterministic roll per rollover, keyed on the world's named seed
    // state + epoch. The dial (setSeason) crosses a season boundary too and
    // shares this helper; nothing else may seed.
    seedVolunteers(season, false);
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
  worldSeed: initial.worldSeed ?? 12345,
  seedingEpoch: initial.seedingEpoch ?? 0,
  visitorWindows: initial.visitorWindows ?? [],
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
      worldSeed: Math.floor(Math.random() * 2147483647),
      seedingEpoch: 0,
      visitorWindows: [],
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
      worldSeed: w.worldSeed ?? 12345,
      seedingEpoch: w.seedingEpoch ?? 0,
      visitorWindows: w.visitorWindows ?? [],
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
      worldSeed: s.worldSeed,
      seedingEpoch: s.seedingEpoch,
      visitorWindows: s.visitorWindows,
    });
  },
}));

/**
 * U1: the ONE seeding site — called only from the season-boundary crossings
 * (arriveAtSeason / setSeason). Parents = flowers that bloomed in the season
 * just ended; children are roster-compatible, land only in RAW-query
 * plantable cells (isPlantableCell — the same classification the overlay,
 * ghost, and click path use), and are ordinary items the moment they exist:
 * clearable like any plant, rendered like any plant, persisted like any
 * plant (with volunteer: true so the notebook can say who planted them).
 */
function seedVolunteers(season: Season, announce: boolean): void {
  const s = usePlacementStore.getState();
  const seeds = rollVolunteers(
    s.items,
    s.season,
    season,
    s.worldSeed,
    s.seedingEpoch,
    isPlantableCell,
    (x, z) => flowerBlocked(x, z, s.structures),
  );
  if (seeds.length === 0) {
    // the epoch still advances: a no-seed rollover consumed its roll
    usePlacementStore.setState({ seedingEpoch: s.seedingEpoch + 1 });
    return;
  }
  usePlacementStore.setState((cur) => {
    const newItems = seeds.map((seed, i): PlacedItem => ({
      id: `volunteer:${cur.worldSeed}:${cur.seedingEpoch}:${i}`,
      plantId: seed.plantId,
      position: [seed.position[0], groundAt(seed.position[0], seed.position[2]).height, seed.position[2]],
      rotationY: 0,
      phase: seed.phase,
      variation: seed.variation,
      volunteer: true,
    }));
    const toasts =
      announce && !volunteerToastShown
        ? [
            ...cur.toasts,
            {
              id: toastSeq++,
              title: 'The meadow seeds itself',
              body: SEEDING_FACTS.volunteer,
            },
          ]
        : cur.toasts;
    if (announce && seeds.length > 0) volunteerToastShown = true;
    return {
      items: [...cur.items, ...newItems],
      seedingEpoch: cur.seedingEpoch + 1,
      toasts,
    };
  });
}

/** Roll placement variation respecting the persisted toggle. */
export function makeVariation(enabled: boolean): PlacementVariation {
  return variationFor(enabled);
}
