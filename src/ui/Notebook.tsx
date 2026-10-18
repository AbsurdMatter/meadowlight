import { useEffect, useMemo } from 'react';
import { PLANTS } from '../data/plants';
import { usePlacementStore } from '../render/placementStore';
import {
  choosePlantFact,
  chooseStructureFact,
  chooseMeadowFact,
} from '../engine/factSelection';

/**
 * Ambient info panel: shows a fact for the inspected object, varies content
 * (season/context variants, preferring unseen), marks already-seen facts, and
 * dismisses leniently — click outside, Escape, or starting a placement.
 * Never blocks anything: pure pointer-events on the card itself only.
 */
export function Notebook() {
  const entry = usePlacementStore((s) => s.notebook);
  const close = usePlacementStore((s) => s.closeNotebook);
  const seenFacts = usePlacementStore((s) => s.seenFacts);
  const markFactSeen = usePlacementStore((s) => s.markFactSeen);
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const selectedStructureId = usePlacementStore((s) => s.selectedStructureId);

  // Escape dismisses
  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, close]);

  // starting a placement dismisses
  useEffect(() => {
    if (entry && (selectedPlantId || selectedStructureId)) close();
  }, [entry, selectedPlantId, selectedStructureId, close]);

  // click outside dismisses
  useEffect(() => {
    if (!entry) return;
    const onPointerDown = (e: PointerEvent) => {
      const card = document.getElementById('notebook-card');
      if (card && !card.contains(e.target as Node)) close();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () =>
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
  }, [entry, close]);

  const content = useMemo(() => {
    if (!entry) return null;
    const s = usePlacementStore.getState();
    if (entry.kind === 'plant') {
      const item = s.items.find((i) => i.id === entry.id);
      if (!item) return null;
      const choice = choosePlantFact(
        item.plantId,
        s.season,
        s.items,
        s.structures,
        s.seenFacts,
        item.position,
      );
      const name = PLANTS.find((p) => p.id === item.plantId)?.name ?? 'Flower';
      return { title: name, choice, hint: null };
    }
    if (entry.kind === 'structure') {
      const choice = chooseStructureFact(entry.id, s.season, s.seenFacts);
      const name = entry.id.charAt(0).toUpperCase() + entry.id.slice(1);
      return { title: name, choice, hint: null };
    }
    const choice = chooseMeadowFact(s.season, s.seenFacts);
    const blooming = PLANTS.filter((p) => p.bloom.includes(s.season)).map((p) => p.name);
    return {
      title: 'The Meadow',
      choice,
      hint:
        blooming.length > 0
          ? `In bloom now: ${blooming.join(', ')}.`
          : 'A quiet winter — the bees rest.',
    };
  }, [entry, seenFacts]);

  // mark the shown fact as seen
  useEffect(() => {
    if (content) markFactSeen(content.choice.fact.id);
  }, [content, markFactSeen]);

  if (!entry || !content) return null;

  return (
    <div
      id="notebook-card"
      style={{
        position: 'absolute',
        bottom: 120,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '14px 20px',
        borderRadius: 16,
        background: 'rgba(255, 250, 235, 0.96)',
        boxShadow: '0 6px 24px rgba(122, 90, 43, 0.25)',
        color: '#5a4322',
        fontFamily: 'inherit',
        maxWidth: 420,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 15 }}>
          {content.title}
          {content.choice.alreadySeen && (
            <span title="You've read this one before" style={{ fontSize: 12, marginLeft: 6, opacity: 0.6 }}>
              ✦
            </span>
          )}
        </strong>
        <button
          onClick={close}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#7a5a2b',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{content.choice.fact.text}</div>
      {content.hint && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{content.hint}</div>
      )}
    </div>
  );
}
