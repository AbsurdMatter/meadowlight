import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { Size } from '@react-three/fiber';

/**
 * Zero-visual bridge used by the test hook: stashes camera + canvas size so
 * automated checks can project world points to screen coordinates and click
 * for real. Renders nothing and binds no keys.
 */
export function DebugBridge() {
  const { camera, gl, size, scene } = useThree();
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__meadowlight) return;
    window.__meadowlight.__three = {
      camera: camera as PerspectiveCamera,
      gl: gl as WebGLRenderer,
      size: size as Size,
      scene,
    };
  }, [camera, gl, size, scene]);
  return null;
}
