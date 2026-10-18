import { usePlacementStore } from '../render/placementStore';
import type { PlacedItem } from './persistence';

declare global {
  interface Window {
    __meadowlight?: {
      plant: (plantId: string, x: number, z: number) => void;
      removeAt: (id: string) => void;
      items: () => PlacedItem[];
      clear: () => void;
    };
  }
}

export function installTestHook() {
  if (typeof window === 'undefined') return;
  window.__meadowlight = {
    plant: (plantId, x, z) => {
      const { plant, ghostRotationY } = usePlacementStore.getState();
      plant({
        id: crypto.randomUUID(),
        plantId,
        position: [x, 0, z],
        rotationY: ghostRotationY,
        phase: Math.random() * Math.PI * 2,
      });
    },
    removeAt: (id) => usePlacementStore.getState().removeAt(id),
    items: () => usePlacementStore.getState().items,
    clear: () => usePlacementStore.setState({ items: [] }),
  };
}
