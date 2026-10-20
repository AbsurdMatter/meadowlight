import { usePlacementStore } from '../render/placementStore';
import { variationFor } from './variation';
import { groundAt } from './ground';
import { isBuildable } from './ground';
import type { PlacedItem, PlacedStructure } from './persistence';
import type { StructureId } from '../data/structures';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { Size } from '@react-three/fiber';
import { beeDebug } from '../render/BeeSwarm';
import { wildDebug } from '../render/WildPollinators';
import { fireflyDebug } from '../render/Fireflies';
import { setDayPhase } from './dayCycle';
import { precipitationVisual } from './weather';
import { precipReadback, tickPrecipScheduleForTest } from './rainSchedule';
import { allWildlife } from '../render/magnifierProbes';
import { dayPhase } from './dayCycle';
import { seasonProgress, seasonClockOverridden } from './seasonClock';
import { honeyDebug } from '../render/BeeSwarm';
import { setSpeedStep, setPaused, isPaused, currentSpeedStep, timeMultiplier, type SpeedStep } from './timeControl';
import { scaledElapsed } from './scaledTime';
import { colonyReadback } from './lifecycle';
import { cornerFoldCells, pondSegments, fringeCells } from '../data/habitatScenery';
import { dragonflyDebug } from '../render/HabitatScenery';
import { starsDebug } from '../render/NightSky';
import { starVisibility } from './nightSky';
import { NIGHT_SKY_TUNING } from '../data/nightSky';
import { isPlantableCell } from './ground';
import { hillsBoxes } from './hillsLayout';
import { setFireflyForce } from '../render/Fireflies';
import { rainDebug } from '../render/Rain';
import { solitaryBeeDebug, rareBeeDebug } from '../render/SolitaryBees';
import { capturePostcardPng } from './postcard';
import { audioDebugInfo, audioRunning } from './audio';
import { ghostDebug } from '../render/PlacementSystem';

