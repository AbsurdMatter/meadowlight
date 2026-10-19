import { Component, useEffect, useState, type ReactNode } from 'react';
import { PLANTS } from '../data/plants';
import { STRUCTURES } from '../data/structures';
import {
  PLANT_FACTS,
  STRUCTURE_FACTS,
  SEASON_VARIANT_FACTS,
  MEADOW_FACTS,
  SEASON_FACTS,
  CONTEXT_FACTS,
  type FactEntry,
} from '../data/facts';
import { MILESTONES } from '../data/milestones';
import { usePlacementStore } from '../render/placementStore';
import { theme } from './theme';

class HubBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[notebook hub] crashed and was contained:', error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const factText = (id: string): string | null => {
  const all: FactEntry[] = [
    ...Object.values(PLANT_FACTS),
    ...Object.values(STRUCTURE_FACTS),
    ...Object.values(SEASON_FACTS),
    ...MEADOW_FACTS,
    ...Object.values(CONTEXT_FACTS),
    ...Object.values(SEASON_VARIANT_FACTS.spring),
    ...Object.values(SEASON_VARIANT_FACTS.summer),
    ...Object.values(SEASON_VARIANT_FACTS.autumn),
    ...Object.values(SEASON_VARIANT_FACTS.winter),
  ];
  return all.find((f) => f.id === id)?.text ?? null;
};

const hubPanelStyle: React.CSSProperties = {
  // fixed to the viewport, not the hub button's corner wrapper — an absolute
  // panel inside that wrapper resolves top/left against the tiny corner box
  // and renders off-viewport (same bug class as the reset dialog)
  position: 'fixed',
  top: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 520,
  maxHeight: '70vh',
  overflowY: 'auto',
  padding: theme.spacing.dialogPadding,
  borderRadius: theme.border.radiusPanel,
  background: theme.color.panelSolid,
  border: `${theme.border.chunky}px solid ${theme.color.honey}`,
  boxShadow: theme.border.shadowPanel,
  color: theme.color.text,
  fontFamily: theme.font.family,
  zIndex: 40,
};

function HubInner() {
  const [open, setOpen] = useState(false);
  const seenFacts = usePlacementStore((s) => s.seenFacts);
  const milestones = usePlacementStore((s) => s.milestones);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const learnedByGroup: { group: string; facts: { id: string; text: string }[] }[] = [];
  const groups: { name: string; ids: string[] }[] = [
    ...PLANTS.map((p) => ({ name: p.name, ids: [p.id && `plant:${p.id}`] })),
    ...STRUCTURES.map((s) => ({ name: s.name, ids: [`structure:${s.id}`] })),
  ];
  for (const g of groups) {
    const facts: { id: string; text: string }[] = [];
    for (const id of g.ids) {
      if (id && seenFacts.includes(id)) {
        const text = factText(id);
        if (text) facts.push({ id, text });
      }
    }
    if (facts.length > 0) learnedByGroup.push({ group: g.name, facts });
  }
  // variants + meadow + season + context facts (ungrouped extras)
  const miscSeen = seenFacts.filter((id) => !id.startsWith('plant:') && !id.startsWith('structure:'));

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Field notebook"
        style={{
          padding: '4px 12px',
          borderRadius: theme.border.radius,
          border: `${theme.border.chunk}px solid ${theme.color.honey}`,
          background: theme.color.parchmentDeep,
          color: theme.color.text,
          fontFamily: theme.font.family,
          fontSize: theme.font.bodySize,
          cursor: 'pointer',
          boxShadow: theme.border.shadow,
        }}
      >
        📖
      </button>
      {open && (
        <div style={hubPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: theme.font.titleSize }}>Field Notebook</strong>
            <button
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'transparent', color: theme.color.textSoft, fontSize: 16, cursor: 'pointer', fontFamily: theme.font.family }}
            >
              ✕
            </button>
          </div>

          <h4 style={{ margin: '14px 0 6px', fontSize: theme.font.headerSize, letterSpacing: 0.4 }}>LEARNED FACTS</h4>
          {learnedByGroup.length === 0 && miscSeen.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Nothing yet — every flower, hive, and quiet corner of the meadow has a story. Click one with an empty hand and it will land here. 🐝
            </div>
          )}
          {learnedByGroup.map((g) => (
            <div key={g.group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{g.group}</div>
              {g.facts.map((f) => (
                <div key={f.id} style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
                  ✦ {f.text}
                </div>
              ))}
            </div>
          ))}
          {miscSeen.map((id) => {
            const text = factText(id);
            return text ? (
              <div key={id} style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9, marginBottom: 4 }}>
                ✦ {text}
              </div>
            ) : null;
          })}

          <h4 style={{ margin: '16px 0 6px', fontSize: theme.font.headerSize, letterSpacing: 0.4 }}>MILESTONES</h4>
          {MILESTONES.map((m) => {
            const unlocked = milestones.includes(m.id);
            return (
              <div
                key={m.id}
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  marginBottom: 6,
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                {unlocked ? '🏅' : '🔒'} <strong>{m.label}</strong>
                {unlocked ? ` — ${m.detail}` : ' — still waiting in the meadow…'}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Notebook hub button + panel, error-bounded so a bug here can't blank the app. */
export function NotebookHub() {
  return (
    <HubBoundary>
      <HubInner />
    </HubBoundary>
  );
}
