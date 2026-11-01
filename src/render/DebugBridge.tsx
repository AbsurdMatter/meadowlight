import { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { Scene } from 'three';
import { registerPostcardCapture } from '../engine/postcard';
import type { Size } from '@react-three/fiber';
import { CAMERA_BOUNDS } from '../data/environment';
import { cameraSpherical } from '../ui/KeyboardShortcuts';

/** the pending camera-distance test override — written by
 *  setCameraDistanceForTestImpl, consumed by DebugBridge's frame (which
 *  drives the CONTROLS' spherical so the zoom holds across frames). */
export const testCameraSpherical: { current: { radius: number; theta: number; phi: number } | null } = {
  current: null,
};

/** the camera-distance test control — writes the shared spherical the
 *  pointer and keyboard paths both drive (O5). Tests only. */
export function setCameraDistanceForTestImpl(d: number): void {
  const sph = cameraSpherical.current;
  if (!sph) {
    // the controls have not published yet — retry on the next tick
    setTimeout(() => setCameraDistanceForTestImpl(d), 100);
    return;
  }
  testCameraSpherical.current = { radius: d, theta: sph.theta, phi: sph.phi };
}

export function cameraDistanceForTestReadback(): number {
  return window.__meadowlight?.__three?.camera?.position.length() ?? -1;
}

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
    registerPostcardCapture({
      renderer: gl as WebGLRenderer,
      scene: scene as Scene,
      camera: camera as PerspectiveCamera,
    });
  }, [camera, gl, size, scene]);
  // the OrbitControlsLite RAF overwrites the camera position from its own
  // spherical every frame — a test that moves the camera directly would be
  // overwritten within one frame. The O5 test control therefore writes the
  // CONTROLS' spherical (the same state the pointer path drives) so the
  // zoom holds across frames.
  useFrame(() => {
    const t = testCameraSpherical.current;
    if (!t) return;
    const sph = cameraSpherical.current;
    if (!sph) return;
    if (Math.abs(sph.radius - t.radius) < 1e-6 && Math.abs(sph.theta - t.theta) < 1e-6 && Math.abs(sph.phi - t.phi) < 1e-6) {
      testCameraSpherical.current = null;
      return;
    }
    sph.radius = THREE.MathUtils.clamp(t.radius, CAMERA_BOUNDS.minDistance, CAMERA_BOUNDS.maxDistance);
    sph.theta = t.theta;
    sph.phi = THREE.MathUtils.clamp(t.phi, CAMERA_BOUNDS.minPolarAngle, CAMERA_BOUNDS.maxPolarAngle);
    sph.makeSafe();
  });
  return null;
}
