import { usePlacementStore } from './placementStore';
import { PLANT_BY_ID } from '../data/plants';
import { VoxelFlower } from './VoxelFlower';

export function PlantedFlowers() {
  const items = usePlacementStore((s) => s.items);
  return (
    <group>
      {items.map((item) => {
        const def = PLANT_BY_ID[item.plantId];
        if (!def) return null;
        return (
          <group key={item.id}>
            <VoxelFlower
              def={def}
              position={item.position}
              rotationY={item.rotationY}
            />
          </group>
        );
      })}
    </group>
  );
}
