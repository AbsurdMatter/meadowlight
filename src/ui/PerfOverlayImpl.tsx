import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLANTS } from '../data/plants';
import { MEADOW_SIZE } from '../engine/terrain';
import { groundAt } from '../engine/ground';
import { usePlacementStore } from '../render/placementStore';
import { beeDebug } from '../render/BeeSwarm';
import { isRaining, setRaining } from '../engine/weather';
import { dayPhase, setDayPhase, resumeDayCycle, dayCycleOverridden } from '../engine/dayCycle';
import { fireflyDebug, setFireflyForce, fireflyForced } from '../render/Fireflies';
import { setCellMapVisible, cellMapVisible } from '../render/CellMapOverlay';
import { CELL_KINDS } from '../render/CellMapOverlay';
import { MILESTONES } from '../data/milestones';
import {
  seasonProgress,
  seasonClockOverridden,
  setSeasonProgressForTest,
} from '../engine/seasonClock';

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
        title="Discard in-memory state and rebuild the world from the localStorage blob (the same load path as a fresh page load — no save first). Manual test note: click within <3s of editing the blob in devtools — the app autosaves live state every 3s and would overwrite your edit."
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
  const [stats, setStats] = useState<Stats>({ fps: 0, frameMs: 0, items: 0, bee: { ...beeDebug } });
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
        // live bee telemetry snapshot (reads the same beeDebug the gate reads)
        bee: { ...beeDebug },
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
      if (times.length === 0) {
        console.log('[perf] stress test result: no frame samples collected (rAF never ticked?)');
        usePlacementStore.setState({ items: before });
        setRunning(false);
        return;
      }
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
      <Session5Triggers />
      <Session6SeasonTriggers />
      <Session6RecipeTriggers />
      <Session6HoneyTriggers />
      <Session7SeedingReadback />
      <Session7VisitorTriggers />
      <Session7ColonyReadback />
      <Session7HabitatReadback />
      <Session7NightSkyReadback />
      <SaveInspector />
      <MilestoneChecklist />
    </div>
  );
}

/** session-5 trigger section: everything the living world introduced,
 *  on demand — the P panel is the verification instrument. Dev-only
 *  (the whole overlay is prod-excluded via PerfOverlay.tsx). */
function Session5Triggers() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const btn = (label: string, onClick: () => void, active: boolean, key?: string) => (
    <button
      key={key}
      data-perf-s5={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: active ? '#7a9d54' : '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>session 5 triggers</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>weather</div>
      <div>
        {btn('rain ON', () => setRaining(true), isRaining(), 'rain-on')}
        {btn('rain OFF', () => setRaining(false), !isRaining(), 'rain-off')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}toggle only — no natural rain trigger exists yet (noted in commit)
        </span>
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>time of day (override; natural clock pauses)</div>
      <div>
        {btn('morning', () => setDayPhase(0.3), Math.abs(dayPhase() - 0.3) < 0.01, 'tod-morning')}
        {btn('day', () => setDayPhase(0.5), Math.abs(dayPhase() - 0.5) < 0.01, 'tod-day')}
        {btn('evening', () => setDayPhase(0.82), Math.abs(dayPhase() - 0.82) < 0.01, 'tod-evening')}
        {btn('night', () => setDayPhase(0.97), Math.abs(dayPhase() - 0.97) < 0.01, 'tod-night')}
        {btn('resume natural', () => {
          resumeDayCycle();
          refresh();
        }, !dayCycleOverridden(), 'tod-resume')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}phase {dayPhase().toFixed(2)} {dayCycleOverridden() ? '(held)' : '(drifting)'}
        </span>
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>fireflies (independent of dusk)</div>
      <div>
        {btn('force on', () => setFireflyForce(true), fireflyForced() === true, 'ff-on')}
        {btn('force off', () => setFireflyForce(false), fireflyForced() === false, 'ff-off')}
        {btn('natural', () => setFireflyForce(null), fireflyForced() === null, 'ff-natural')}
        <span style={{ fontSize: 11, opacity: 0.7 }}> {fireflyDebug.count} glowing</span>
      </div>
    </div>
  );
}

/** session 6 trigger section: the season calendar (#11) — force seasons
 *  (same override path as the manual dial), resume natural drift, and a
 *  fast-forward for rollover/toast testing. Dev-only (prod-excluded). */