declare global {
  interface Window {
    __meadowlight?: {
      plant: (plantId: string, x: number, z: number) => void;
      placeStructure: (structureId: StructureId, x: number, z: number) => void;
      removeAt: (id: string) => void;
      removeStructure: (id: string) => void;
      items: () => PlacedItem[];
      structures: () => PlacedStructure[];
      clear: () => void;
      setSeason: (season: 'spring' | 'summer' | 'autumn' | 'winter') => void;
      /** #11: release the manual/P-panel season override */
      resumeSeasonClock: () => void;
      /** #11: 0..1 progress through the current season (readback) */
      seasonProgressReadback: () => number;
      /** #11: tests only — drive the calendar position directly */
      setSeasonProgressForTest: (p: number) => void;
      /** #11: true while the calendar is held by an override */
      seasonClockOverridden: () => boolean;
      /** U1 (session 7): the world's named seed state + epoch (readback) */
      worldSeedReadback: () => number;
      seedingEpochReadback: () => number;
      /** U1: id -> volunteer flag for every item (persisted in the save) */
      volunteersReadback: () => { id: string; plantId: string; volunteer: boolean }[];
      /** N2: per-flower visit ledger (id -> visited seasons) */
      visitsReadback: () => { id: string; plantId: string; visitedSeasons: string[] }[];
      /** N3: the magnifying-glass inspect tool (pure inspection, zero mutation) */
      magnifierReadback: () => { on: boolean; entry: unknown };
      toggleMagnifier: () => void;
      setMagnifierEntryForTest: (e: unknown) => void;
      /** N3 coverage: live wildlife sightings the glass can reach (read-only) */
      wildlifeSightings: () => unknown[];
      /** U2: visitor-window log — (visitorId, season) pairs, one per window */
      visitorWindowsReadback: () => string[];
      /** U3: the colony breath — live intensity + the season's line (one source) */
      colonyReadback: () => { line: string; intensity: number; target: number };
      /** U4: habitat scenery — fold-cell census + dragonfly telemetry */
      habitatReadback: () => { foldCells: { x: number; z: number }[]; dragonflies: number };
      /** U4 revision: the pond-edge segments (the controlled-variance source) */
      pondSegmentsReadback: () => { index: number; plants: number; spread: number; bandDepth: number; bandWidth: number }[];
      /** U4 revision: the fringe census (the named extension rule) */
      fringeCellsReadback: () => { x: number; z: number }[];
      /** U5: stars — the shared visibility predicate (pure, per phase) + live telemetry */
      starsReadback: () => { visible: number; opacity: number; visibilityAt: (phase: number) => number };
      /** U5: the composed-cloud material opacity (the asserted tuning value) */
      cloudOpacityReadback: () => number;
      /** write the save NOW (the same store save() the autosave uses) */
      save: () => void;
      /** #9: discovered recipe ids (persisted) */
      foundRecipes: () => string[];
      /** #9: rescans for newly formed recipes (the plant() path calls it) */
      checkCompanions: () => void;
      /** #9: currently-formed recipe ids (readback) */
      activeRecipes: () => string[];
      /** #10: per-hive comb fill readback (hiveId -> 0..1) */
      hiveCombs: () => Record<string, number>;
      /** #10: force a hive's comb fill (the P panel trigger) */
      setComb: (hiveId: string, fill: number) => void;
      /** #10: try harvesting a hive (false if not full); jars readback */
      harvestHoney: (hiveId: string) => boolean;
      honeyJars: () => number;
      honeyDebug: () => { foragingBees: number; appeal: number };
      /** #36 item 2: time controls (pause + 1x/2x/4x/8x + jump) via the test hook */
      timeSetSpeed: (step: number) => void;
      timeSetPaused: (paused: boolean) => void;
      timeIsPaused: () => boolean;
      timeSpeed: () => number;
      timeMultiplierReadback: () => number;
      /** fix unit: the shared ANIMATION clock — scaledElapsed accumulates
       *  dt*timeMultiplier (0 when paused); the gate asserts it scales at
       *  4x and freezes under pause (the observable that failed) */
      scaledElapsedReadback: () => number;
      /** #36 item 4: the classification query readbacks (deterministic gate) */
      isPlantableCellReadback: (x: number, z: number) => boolean;
      /** #36 hive popup: open/close via the store path the click uses */
      openHivePopup: (hiveId: string) => void;
      hillsBoxesReadback: () => { x: number; z: number; half: number }[];
      milestones: () => string[];
      beeCount: () => number;
      beeDebug: () => unknown;
    solitaryBeeCount: () => number;
    wildDebug: () => unknown;
    fireflyDebug: () => unknown;
    setDayPhase: (p: number) => void;
    precipReadback: () => unknown;
    precipitationVisual: () => unknown;
    tickPrecipScheduleForTest: (worldSeed: number, ordinal: number, season: string) => void;
    setFireflyForce: (v: boolean | null) => void;
    dayPhaseReadback: () => number;
    rainDebug: () => unknown;
    rareBeeCount: () => number;
    capturePostcard: () => string | null;
    audioDebug: () => unknown;
    terrainHeightAt: (x: number, z: number) => number;
    audioIsRunning: () => boolean;
      ghostPosition: () => { pos: [number, number, number] | null; valid: boolean };
      ghostVariation: () => { rotationY: number; heightJitter: number; tiltX: number; tiltZ: number } | null;
      resetWorld: () => void;
      reloadFromSave: () => void;
      openNotebookPlant: (itemId: string) => void;
      __three?: {
        camera: PerspectiveCamera;
        gl: WebGLRenderer;
        size: Size;
        scene: unknown;
      };
    };
  }
}

