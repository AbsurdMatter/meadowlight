import { type ComponentProps } from 'react';
import type { StructureDef } from '../data/structures';
import { VoxelFlower } from './VoxelFlower';

type VoxelStructureProps = Omit<ComponentProps<typeof VoxelFlower>, 'def'> & {
  def: StructureDef;
};

/** A structure renders with the same warm voxel look as a flower. */
export function VoxelStructure(props: VoxelStructureProps) {
  return <VoxelFlower {...props} swayStrength={0.02} />;
}
