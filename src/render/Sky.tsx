import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';

export const PALETTE = {
  skyTop: '#6fa8dc',
  skyMid: '#a8cdf0',
  skyHorizon: '#ffd9a0',
  fog: '#f2c98a',
  sun: '#ffd9a0',
};

export function Sky() {
  const { scene } = useThree();

  const skyTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useMemo(() => {
    scene.background = skyTexture;
    scene.fog = new THREE.Fog(PALETTE.fog, 30, 90);
  }, [scene, skyTexture]);

  return null;
}

void Canvas;