/**
 * Demo seed (dev-only): ?demo=1 plants a curated, varied meadow — flowers
 * of all six species in drifts, hive, bee bath, bee hotel, hedge, and a
 * wild corner — for instant demos. Runs only when the URL param is set AND
 * the build is a dev build, wrapped in a try/catch so a bug here can never
 * blank the app. Default play is untouched: without the param this function
 * is never called (guarded at the single call site in App, which dev-gates
 * it via the PerfOverlay-style lazy check).
 */
let demoSeeded = false;
export function maybeSeedDemoWorld() {
  if (demoSeeded) return;
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;
    const w = window.__meadowlight;
    if (!w) return;
    demoSeeded = true;
    const species = ['lavender', 'clover', 'poppy', 'sunflower', 'thyme', 'forget-me-not'];
    let i = 0;
    for (const sp of species) {
      for (let k = 0; k < 5; k++) {
        const a = i * 2.399963;
        const r = 4 + Math.sqrt((i + 1) / 30) * 12;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // the ground oracle answers "what's at this cell" — never seed into
        // water or the shore band (drift-class fix #26)
        if (!isBuildable(x, z)) { i++; continue; }
        w.plant(sp, x, z);
        i++;
      }
    }
    w.placeStructure('hive', 0, 0);
    w.placeStructure('bath', 2.5, 0.5);
    w.placeStructure('hotel', -3, 3);
    w.placeStructure('hedge', -6, -5);
    w.placeStructure('wildcorner', -4.5, 5);
  } catch {
    // dev-only convenience: never break the app on failure
  }
}

