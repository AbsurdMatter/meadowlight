import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLANTS } from '../data/plants';
import { MEADOW_SIZE } from '../engine/terrain';
import { groundAt } from '../engine/ground';
import { usePlacementStore } from '../render/placementStore';
import { setCellMapVisible, cellMapVisible } from '../render/CellMapOverlay';
import { CELL_KINDS } from '../render/CellMapOverlay';
import { MILESTONES } from '../data/milestones';


const MEASURE_SECONDS = 10;
const STRESS_ITEMS = 200;
const FRAME_BUDGET_MS = 20;

interface Stats {
  fps: number;
  frameMs: number;
  items: number;
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

/** #30: save-state inspector — reads the RAW localStorage blob (what the next
 *  page load will see), not the live store, so it audits the actual save. */
function SaveInspector() {
  const [info, setInfo] = useState<ReturnType<typeof inspectSave> | null>(null);
  const items = usePlacementStore((s) => s.items);
  const structures = usePlacementStore((s) => s.structures);
  const refresh = () => setInfo(inspectSave());
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, []);
  if (!info) return null;
  return (
    <div data-perf-save-inspector style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>save state</div>
      <div>key         {info.key ?? '(none)'}</div>
      <div>version     {info.version}</div>
      <div>blob        {info.bytes} B</div>
      <div>items       {info.itemCount}{info.itemCount !== items.length ? ` (!= store ${items.length})` : ''}</div>
      <div>structures  {info.structureCount}{info.structureCount !== structures.length ? ` (!= store ${structures.length})` : ''}</div>
      <div>facts seen  {info.seenFacts}</div>
      <div>season      {info.season}</div>
      <div>onboarding  {info.onboardingDismissed ? 'dismissed' : 'pending'}</div>
      <div>wild seasons {info.wildSeasons}</div>
      {info.backup && (
        <div style={{ color: '#e0a55a' }}>backup blob present ({info.backupBytes} B)</div>
      )}
      <button
        onClick={() => { usePlacementStore.getState().save(); refresh(); }}
        style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#4a7a4a', color: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}
      >
        save now
      </button>
      <button
        data-perf-reload-save
        onClick={() => { usePlacementStore.getState().reloadFromSave(); refresh(); }}
        title="Discard in-memory state and rebuild the world from the localStorage blob (the same load path as a fresh page load — no save first)"
        style={{ marginTop: 4, marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#4a6a9a', color: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}
      >
        reload current save
      </button>
    </div>
  );
}

function inspectSave() {
  try {
    const key = 'meadowlight.world.v2';
    const raw = localStorage.getItem(key);
    const backup = localStorage.getItem('meadowlight.world._backup');
    if (!raw) {
      return { key: null as string | null, version: '-', bytes: 0, itemCount: 0, structureCount: 0, seenFacts: 0, season: '-', onboardingDismissed: false, wildSeasons: 0, backup: !!backup, backupBytes: backup?.length ?? 0 };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const backupInfo = { backup: !!backup, backupBytes: backup?.length ?? 0 };
    return {
      key,
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      bytes: raw.length,
      itemCount: Array.isArray(parsed.items) ? parsed.items.length : 0,
      structureCount: Array.isArray(parsed.structures) ? parsed.structures.length : 0,
      seenFacts: Array.isArray(parsed.seenFacts) ? parsed.seenFacts.length : 0,
      season: typeof parsed.season === 'string' ? parsed.season : '-',
      onboardingDismissed: parsed.onboardingDismissed === true,
      wildSeasons: Array.isArray(parsed.wildSeasons) ? parsed.wildSeasons.length : 0,
      ...backupInfo,
    };
  } catch {
    return { key: null as string | null, version: '(unreadable)', bytes: 0, itemCount: 0, structureCount: 0, seenFacts: 0, season: '-', onboardingDismissed: false, wildSeasons: 0, backup: false, backupBytes: 0 };
  }
}

/** #30: live milestone checklist — the live store, so it ticks as toasts fire. */
function MilestoneChecklist() {
  const milestones = usePlacementStore((s) => s.milestones);
  const [items, setItems] = useState<{ id: string; label: string; done: boolean }[]>([]);
  useEffect(() => {
    const t = setInterval(() => {
      const store = usePlacementStore.getState();
      setItems(MILESTONES.map((m) => ({ id: m.id, label: m.label, done: store.milestones.includes(m.id) })));
    }, 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-perf-milestones style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>milestones ({milestones.filter((m) => MILESTONES.some((d) => d.id === m)).length}/{MILESTONES.length})</div>
      {items.map((m) => (
        <div key={m.id} style={{ opacity: m.done ? 1 : 0.5 }}>
          [{m.done ? 'x' : ' '}] {m.label}
        </div>
      ))}
    </div>
  );
}

function CellMapLegend() {
  return (
    <div data-perf-cellmap-legend style={{ marginTop: 8, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>cell map legend</div>
      {CELL_KINDS.map((k) => (
        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: k.color, display: 'inline-block' }} />
          {k.label}
        </div>
      ))}
    </div>
  );
}

function PerfOverlayPanel() {
  const [stats, setStats] = useState<Stats>({ fps: 0, frameMs: 0, items: 0 });
  const [running, setRunning] = useState(false);
  const [cellMapOn, setCellMapOn] = useState(cellMapVisible());
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
      });
    }
  });

  const toggleCellMap = () => {
    const next = !cellMapOn;
    setCellMapOn(next);
    setCellMapVisible(next);
  };

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
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>perf overlay (P / ~)</div>
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
      <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
        <div style={{ fontWeight: 'bold' }}>cell map</div>
        <button
          data-perf-cellmap-toggle
          onClick={toggleCellMap}
          style={{
            marginTop: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            background: cellMapOn ? '#7a9d54' : '#666',
            color: '#fff',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {cellMapOn ? 'cell map ON' : 'cell map OFF'}
        </button>
        {cellMapOn && <CellMapLegend />}
      </div>
      <SaveInspector />
      <MilestoneChecklist />
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
