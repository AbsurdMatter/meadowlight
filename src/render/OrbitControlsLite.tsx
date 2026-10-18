import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
}

export function OrbitControlsLite({
  minDistance = 6,
  maxDistance = 38,
  maxPolarAngle = Math.PI * 0.47,
}: Props) {
  const { camera, gl } = useThree();
  const state = useRef({
    target: new THREE.Vector3(0, 0, 0),
    spherical: new THREE.Spherical(),
    panOffset: new THREE.Vector3(),
  });

  useEffect(() => {
    const dom = gl.domElement;
    const s = state.current;
    s.spherical.setFromVector3(camera.position.clone().sub(s.target));

    let dragging = false;
    let button = -1;
    let lastX = 0;
    let lastY = 0;
    let panDeltaX = 0;
    let panDeltaY = 0;

    const panScale = () => {
      const dist = camera.position.distanceTo(s.target);
      return (dist * 0.0018);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      button = e.button;
      lastX = e.clientX;
      lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (button === 2) {
        s.spherical.theta -= dx * 0.005;
        s.spherical.phi -= dy * 0.005;
        s.spherical.phi = THREE.MathUtils.clamp(s.spherical.phi, 0.08, maxPolarAngle);
        s.spherical.makeSafe();
      } else if (button === 0) {
        const scale = panScale();
        panDeltaX = -dx * scale;
        panDeltaY = -dy * scale;
        const pan = new THREE.Vector3();
        pan.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(panDeltaX);
        pan.add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(panDeltaY));
        s.panOffset.add(pan);
        s.target.add(pan);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try { dom.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.spherical.radius = THREE.MathUtils.clamp(
        s.spherical.radius * (1 + Math.sign(e.deltaY) * 0.08),
        minDistance,
        maxDistance,
      );
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    let raf = 0;
    const update = () => {
      const offset = new THREE.Vector3().setFromSpherical(s.spherical).add(s.target);
      camera.position.copy(offset);
      camera.lookAt(s.target);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }, [camera, gl, maxPolarAngle, minDistance, maxDistance]);

  return null;
}
