import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Meadow } from './render/Meadow';
import { Background } from './render/Background';
import { Sky } from './render/Sky';
import { PlantedFlowers } from './render/PlantedFlowers';
import { PlacedStructures } from './render/PlacedStructures';
import { BeeSwarm } from './render/BeeSwarm';
import { SolitaryBees } from './render/SolitaryBees';
import { BloomPipeline } from './render/BloomPipeline';
import { GrassTufts } from './render/GrassTufts';
import { PlacementSystem } from './render/PlacementSystem';
import { DebugBridge } from './render/DebugBridge';
import { CellMapLayer } from './render/CellMapOverlay';
import { OrbitControlsLite } from './render/OrbitControlsLite';
import { Palette } from './ui/Palette';
import { SeasonDial } from './ui/SeasonDial';
import { ResetDialog } from './ui/ResetDialog';
import { CornerControls } from './ui/CornerControls';
import { Onboarding } from './ui/Onboarding';
import { Toasts } from './ui/Toasts';
import { Notebook } from './ui/Notebook';
import { MilestoneWatcher } from './ui/MilestoneWatcher';
import { PerfOverlay } from './ui/PerfOverlay';
import { usePlacementStore } from './render/placementStore';
import { maybeSeedDemoWorld } from './engine/testHook';
import { SEASON_INFO } from './data/seasons';
import { LIGHT_WARMTH, LONG_SHADOWS } from './data/polish';

const SEASON_LIGHT: Record<string, { sun: string; ambient: number; intensity: number }> = {
  spring: { sun: '#ffe9c0', ambient: 0.36, intensity: 1.4 },
  summer: { sun: '#ffd9a0', ambient: 0.32, intensity: 1.5 },
  autumn: { sun: '#ffc98a', ambient: 0.3, intensity: 1.35 },
  winter: { sun: '#dfe8f5', ambient: 0.42, intensity: 1.1 },
};

function SunLight({ season }: { season: string }) {
  const light = SEASON_LIGHT[season];
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    const sun = ref.current;
    if (!sun) return;
    // camera polar angle: 1 = mid, 1.32 = lowest allowed (golden hour)
    const polar = Math.atan2(
      Math.hypot(camera.position.x, camera.position.z),
      camera.position.y,
    );
    const warmth = LIGHT_WARMTH.enabled
      ? THREE.MathUtils.clamp((polar - LIGHT_WARMTH.warmStartPolar) / (1.32 - LIGHT_WARMTH.warmStartPolar), 0, 1)
      : 0;
    if (LIGHT_WARMTH.enabled) {
      sun.color.set(light.sun).lerp(new THREE.Color(LIGHT_WARMTH.warmSunColor), warmth * 0.85);
      sun.intensity = light.intensity + warmth * LIGHT_WARMTH.warmIntensityBoost;
    }
    // long shadows: stretch the sun outward and lower as the camera drops
    const stretch = LONG_SHADOWS.enabled
      ? 1 + warmth * (LONG_SHADOWS.stretchMax - 1)
      : 1;
    sun.position.set(24 * Math.max(1, stretch * 0.9), 16 / Math.max(1, stretch * 0.8), 10 * stretch);
  });
  return (
    <directionalLight
      ref={ref}
      position={[24, 16, 10]}
      intensity={light.intensity}
      color={light.sun}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-near={4}
      shadow-camera-far={80}
      shadow-bias={-0.0004}
      shadow-normalBias={0.6}
      shadow-radius={6}
    />
  );
}

function Scene() {
  const season = usePlacementStore((s) => s.season);
  const light = SEASON_LIGHT[season];
  return (
    <>
      <Sky />
      <hemisphereLight args={['#ffe6c7', '#5a7a4a', 0.6]} />
      <SunLight season={season} />
      <ambientLight intensity={light.ambient} color="#fff3e0" />
      <Meadow />
      <GrassTufts />
      <Background />
      <PlantedFlowers />
      <PlacedStructures />
      <BeeSwarm />
      <SolitaryBees />
      <BloomPipeline />
      <CellMapLayer />
      <PlacementSystem />
      <DebugBridge />
      <OrbitControlsLite />
    </>
  );
}

export default function App() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const selectedStructureId = usePlacementStore((s) => s.selectedStructureId);
  const season = usePlacementStore((s) => s.season);
  const [loaded, setLoaded] = useState(false);
  const saveNow = useCallback(() => {
    usePlacementStore.getState().save();
  }, []);
  useEffect(() => {
    const t = setInterval(saveNow, 3000);
    window.addEventListener('beforeunload', saveNow);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', saveNow);
      saveNow();
    };
  }, [saveNow]);
  useEffect(() => setLoaded(true), []);
  // dev-only demo seed (?demo=1): lazy, error-bounded, no default-play effect
  useEffect(() => {
    if (loaded) maybeSeedDemoWorld();
  }, [loaded]);
  const placing = selectedPlantId ?? selectedStructureId;
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [16, 12, 20], fov: 50 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      {loaded && <Palette />}
      {loaded && <SeasonDial />}
      {loaded && (
        <div style={{ position: 'absolute', top: 64, right: 12 }}>
          <ResetDialog />
        </div>
      )}
      {loaded && <CornerControls />}
      {loaded && <Onboarding />}
      {loaded && <Toasts />}
      {loaded && <Notebook />}
      <MilestoneWatcher />
      {PerfOverlay && <PerfOverlay />}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '8px 14px',
          borderRadius: 12,
          background: 'rgba(255, 244, 220, 0.85)',
          color: '#7a5a2b',
          fontSize: 14,
          pointerEvents: 'none',
        }}
      >
        {'\u{1F41D}'} Meadowlight · {SEASON_INFO[season].emoji} {SEASON_INFO[season].label} ·{' '}
        {placing ? 'click the meadow to place' : 'pick something to plant, or just wander'}
      </div>
    </div>
  );
}
