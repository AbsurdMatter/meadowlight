import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Meadow } from './render/Meadow';
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
      <hemisphereLight args={['#ffe6c7', '#5a7a4a', 0.55]} />
      <directionalLight
        position={[18, 14, 8]}
        intensity={1.6}
        color="#ffd9a0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <ambientLight intensity={0.25} color="#fff3e0" />
      <Meadow />
      <PlantedFlowers />
      <PlacementSystem />
      <OrbitControlsLite
        maxPolarAngle={Math.PI * 0.47}
        minDistance={6}
        maxDistance={38}
      />
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
        {' '}· right-drag rotates · R rotates plant
      </div>
    </div>
  );
}
