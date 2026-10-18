import { usePlacementStore } from '../render/placementStore';
import { variationFor } from './variation';
import type { PlacedItem, PlacedStructure } from './persistence';
import type { StructureId } from '../data/structures';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { Size } from '@react-three/fiber';
import { beeDebug } from '../render/BeeSwarm';
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
      milestones: () => string[];
      beeCount: () => number;
      ghostPosition: () => { pos: [number, number, number] | null; valid: boolean };
      resetWorld: () => void;
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

export function installTestHook() {
  if (typeof window === 'undefined') return;
  window.__meadowlight = {
    plant: (plantId, x, z) => {
      const { plant, ghostRotationY, placementVariation } = usePlacementStore.getState();
      plant({
        id: crypto.randomUUID(),
        plantId,
        position: [x, 0, z],
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
        position: [x, 0, z],
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
    milestones: () => usePlacementStore.getState().milestones,
    beeCount: () => beeDebug.count,
    ghostPosition: () => ({ pos: ghostDebug.pos, valid: ghostDebug.valid }),
    resetWorld: () => usePlacementStore.getState().resetWorld(),
    openNotebookPlant: (itemId) =>
      usePlacementStore.getState().openNotebook({ kind: 'plant', id: itemId }),
  };
}
