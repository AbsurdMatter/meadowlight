import * as THREE from 'three';
import type { PlantPart } from '../data/plants';

/**
 * Palette thumbnails rendered from the actual voxel models: one small
 * offscreen render per item at startup, cached as data URLs. Same camera
 * angle + warm lighting for every item (consistency by construction), so
 * hedge and wild corner become visually distinct — and no per-frame cost:
 * each model renders exactly once.
 */

const THUMB_SIZE = 96;

export interface ThumbLight {
  sun: string;
  ambient: string;
  intensity: number;
}

const LIGHT: ThumbLight = {
  sun: '#ffd9a0',
  ambient: '#fff3e0',
  intensity: 1.5,
};

function makeRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
}

/** Render one voxel model (list of box parts) to a cached PNG data URL. */
export function renderVoxelThumb(parts: PlantPart[], maxHeight: number): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const renderer = makeRenderer(canvas);
  if (!renderer) return null;
  try {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.intensity);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(LIGHT.ambient, 0.55));

    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (const part of parts) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color: part.color }),
      );
      mesh.position.set(part.offset[0], part.offset[1], part.offset[2]);
      mesh.scale.set(part.size[0], part.size[1], part.size[2]);
      group.add(mesh);
    }
    scene.add(group);

    // same warm angle for every item — consistency by construction
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const d = Math.max(2.2, maxHeight * 1.35);
    camera.position.set(d * 0.75, d * 0.72, d);
    camera.lookAt(0, maxHeight * 0.5, 0);

    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    renderer.dispose();
  }
}