function Session6SeasonTriggers() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const season = usePlacementStore((s) => s.season);
  const btn = (label: string, onClick: () => void, active: boolean, key?: string) => (
    <button
      key={key}
      data-perf-s6={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: active ? '#7a9d54' : '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>season calendar (#11)</div>
      <div>
        {btn('force spring', () => usePlacementStore.getState().setSeason('spring'), season === 'spring', 'season-spring')}
        {btn('force summer', () => usePlacementStore.getState().setSeason('summer'), season === 'summer', 'season-summer')}
        {btn('force autumn', () => usePlacementStore.getState().setSeason('autumn'), season === 'autumn', 'season-autumn')}
        {btn('force winter', () => usePlacementStore.getState().setSeason('winter'), season === 'winter', 'season-winter')}
        {btn('resume natural', () => usePlacementStore.getState().resumeSeasonClock(), !seasonClockOverridden(), 'season-resume')}
      </div>
      <div>
        {btn('progress → 0.95', () => { setSeasonProgressForTest(0.95); refresh(); }, false, 'season-near-end')}
        {btn('progress → 0.999…', () => { setSeasonProgressForTest(0.999999); refresh(); }, false, 'season-boundary')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}progress {seasonProgress().toFixed(3)} {seasonClockOverridden() ? '(held)' : '(drifting)'}
        </span>
      </div>
    </div>
  );
}

/** session 6 trigger section: companion recipes (#9) — form a recipe via
 *  the test path (plant both species adjacent, rescan) and read the state.
 *  Dev-only (prod-excluded via PerfOverlay.tsx). */
function Session6RecipeTriggers() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const found = usePlacementStore((s) => s.foundRecipes);
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s6={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>companion recipes (#9)</div>
      <div>
        {btn('form lavender+thyme', () => {
          const w = (window as unknown as { __meadowlight?: { plant: (id: string, x: number, z: number) => void } }).__meadowlight;
          w?.plant('lavender', 2, 2);
          w?.plant('thyme', 2.6, 2);
          usePlacementStore.getState().checkCompanions();
        }, 'recipe-form')}
        {btn('rescan', () => usePlacementStore.getState().checkCompanions(), 'recipe-rescan')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}discovered {found.length}/5 · active {usePlacementStore.getState().activeRecipes().length}
        </span>
      </div>
    </div>
  );
}

/** session 6 trigger section: honey (#10) — force comb fill, harvest a
 *  ready hive, read the live foraging inputs. Dev-only (prod-excluded). */
function Session6HoneyTriggers() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const combs = usePlacementStore((s) => s.hiveCombs);
  const jars = usePlacementStore((s) => s.honeyJars);
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s6={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  const hives = usePlacementStore
    .getState()
    .structures.filter((st) => st.structureId === 'hive');
  const firstHive = hives[0];
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>honey (#10)</div>
      <div>
        {btn("fill hive (popup's when open)", () => {
          const s = usePlacementStore.getState();
          const target = s.hivePopup ?? firstHive?.id;
          if (target) s.setComb(target, 1);
        }, 'honey-fill')}
        {btn('harvest first hive', () => {
          if (firstHive) usePlacementStore.getState().harvestHoney(firstHive.id);
        }, 'honey-harvest')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}jars {jars} · combs {hives.map((h) => (combs[h.id] ?? 0).toFixed(2)).join(',') || '-'}
        </span>
      </div>
    </div>
  );
}

/** session 7 trigger section: self-seeding (#U1) — read the named seed
 *  state, cross a season boundary (the dial = the one seeding trigger
 *  path), and read the volunteer census. Trigger-first: no direct
 *  seed-spawn — volunteers only ever arrive via the season boundary. */
function Session7SeedingReadback() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const worldSeed = usePlacementStore((s) => s.worldSeed);
  const epoch = usePlacementStore((s) => s.seedingEpoch);
  const items = usePlacementStore((s) => s.items);
  const volunteers = items.filter((it) => it.volunteer).length;
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s7={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>self-seeding (U1)</div>
      <div>
        {btn('dial next season (rolls seeds)', () => {
          const s = usePlacementStore.getState();
          const order: typeof s.season[] = ['spring', 'summer', 'autumn', 'winter'];
          const next = order[(order.indexOf(s.season) + 1) % 4];
          s.setSeason(next);
        }, 'seed-roll')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}seed #{worldSeed} · epoch {epoch} · volunteers {volunteers}/{items.length}
        </span>
      </div>
    </div>
  );
}

/** session 7 trigger section: seasonal wild visitors (#U2) — force the
 *  NATURAL CONDITIONS (season, day phase, target flowers), never the spawn
 *  itself (the session-5 butterfly decision, kept). Readback: per-species
 *  counts + the visitor-window log. */
