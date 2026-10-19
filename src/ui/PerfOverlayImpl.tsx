import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLANTS } from '../data/plants';
import { MEADOW_SIZE } from '../engine/terrain';
import { groundAt } from '../engine/ground';
import { usePlacementStore } from '../render/placementStore';
import { beeDebug } from '../render/BeeSwarm';

const MEASURE_SECONDS = 10;
const STRESS_ITEMS = 200;
const FRAME_BUDGET_MS = 20;

interface Stats {
  fps: number;
  frameMs: number;
  items: number;
  bee: typeof beeDebug;
}

class OverlayBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[perf] overlay crashed and was contained:', error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Measures real display frame rate via requestAnimationFrame from outside the
 * Canvas tree (no R3F hooks here — this component is DOM-only). Includes React
 * DOM overhead, which is the honest metric for the player's experience.
 */
function useDisplayFrameRate(active: boolean, onFrame: (dt: number) => void) {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      cbRef.current(now - last);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

function PerfOverlayPanel() {
  const [stats, setStats] = useState<Stats>({ fps: 0, frameMs: 0, items: 0, bee: { ...beeDebug } });
  const [running, setRunning] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const lastUiUpdate = useRef(0);
  const runningRef = useRef(false);
  runningRef.current = running;

  useDisplayFrameRate(true, (dt) => {
    frameTimes.current.push(dt);
    const now = performance.now();
    if (!runningRef.current && now - lastUiUpdate.current > 250) {
      lastUiUpdate.current = now;
      const recent = frameTimes.current.slice(-120);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      setStats({
        fps: Math.round(1000 / avg),
        frameMs: avg,
        items: usePlacementStore.getState().items.length,
        // live bee telemetry snapshot (reads the same beeDebug the gate reads)
        bee: { ...beeDebug },
      });
    }
  });

  const stressTest = () => {
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
        position: [x, groundAt(x, z).height, z],
        rotationY: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    frameTimes.current = [];
    const startedAt = performance.now();
    const report = () => {
      const times = frameTimes.current.filter((_, i) => i >= 60);
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
      console.log('[perf] meadow restored to pre-stress state');
      setRunning(false);
    };
    const waitFor = () => {
      if (performance.now() - startedAt < MEASURE_SECONDS * 1000) {
        requestAnimationFrame(waitFor);
      } else {
        report();
      }
    };
    requestAnimationFrame(waitFor);
  };

  return (
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
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>perf overlay (P / ~)</div>
      <div>fps        {stats.fps}</div>
      <div>frame time {stats.frameMs.toFixed(2)} ms</div>
      <div>items      {stats.items}</div>
      <div>bees       {beeDebug.count} · foraging {beeDebug.foraging} · wander {beeDebug.wandering} · home {beeDebug.homing}</div>
      <div>targets    found {beeDebug.targetFound} · lost {beeDebug.targetLost} · wander picked {beeDebug.wanderPicked}</div>
      <div>hive dist  avg {beeDebug.avgDistFromHive.toFixed(1)}u · max {beeDebug.maxDistFromHive.toFixed(1)}u · speed {beeDebug.avgSpeed.toFixed(1)}</div>
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
  );
}

/**
 * DOM-only toggle shell. Lazy-mounts the panel (and its rAF loop) only after
 * the user presses P or Backquote; nothing perf-related exists at boot.
 */
export function PerfOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === '`') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <OverlayBoundary>
      <PerfOverlayPanel />
    </OverlayBoundary>
  );
}
