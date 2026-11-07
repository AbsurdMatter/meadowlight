import { Component, type ReactNode } from 'react';
import { PLANTS } from '../data/plants';
import { STRUCTURES } from '../data/structures';
import { MAGNIFIER_WILDLIFE } from '../data/magnifierWildlife';
import { PLANT_BY_ID } from '../data/plants';
import { STRUCTURE_BY_ID } from '../data/structures';
import type { JournalRecord } from '../engine/sightingJournal';
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
import { RECIPES } from '../data/recipes';
import { QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING, type SeasonalVisitorTuning } from '../data/seasonalVisitors';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';
import { useLocale } from '../engine/locale';
import { RECIPE_LABEL_COPY, VISITOR_NAME_COPY, PLANT_NAME_COPY, STRUCTURE_NAME_COPY, MILESTONE_LABEL_COPY } from '../data/i18n';

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

/** O2: the journal row's display label — flowers/structures by name,
 *  wildlife by the glass's own name (one source: the same tables the card
 *  reads; the journal adds no new facts). */
function journalLabel(r: JournalRecord, locale: import('../data/i18n').Locale, t: import('../data/i18n').UiCopy): string {
  if (r.kind === 'flower') {
    // the subject is the placed id — resolve the species name from the
    // live world (display only; the record itself is the saved ground truth)
    const item = usePlacementStore.getState().items.find((i) => i.id === r.subject);
    const def = item ? PLANT_BY_ID[item.plantId] : undefined;
    return def ? (PLANT_NAME_COPY[locale][def.id] ?? def.name) : t.flowerFallback;
  }
  if (r.kind === 'structure') {
    return (STRUCTURE_NAME_COPY[locale][r.subject] ?? STRUCTURE_BY_ID[r.subject as keyof typeof STRUCTURE_BY_ID]?.name) ?? r.subject;
  }
  return (VISITOR_NAME_COPY[locale][r.subject] ?? MAGNIFIER_WILDLIFE[r.subject]?.name) ?? r.subject;
}

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
  const locale = useLocale((s) => s.locale);
  const t = useLocale((s) => s.t());
  // O5 (v4, #43): the hub's open state lives in the store — the pointer
  // button and the J key write ONE source; aria-pressed syncs both ways.
  const open = usePlacementStore((s) => s.hubOpen);
  const setOpen = (v: boolean) => usePlacementStore.setState({ hubOpen: v });
  const seenFacts = usePlacementStore((s) => s.seenFacts);
  const milestones = usePlacementStore((s) => s.milestones);
  const foundRecipes = usePlacementStore((s) => s.foundRecipes);
  const visitorWindows = usePlacementStore((s) => s.visitorWindows);
  const journal = usePlacementStore((s) => s.journal);

  // O2 (v4, #40): the journal section renders from the store, which reads
  // the SAVED blob at load — ground truth, never in-memory proxies.

  const learnedByGroup: { group: string; facts: { id: string; text: string }[] }[] = [];
  const groups: { name: string; ids: string[] }[] = [
    ...PLANTS.map((p) => ({ name: PLANT_NAME_COPY[locale][p.id] ?? p.name, ids: [p.id && `plant:${p.id}`] })),
    ...STRUCTURES.map((s) => ({ name: STRUCTURE_NAME_COPY[locale][s.id] ?? s.name, ids: [`structure:${s.id}`] })),
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
        onClick={() => setOpen(!open)}
        data-notebook-hub
        title={t.hubNotebookTitle}
        aria-pressed={open}
        style={{
          // #6384003544: shares the corner row's 36px baseline with the
          // other controls (one unwrapped row)
          height: 36,
          boxSizing: 'border-box',
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
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
            <strong style={headingStyle(theme.font.titleSize)}>{t.hubTitle}</strong>
            <button
              onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'transparent', color: theme.color.textSoft, fontSize: 16, cursor: 'pointer', fontFamily: theme.font.family }}
            >
              ✕
            </button>
          </div>

          <h4 style={{ ...headingStyle(theme.font.headerSize), margin: '14px 0 6px', letterSpacing: 0.4 }}>{t.hubLearnedFacts}</h4>
          {learnedByGroup.length === 0 && miscSeen.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              {t.hubFactsEmpty}
            </div>
          )}
          {learnedByGroup.map((g) => (
            <div key={g.group} style={{ marginBottom: 8 }}>
              <div style={headingStyle(13)}>{g.group}</div>
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

          <h4 style={{ ...headingStyle(theme.font.headerSize), margin: '16px 0 6px', letterSpacing: 0.4 }}>{t.hubFirstSightings}</h4>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            What your glass has shown you — the meadow keeps the list.
          </div>
          {journal.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>
              🔒 {t.hubSightingsEmpty}
            </div>
          ) : (
            journal.map((r) => (
              <div key={`${r.kind}:${r.subject}:${r.season}`} data-journal-record={`${r.kind}:${r.subject}:${r.season}`} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                ✨ <strong>{journalLabel(r, locale, t)}</strong> — first seen in {r.season}
              </div>
            ))
          )}

          <h4 style={{ ...headingStyle(theme.font.headerSize), margin: '16px 0 6px', letterSpacing: 0.4 }}>{t.hubWildVisitors}</h4>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            {t.hubGuestBook}
          </div>
          {(() => {
            const seasonal: SeasonalVisitorTuning[] = [QUEEN_BUMBLE_TUNING, LAVENDER_MOTH_TUNING];
            const rows: { label: string; fact: string }[] = [];
            for (const v of seasonal) {
              const seen = visitorWindows.filter((k) => k.startsWith(v.id + ':')).map((k) => k.split(':')[1]);
              if (seen.length > 0) rows.push({ label: `${v.name} — ${seen.map((x) => t.seasonName(x as never)).join(', ')}`, fact: v.fact });
            }
            const fireflySeen = visitorWindows.filter((k) => k.startsWith('fireflies:')).map((k) => k.split(':')[1]);
            if (fireflySeen.length > 0)
              rows.push({ label: `${t.hubFireflyLabel} — ${fireflySeen.map((x) => t.seasonName(x as never)).join(', ')}`, fact: t.hubFireflyFact });
            if (rows.length === 0)
              return (
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>
                  🔒 No guests recorded yet — keep blooms up through the seasons and see who finds them.
                </div>
              );
            return rows.map((r) => (
              <div key={r.label} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                ✨ <strong>{r.label}</strong> — {r.fact}
              </div>
            ));
          })()}

          <h4 style={{ ...headingStyle(theme.font.headerSize), margin: '16px 0 6px', letterSpacing: 0.4 }}>{t.hubRecipes}</h4>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Some flowers love company — plant the right pair as neighbors and see.
          </div>
          {RECIPES.map((r) => {
            const found = foundRecipes.includes(r.id);
            return (
              <div
                key={r.id}
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  marginBottom: 6,
                  opacity: found ? 1 : 0.6,
                }}
              >
                {found ? '\u2728' : '\u{1F514}'} <strong>{found ? (RECIPE_LABEL_COPY[locale][r.id] ?? r.label) : t.hubRecipeUndiscovered}</strong>
                {found ? ` — ${r.fact}` : t.hubRecipeHint}
              </div>
            );
          })}
          <h4 style={{ ...headingStyle(theme.font.headerSize), margin: '16px 0 6px', letterSpacing: 0.4 }}>{t.hubMilestones}</h4>
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
                {unlocked ? '🏅' : '🔒'} <strong>{MILESTONE_LABEL_COPY[locale][m.id] ?? m.label}</strong>
                {unlocked ? ` — ${m.detail}` : ` — ${t.hubMilestoneWaiting}`}
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
