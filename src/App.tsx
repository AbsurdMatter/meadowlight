import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Meadow } from './render/Meadow';
import { Background } from './render/Background';
import { Sky } from './render/Sky';
import { PlantedFlowers } from './render/PlantedFlowers';
import { PlacementSystem } from './render/PlacementSystem';
import { OrbitControlsLite } from './render/OrbitControlsLite';
import { Palette } from './ui/Palette';
import { PerfOverlay } from './ui/PerfOverlay';
import { usePlacementStore } from './render/placementStore';

function Scene() {
  return (
    <>
      <Sky />
      <hemisphereLight args={['#ffe6c7', '#5a7a4a', 0.6]} />
      <directionalLight
        position={[24, 16, 10]}
        intensity={1.5}
        color="#ffd9a0"
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
      <ambientLight intensity={0.32} color="#fff3e0" />
      <Meadow />
      <Background />
      <PlantedFlowers />
      <PlacementSystem />
      <OrbitControlsLite />
    </>
  );
}

export default function App() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
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
        🐝 Meadowlight — {selectedPlantId ? 'click to plant' : 'pick a flower below'}
        {' '}· right-drag rotates · R rotates plant · F random rotation
      </div>
    </div>
  );
}
