import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BLOOM } from '../data/polish';
import { registerPostcardComposer } from '../engine/postcard';

/**
 * Subtle bloom via three's EffectComposer (no new packages — three ships
 * these passes). The composer REPLACES the renderer's default render loop,
 * so it must register itself with the postcard capture: a postcard runs one
 * composer.render() and reads the canvas after it, guaranteeing the PNG
 * contains the final composited (bloomed) frame, not the un-bloomed one.
 */
export function BloomPipeline() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  const composer = useMemo(() => {
    if (!BLOOM.enabled) return null;
    try {
      const c = new EffectComposer(gl);
      c.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        BLOOM.strength,
        BLOOM.radius,
        BLOOM.threshold,
      );
      c.addPass(bloom);
      return c;
    } catch {
      return null;
    }
  }, [gl, scene, camera, size.width, size.height]);

  composerRef.current = composer;

  useEffect(() => {
    registerPostcardComposer(composer);
    return () => registerPostcardComposer(null);
  }, [composer]);

  useFrame(() => {
    composer?.render();
  }, 1);

  return null;
}