export function installTestHook() {
  if (typeof window === 'undefined') return;
  window.__meadowlight = {
    plant: (plantId, x, z) => {
      const { plant, ghostRotationY, placementVariation } = usePlacementStore.getState();
      plant({
        id: crypto.randomUUID(),
        plantId,
        position: [x, groundAt(x, z).height, z],
        rotationY: ghostRotationY,
        phase: Math.random() * Math.PI * 2,
        variation: variationFor(placementVariation),
      });
    },
    placeStructure: (structureId, x, z) => {
      const { placeStructure, ghostRotationY, placementVariation } = usePlacementStore.getState();
      placeStructure({
        id: crypto.randomUUID(),
        structureId,
        position: [x, groundAt(x, z).height, z],
        rotationY: ghostRotationY,
        variation: variationFor(placementVariation),
      });
    },
    removeAt: (id) => usePlacementStore.getState().removeAt(id),
    removeStructure: (id) => usePlacementStore.getState().removeStructure(id),
    items: () => usePlacementStore.getState().items,
    structures: () => usePlacementStore.getState().structures,
    clear: () => usePlacementStore.setState({ items: [], structures: [] }),
    setSeason: (season) => usePlacementStore.getState().setSeason(season),
    resumeSeasonClock: () => usePlacementStore.getState().resumeSeasonClock(),
    seasonProgressReadback: () => seasonProgress(),
    setSeasonProgressForTest: (p) => usePlacementStore.getState().setSeasonProgressForTest(p),
    seasonClockOverridden: () => seasonClockOverridden(),
    worldSeedReadback: () => usePlacementStore.getState().worldSeed,
    seedingEpochReadback: () => usePlacementStore.getState().seedingEpoch,
    /** N2: per-flower visit ledger readback (persisted v8) */
    visitsReadback: () =>
      usePlacementStore.getState().items.map((it) => ({
        id: it.id,
        plantId: it.plantId,
        visitedSeasons: it.visitedSeasons ?? [],
      })),
    /** N3: the magnifying-glass inspect tool (pure inspection, zero mutation) */
    magnifierReadback: () => {
      const s = usePlacementStore.getState();
      return { on: s.magnifierOn, entry: s.magnifierEntry };
    },
    toggleMagnifier: () => usePlacementStore.getState().toggleMagnifier(),
    wildlifeSightings: () => allWildlife().map((w) => ({ ...w })),
    setMagnifierEntryForTest: (e) =>
      usePlacementStore.getState().setMagnifierEntry(e as never),
    volunteersReadback: () =>
      usePlacementStore.getState().items.map((it) => ({
        id: it.id,
        plantId: it.plantId,
        volunteer: it.volunteer === true,
      })),
    visitorWindowsReadback: () => usePlacementStore.getState().visitorWindows,
    colonyReadback: () => colonyReadback(usePlacementStore.getState().season, seasonProgress()),
    habitatReadback: () => ({
      foldCells: cornerFoldCells(),
      dragonflies: dragonflyDebug.count,
    }),
    starsReadback: () => ({
      visible: starsDebug.visible,
      opacity: starsDebug.opacity,
      visibilityAt: starVisibility,
    }),
    cloudOpacityReadback: () => NIGHT_SKY_TUNING.clouds.opacity,
    pondSegmentsReadback: () => pondSegments(),
    fringeCellsReadback: () => fringeCells(),
    save: () => usePlacementStore.getState().save(),
    foundRecipes: () => usePlacementStore.getState().foundRecipes,
    checkCompanions: () => usePlacementStore.getState().checkCompanions(),
    activeRecipes: () => usePlacementStore.getState().activeRecipes(),
    hiveCombs: () => ({ ...usePlacementStore.getState().hiveCombs }),
    setComb: (hiveId, fill) => usePlacementStore.getState().setComb(hiveId, fill),
    harvestHoney: (hiveId) => usePlacementStore.getState().harvestHoney(hiveId),
    honeyJars: () => usePlacementStore.getState().honeyJars,
    honeyDebug: () => ({ foragingBees: honeyDebug.lastForagingBees, appeal: honeyDebug.lastAppeal }),
    /** #36 item 2: time-control triggers (pause/steps/jump) + readbacks */
    timeSetSpeed: (step: number) => setSpeedStep(step as SpeedStep),
    timeSetPaused: (paused: boolean) => setPaused(paused),
    timeIsPaused: () => isPaused(),
    timeSpeed: () => currentSpeedStep(),
    timeMultiplierReadback: () => timeMultiplier(),
    scaledElapsedReadback: () => scaledElapsed(),
    isPlantableCellReadback: (x, z) => isPlantableCell(x, z),
    openHivePopup: (hiveId) => usePlacementStore.getState().openHivePopup(hiveId),
    hillsBoxesReadback: () => hillsBoxes().map((b) => ({ x: b.x, z: b.z, half: b.half })),
    milestones: () => usePlacementStore.getState().milestones,
    beeCount: () => beeDebug.count,
    beeDebug: () => ({ ...beeDebug }),
    solitaryBeeCount: () => solitaryBeeDebug.count,
    wildDebug: () => ({ ...wildDebug }),
    fireflyDebug: () => ({ ...fireflyDebug }),
    setDayPhase,
    precipReadback: () => precipReadback(),
    precipitationVisual: () => precipitationVisual(),
    tickPrecipScheduleForTest: (worldSeed, ordinal, season) => tickPrecipScheduleForTest(worldSeed, ordinal, season as never),
    setFireflyForce,
    dayPhaseReadback: () => dayPhase(),
    rainDebug: () => ({ ...rainDebug }),
    rareBeeCount: () => rareBeeDebug.count,
    capturePostcard: () => capturePostcardPng(),
    audioDebug: () => audioDebugInfo(),
    terrainHeightAt: (x, z) => groundAt(x, z).height,
    audioIsRunning: () => audioRunning(),
    ghostPosition: () => ({ pos: ghostDebug.pos, valid: ghostDebug.valid }),
    ghostVariation: () => ghostDebug.variation,
    resetWorld: () => usePlacementStore.getState().resetWorld(),
    reloadFromSave: () => usePlacementStore.getState().reloadFromSave(),
    openNotebookPlant: (itemId) =>
      usePlacementStore.getState().openNotebook({ kind: 'plant', id: itemId }),
  };
}
