import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PLANTS } from '../data/plants';
import { MEADOW_SIZE, terrainHeight } from '../engine/terrain';
import { usePlacementStore } from '../render/placementStore';

const MEASURE_SECONDS = 10;
const STRESS_ITEMS = 200;
const FRAME_BUDGET_MS = 20;

function FpsMeter({ onFrame }: { onFrame: (dt: number) => void }) {
  useFrame((_, delta) => onFrame(delta * 1000));
  return null;
}

export function PerfOverlay() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({ fps: 0, frameMs: 0, items: 0 });
  const [running, setRunning] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const lastUiUpdate = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3' || e.key === 'f3' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setVisible(open), [open]);

  const onFrame = (dt: number) => {
    if (!visible) return;
    frameTimes.current.push(dt);
    const now = performance.now();
    if (now - lastUiUpdate.current > 250) {
      lastUiUpdate.current = now;
      const recent = frameTimes.current.slice(-120);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      setStats({
        fps: Math.round(1000 / avg),
        frameMs: avg,
        items: usePlacementStore.getState().items.length,
      });
    }
  };

  const stressTest = async () => {
    if (running) return;
    setRunning(true);
    const store = usePlacementStore.getState();
    const before = store.items.slice();
    console.log(
      `[perf] stress test: placing ${STRESS_ITEMS} flowers, measuring ${MEASURE_SECONDS}s`,
    );
    const half = MEADOW_SIZE / 2 - 2;
    for (let i = 0; i < STRESS_ITEMS; i++) {
      const a = i * 2.399963;
      const r = Math.sqrt((i + 1) / STRESS_ITEMS) * half;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const def = PLANTS[i % PLANTS.length];
      store.plant({
        id: crypto.randomUUID(),
        plantId: def.id,
        position: [x, terrainHeight(x, z), z],
        rotationY: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    frameTimes.current = [];
    await new Promise((r) => setTimeout(r, MEASURE_SECONDS * 1000));
    const times = frameTimes.current.slice(60);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const result = {
      items: usePlacementStore.getState().items.length,
      samples: times.length,
      avgFrameMs: Number(avg.toFixed(2)),
      p95FrameMs: Number(p95.toFixed(2)),
      minFrameMs: Number(min.toFixed(2)),
      maxFrameMs: Number(max.toFixed(2)),
      fps: Number((1000 / avg).toFixed(1)),
      budget: `${FRAME_BUDGET_MS} ms (~60 fps)`,
      pass: avg < FRAME_BUDGET_MS,
    };
    console.log('[perf] stress test result:', result);
    console.log(
      result.pass
        ? `[perf] PASS: ${result.fps} fps (avg ${result.avgFrameMs} ms/frame)`
        : `[perf] FAIL: ${result.fps} fps (avg ${result.avgFrameMs} ms/frame) exceeds ${FRAME_BUDGET_MS} ms budget`,
    );
    usePlacementStore.setState({ items: before });
    setRunning(false);
  };

  if (!visible) return <FpsMeter onFrame={onFrame} />;

  return (
    <>
      <FpsMeter onFrame={onFrame} />
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(30, 30, 30, 0.82)',
          color: '#e8e2d0',
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          pointerEvents: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>perf overlay (F3/P)</div>
        <div>fps        {stats.fps}</div>
        <div>frame time {stats.frameMs.toFixed(2)} ms</div>
        <div>items      {stats.items}</div>
        <button
          onClick={stressTest}
          disabled={running}
          style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            background: running ? '#666' : '#d24a43',
            color: '#fff',
            fontFamily: 'inherit',
            cursor: running ? 'default' : 'pointer',
          }}
        >
          {running ? 'measuring…' : `stress: ${STRESS_ITEMS} flowers`}
        </button>
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
          logs to console · target &lt; {FRAME_BUDGET_MS} ms
        </div>
      </div>
    </>
  );
}
