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
import { setRaining } from './weather';
import { dayPhase } from './dayCycle';
import { seasonProgress, seasonClockOverridden } from './seasonClock';
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
      milestones: () => string[];
      beeCount: () => number;
      beeDebug: () => unknown;
    solitaryBeeCount: () => number;
    wildDebug: () => unknown;
    fireflyDebug: () => unknown;
    setDayPhase: (p: number) => void;
    setRaining: (v: boolean) => void;
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
    milestones: () => usePlacementStore.getState().milestones,
    beeCount: () => beeDebug.count,
    beeDebug: () => ({ ...beeDebug }),
    solitaryBeeCount: () => solitaryBeeDebug.count,
    wildDebug: () => ({ ...wildDebug }),
    fireflyDebug: () => ({ ...fireflyDebug }),
    setDayPhase,
    setRaining,
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
