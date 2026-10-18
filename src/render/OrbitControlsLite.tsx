import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_BOUNDS } from '../data/environment';

export function OrbitControlsLite() {
  const { camera, gl } = useThree();
  const state = useRef({
    target: new THREE.Vector3(0, 0, 0),
    spherical: new THREE.Spherical(),
  });

  useEffect(() => {
    const dom = gl.domElement;
    const s = state.current;
    s.spherical.setFromVector3(camera.position.clone().sub(s.target));
    s.spherical.phi = THREE.MathUtils.clamp(
      s.spherical.phi,
      CAMERA_BOUNDS.minPolarAngle,
      CAMERA_BOUNDS.maxPolarAngle,
    );
    s.spherical.radius = THREE.MathUtils.clamp(
      s.spherical.radius,
      CAMERA_BOUNDS.minDistance,
      CAMERA_BOUNDS.maxDistance,
    );

    let dragging = false;
    let button = -1;
    let lastX = 0;
    let lastY = 0;

    const panScale = () => camera.position.distanceTo(s.target) * 0.0018;

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
        s.spherical.phi = THREE.MathUtils.clamp(
          s.spherical.phi - dy * 0.005,
          CAMERA_BOUNDS.minPolarAngle,
          CAMERA_BOUNDS.maxPolarAngle,
        );
        s.spherical.makeSafe();
      } else if (button === 0) {
        const scale = panScale();
        // matches three.js OrbitControls: panLeft uses -deltaX, panUp uses
        // +deltaY — the world follows the cursor on both axes (grab feel)
        const pan = new THREE.Vector3()
          .setFromMatrixColumn(camera.matrix, 0)
          .multiplyScalar(-dx * scale);
        pan.add(
          new THREE.Vector3()
            .setFromMatrixColumn(camera.matrix, 1)
            .multiplyScalar(dy * scale),
        );
        s.target.add(pan);
        const t = CAMERA_BOUNDS.panTargetLimit;
        s.target.x = THREE.MathUtils.clamp(s.target.x, -t, t);
        s.target.z = THREE.MathUtils.clamp(s.target.z, -t, t);
        s.target.y = 0;
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
        CAMERA_BOUNDS.minDistance,
        CAMERA_BOUNDS.maxDistance,
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
  }, [camera, gl]);

  return null;
}