function Session7VisitorTriggers() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s7={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>seasonal wild visitors (U2)</div>
      <div>
        {btn('queen cond: spring + crocuses', () => {
          const w = (window as unknown as { __meadowlight?: { plant: (id: string, x: number, z: number) => void; setSeason: (s: 'spring' | 'summer' | 'autumn' | 'winter') => void } }).__meadowlight;
          w?.setSeason('spring');
          for (let k = 0; k < 4; k++) w?.plant('crocus', 2 + k * 1.2, 2);
        }, 'visitor-queen')}
        {btn('moth cond: night + lavender', () => {
          const w = (window as unknown as { __meadowlight?: { plant: (id: string, x: number, z: number) => void; setDayPhase: (p: number) => void; setSeason: (s: 'spring' | 'summer' | 'autumn' | 'winter') => void } }).__meadowlight;
          w?.setSeason('summer');
          w?.setDayPhase(0.95);
          for (let k = 0; k < 4; k++) w?.plant('lavender', -2 - k * 1.2, 2);
        }, 'visitor-moth')}
        {btn('firefly bloom cond: summer + dusk', () => {
          const w = (window as unknown as { __meadowlight?: { setSeason: (s: 'spring' | 'summer' | 'autumn' | 'winter') => void; setDayPhase: (p: number) => void; placeStructure: (id: string, x: number, z: number) => void } }).__meadowlight;
          w?.setSeason('summer');
          w?.setDayPhase(0.82);
          w?.placeStructure('wildcorner', -4.5, 5);
        }, 'visitor-fireflies')}
        <span style={{ fontSize: 11, opacity: 0.7 }}> windows: {usePlacementStore.getState().visitorWindows.length}</span>
      </div>
    </div>
  );
}

/** session 7 readback section: bee lifecycles (#U3) — the colony breath.
 *  Trigger-first: force season/progress (the natural inputs), read the ONE
 *  shared semantic (engine/lifecycle). No direct population force exists. */
function Session7ColonyReadback() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s7={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{
        margin: '2px 4px 2px 0',
        padding: '5px 9px',
        borderRadius: 8,
        border: 'none',
        background: '#666',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  const w = (window as unknown as { __meadowlight?: { setSeason: (s: 'spring' | 'summer' | 'autumn' | 'winter') => void; setSeasonProgressForTest: (p: number) => void; colonyReadback: () => { line: string; intensity: number; target: number } } }).__meadowlight;
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>colony breath (U3)</div>
      <div>
        {btn('winter mid', () => { w?.setSeason('winter'); w?.setSeasonProgressForTest(0.4); }, 'colony-winter')}
        {btn('spring start', () => { w?.setSeason('spring'); w?.setSeasonProgressForTest(0.05); }, 'colony-spring')}
        {btn('summer full', () => { w?.setSeason('summer'); w?.setSeasonProgressForTest(0.5); }, 'colony-summer')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}live {w ? w.colonyReadback().intensity.toFixed(2) : '?'} → target {w ? w.colonyReadback().target.toFixed(2) : '?'}
        </span>
      </div>
    </div>
  );
}

/** session 7 readback section: habitat scenery (#U4) — the corner-fold
 *  census (the raw query) + dragonfly telemetry. Pure scenery: the only
 *  "trigger" is the readback itself — nothing is force-able (the layout
 *  is deterministic from the classification truth). */
function Session7HabitatReadback() {
  const [, forceRender] = useState(0);
  const w = (window as unknown as { __meadowlight?: { habitatReadback: () => { foldCells: { x: number; z: number }[]; dragonflies: number } } }).__meadowlight;
  const data = w?.habitatReadback();
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>habitat scenery (U4)</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        fold cells {data ? data.foldCells.length : '?'} · dragonflies {data ? data.dragonflies : '?'}
        <button
          data-perf-s7="habitat-refresh"
          onClick={() => forceRender((n) => n + 1)}
          style={{ margin: '0 6px', padding: '2px 8px', borderRadius: 8, border: 'none', background: '#666', color: '#fff', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
        >
          refresh
        </button>
      </div>
    </div>
  );
}

/** session 7 readback section: night sky (#U5) — force the day phase
 *  (the natural input), read the shared visibility predicate + live star
 *  opacity + the cloud material value. */
function Session7NightSkyReadback() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button
      key={key}
      data-perf-s7={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      style={{ margin: '2px 4px 2px 0', padding: '5px 9px', borderRadius: 8, border: 'none', background: '#666', color: '#fff', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
    >
      {label}
    </button>
  );
  const w = (window as unknown as { __meadowlight?: { setDayPhase: (p: number) => void; starsReadback: () => { visible: number; opacity: number }; cloudOpacityReadback: () => number } }).__meadowlight;
  const stars = w?.starsReadback();
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #555', paddingTop: 8 }}>
      <div style={{ fontWeight: 'bold' }}>night sky (U5)</div>
      <div>
        {btn('night', () => w?.setDayPhase(0.0), 'sky-night')}
        {btn('evening', () => w?.setDayPhase(0.84), 'sky-evening')}
        {btn('morning', () => w?.setDayPhase(0.3), 'sky-morning')}
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {' '}stars {stars ? stars.visible : '?'} @ opacity {stars ? stars.opacity.toFixed(2) : '?'} · clouds {w ? w.cloudOpacityReadback() : '?'}
        </span>
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
