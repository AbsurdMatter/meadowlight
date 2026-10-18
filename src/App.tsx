import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Meadow } from './render/Meadow';
import { Background } from './render/Background';
import { Sky } from './render/Sky';
import { PlantedFlowers } from './render/PlantedFlowers';
import { PlacedStructures } from './render/PlacedStructures';
import { BeeSwarm } from './render/BeeSwarm';
import { PlacementSystem } from './render/PlacementSystem';
import { DebugBridge } from './render/DebugBridge';
import { OrbitControlsLite } from './render/OrbitControlsLite';
import { Palette } from './ui/Palette';
import { SeasonDial } from './ui/SeasonDial';
import { Toasts } from './ui/Toasts';
import { Notebook } from './ui/Notebook';
import { MilestoneWatcher } from './ui/MilestoneWatcher';
import { PerfOverlay } from './ui/PerfOverlay';
import { usePlacementStore } from './render/placementStore';
import { SEASON_INFO } from './data/seasons';

const SEASON_LIGHT: Record<string, { sun: string; ambient: number; intensity: number }> = {
  spring: { sun: '#ffe9c0', ambient: 0.36, intensity: 1.4 },
  summer: { sun: '#ffd9a0', ambient: 0.32, intensity: 1.5 },
  autumn: { sun: '#ffc98a', ambient: 0.3, intensity: 1.35 },
  winter: { sun: '#dfe8f5', ambient: 0.42, intensity: 1.1 },
};

function Scene() {
  const season = usePlacementStore((s) => s.season);
  const light = SEASON_LIGHT[season];
  return (
    <>
      <Sky />
      <hemisphereLight args={['#ffe6c7', '#5a7a4a', 0.6]} />
      <directionalLight
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
      <ambientLight intensity={light.ambient} color="#fff3e0" />
      <Meadow />
      <Background />
      <PlantedFlowers />
      <PlacedStructures />
      <BeeSwarm />
      <PlacementSystem />
      <DebugBridge />
      <OrbitControlsLite />
    </>
  );
}

export default function App() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
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
  const placing = selectedPlantId;
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
        {'\u{1F41D}'} Meadowlight {SEASON_INFO[season].emoji} {SEASON_INFO[season].label} —{' '}
        {placing ? 'click to place' : 'pick a flower below'} · right-drag rotates · R rotates ·{' '}
        F natural placement
      </div>
    </div>
  );
}
