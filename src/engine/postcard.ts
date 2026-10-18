import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

/**
 * Postcard capture: renderer.domElement -> PNG download.
 *
 * No external libraries. The WebGL buffer is normally cleared after each
 * present (preserveDrawingBuffer stays OFF for perf), so a capture renders
 * one frame immediately before reading pixels. Bloom/postprocessing (session
 * 3 visual polish) renders through an EffectComposer whose final pass targets
 * the canvas — so the capture path branches: when a composer is registered
 * (registerPostcardComposer, called by the composer component on mount), one
 * composer pass runs and the PNG is read after it, guaranteeing the file
 * contains the final *composited* image (bloom included), not an un-bloomed
 * frame. Without a composer, the scene is rendered directly.
 */

type ComposerLike = { render: (delta?: number) => void };

interface PostcardCapture {
  renderer: WebGLRenderer | null;
  scene: Scene | null;
  camera: PerspectiveCamera | null;
  composer: ComposerLike | null;
}

export const postcardCapture: PostcardCapture = {
  renderer: null,
  scene: null,
  camera: null,
  composer: null,
};

export function registerPostcardCapture(capture: Partial<PostcardCapture>) {
  Object.assign(postcardCapture, capture);
}

export function registerPostcardComposer(composer: ComposerLike | null) {
  postcardCapture.composer = composer;
}

/** Render one frame (composer pass if present) and return a PNG data URL. */
export function capturePostcardPng(): string | null {
  const { renderer, scene, camera, composer } = postcardCapture;
  if (!renderer || !scene || !camera) return null;
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  return renderer.domElement.toDataURL('image/png');
}

/** Trigger a browser download of the captured PNG (user-facing path). */
export function downloadPostcard(png: string | null): boolean {
  if (!png) return false;
  const a = document.createElement('a');
  a.href = png;
  a.download = `meadowlight-postcard-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
  return true;
}
