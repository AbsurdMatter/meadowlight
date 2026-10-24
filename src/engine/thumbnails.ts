import * as THREE from 'three';
import type { PlantPart } from '../data/plants';

/**
 * Palette thumbnails rendered from the actual voxel models: one small
 * offscreen render per item at startup, cached as data URLs. Same camera
 * angle + warm lighting for every item (consistency by construction), and
 * no per-frame cost: each model renders exactly once.
 *
 * CONTEXT LEAK FIX (PR #32 console pass): this module used to create a
 * THREE.WebGLRenderer PER THUMBNAIL (11 at palette boot — and dev
 * StrictMode runs the effect twice, so 22), and renderer.dispose() does NOT
 * release the underlying WebGL context (the canvas holds it until GC).
 * Browsers cap active contexts (~16) and start killing the oldest — which
 * would eventually be the meadow itself. Now ONE shared renderer backs all
 * thumbnails: a single WebGL context for the whole batch, per-thumb
 * materials disposed strictly.
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

/** The ONE thumbnail renderer — created on first use, reused for every thumb. */
let sharedRenderer: THREE.WebGLRenderer | null = null;
/** shared unit box geometry (scaled per part) */
let boxGeometry: THREE.BoxGeometry | null = null;

function getRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    sharedRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    sharedRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    return sharedRenderer;
  } catch {
    return null;
  }
}

/** Render one voxel model (list of box parts) to a cached PNG data URL. */
/**
 * UI round 2 (#6383805035): CLOSE-UP flower art for palette chips — the same
 * voxel model, a tighter camera centered on the BLOOM (petal parts), so the
 * flower is identifiable at a glance. One source: it renders the actual
 * model; nothing hand-drawn.
 */
export function renderVoxelCloseUp(parts: PlantPart[]): string | null {
  const petals = parts.filter((p) => p.petal);
  const focusParts = petals.length > 0 ? petals : parts;
  // the bloom's vertical center (world units)
  const centerY =
    focusParts.reduce((a, p) => a + p.offset[1], 0) / Math.max(1, focusParts.length);
  const extent = focusParts.reduce(
    (a, p) =>
      Math.max(a, p.size[0] + p.size[1] + p.size[2] + Math.abs(p.offset[1] - centerY)),
    0.6,
  );
  const renderer = getRenderer();
  if (!renderer) return null;
  boxGeometry = boxGeometry ?? new THREE.BoxGeometry(1, 1, 1);
  try {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.intensity);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(LIGHT.ambient, 0.55));
    const group = new THREE.Group();
    for (const part of parts) {
      const mesh = new THREE.Mesh(
        boxGeometry,
        new THREE.MeshLambertMaterial({ color: part.color }),
      );
      mesh.position.set(part.offset[0], part.offset[1], part.offset[2]);
      mesh.scale.set(part.size[0], part.size[1], part.size[2]);
      group.add(mesh);
    }
    scene.add(group);
    // tight orbit just off the bloom — close but the whole flower reads
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
    const d = Math.max(1.15, extent * 1.05);
    camera.position.set(d * 0.55, centerY + d * 0.45, d);
    camera.lookAt(0, centerY, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        (mesh.material as THREE.Material).dispose();
      }
    });
    return url;
  } catch {
    return null;
  }
}

export function renderVoxelThumb(parts: PlantPart[], maxHeight: number): string | null {
  const renderer = getRenderer();
  if (!renderer) return null;
  boxGeometry = boxGeometry ?? new THREE.BoxGeometry(1, 1, 1);
  try {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.intensity);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(LIGHT.ambient, 0.55));
    const group = new THREE.Group();
    for (const part of parts) {
      const mesh = new THREE.Mesh(
        boxGeometry,
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
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    // strict cleanup: per-thumb materials disposed so nothing accumulates
    // across the batch (the renderer + its context are shared, not disposed)
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        (mesh.material as THREE.Material).dispose();
      }
    });
    return url;
  } catch {
    return null;
  }
}

/**
 * Release the shared thumbnail renderer + its WebGL context explicitly.
 * Nothing calls this by default (one persistent context is fine); exposed
 * so a future host page can reclaim it if thumbnails are ever re-rendered.
 */
export function releaseThumbRenderer(): void {
  if (!sharedRenderer) return;
  try {
    sharedRenderer.forceContextLoss();
    sharedRenderer.dispose();
  } catch {
    // context already gone: nothing to release
  }
  sharedRenderer = null;
  boxGeometry?.dispose();
  boxGeometry = null;
}
