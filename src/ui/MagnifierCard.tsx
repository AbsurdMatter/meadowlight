import { useEffect, useMemo, useRef } from 'react';
import { PLANTS } from '../data/plants';
import { usePlacementStore } from '../render/placementStore';
import { MAGNIFIER_WILDLIFE } from '../data/magnifierWildlife';
import { PLANT_FACTS } from '../data/facts';
import { MAGNIFIER_TUNING } from '../data/magnifier';
import { theme, headingStyle } from './theme';

/**
 * N3: the magnifying-glass detail card — a zoomed close read of the hovered
 * flower or visitor. PURE INSPECTION: it renders the notebook's own fact
 * store (choosePlantFact variants never run here — the glass shows the
 * species' core fact + live read-only state), never mutates the world,
 * and never captures canvas pointer events (pointer-events: none on the
 * wrapper; placement clicks pass straight through — one input path).
 *
 * The visitor glass reuses the notebook hub's verified WILD_VISITOR_FACTS
 * (the fact store is one source; the glass adds no new facts).
 */
export function MagnifierCard() {
  const entry = usePlacementStore((s) => s.magnifierEntry);
  // N3 taste: the cursor reflects the lock — CSS reads this attribute; the
  // card owns it because IT knows an inspectable is showing (flower or
  // wildlife alike). Display state only, no JS cursor mutation.
  useEffect(() => {
    document.body.dataset.magnifierHit = entry ? '1' : '';
    return () => {
      document.body.dataset.magnifierHit = '';
    };
  }, [entry]);
  const magnifierOn = usePlacementStore((s) => s.magnifierOn);
  const setEntry = usePlacementStore((s) => s.setMagnifierEntry);
  const lingerRef = useRef<number | null>(null);

  // the card lingers briefly after pointer-out (no flicker mid-hover), then
  // hides itself — all display state, never world state
  useEffect(() => {
    if (entry) return;
    if (lingerRef.current !== null) return;
    lingerRef.current = window.setTimeout(() => {
      lingerRef.current = null;
    }, MAGNIFIER_TUNING.lingerMs);
    return () => {
      if (lingerRef.current !== null) {
        window.clearTimeout(lingerRef.current);
        lingerRef.current = null;
      }
    };
  }, [entry]);

  const content = useMemo(() => {
    if (!entry) return null;
    const s = usePlacementStore.getState();
    if (entry.kind === 'flower') {
      const item = s.items.find((i) => i.id === entry.itemId);
      if (!item) return null;
      const def = PLANTS.find((p) => p.id === item.plantId);
      if (!def) return null;
      const fact = PLANT_FACTS[item.plantId]?.text ?? 'A meadow flower.';
      const blooming = def.bloom.includes(s.season);
      // live read-only state: blooming now + the N2 visit ledger (has a
      // pollinator visited this season? — the seeding precondition, read
      // through the same one source the seeding gate uses)
      const visited = item.visitedSeasons?.includes(s.season) ?? false;
      const stateLine = [
        blooming ? 'In bloom now' : 'Resting this season',
        visited ? 'visited by a pollinator this season — it can set seed' : 'waiting for its first pollinator visit',
        item.volunteer ? 'self-seeded here on its own' : null,
      ]
        .filter(Boolean)
        .join(' \u00b7 ');
      return { title: def.name, text: fact, hint: stateLine };
    }
    const w = MAGNIFIER_WILDLIFE[entry.visitorId];
    if (!w) return { title: 'Visitor', text: 'A wild visitor, passing through the meadow.', hint: null };
    // live read-only state: the visitor-window log (the notebook's own
    // record — one source; the glass invents no state)
    let hint: string | null = null;
    if (w.visitorKey) {
      const seen = s.visitorWindows
        .filter((k) => k.startsWith(w.visitorKey + ':'))
        .map((k) => k.split(':')[1]);
      hint =
        seen.length > 0
          ? 'recorded in the notebook — visited in ' + seen.join(', ')
          : 'a first sighting — the notebook will remember it';
    }
    return { title: w.name, text: w.fact, hint };
  }, [entry]);

  if (!magnifierOn || !entry || !content) return null;
  return (
    <div
      data-magnifier-card="true"
      style={{
        position: 'fixed',
        bottom: MAGNIFIER_TUNING.cardBottom,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: theme.spacing.panelPadding,
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        fontFamily: theme.font.family,
        maxWidth: 440,
        // the card NEVER captures canvas events — placement, orbit, and
        // click-inspect all pass straight through (one input path rule)
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={headingStyle()}>
          <span style={{ marginRight: 6 }} role="img" aria-label="magnifying glass">
            {'\u{1F50D}'}
          </span>
          {content.title}
        </strong>
        <button
          onClick={() => setEntry(null)}
          style={{
            border: 'none',
            background: 'transparent',
            color: theme.color.textSoft,
            fontSize: 16,
            cursor: 'pointer',
            fontFamily: theme.font.family,
            pointerEvents: 'auto',
          }}
          aria-label="close inspection"
        >
          {'\u2715'}
        </button>
      </div>
      <div style={{ fontSize: theme.font.bodySize, lineHeight: theme.font.lineHeight, marginTop: 4 }}>
        {content.text}
      </div>
      {content.hint && (
        <div style={{ fontSize: theme.font.smallSize, opacity: 0.7, marginTop: 6 }}>{content.hint}</div>
      )}
    </div>
  );
}
