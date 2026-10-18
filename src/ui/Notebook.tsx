import { PLANT_BY_ID, PLANTS } from '../data/plants';
import { STRUCTURE_BY_ID } from '../data/structures';
import { MEADOW_FACTS, factForPlant, factForStructure } from '../data/facts';
import { usePlacementStore } from '../render/placementStore';

export function Notebook() {
  const entry = usePlacementStore((s) => s.notebook);
  const close = usePlacementStore((s) => s.closeNotebook);
  const season = usePlacementStore((s) => s.season);
  if (!entry) return null;

  let title = '';
  let fact = '';
  if (entry.kind === 'plant') {
    const item = usePlacementStore.getState().items.find((i) => i.id === entry.id);
    const def = item ? PLANT_BY_ID[item.plantId] : null;
    if (def) {
      title = def.name;
      fact = factForPlant(def);
    } else {
      close();
      return null;
    }
  } else if (entry.kind === 'structure') {
    const def = STRUCTURE_BY_ID[entry.id as keyof typeof STRUCTURE_BY_ID];
    if (def) {
      title = def.name;
      fact = factForStructure(def);
    }
  } else {
    title = 'The Meadow';
    fact = MEADOW_FACTS[Math.floor(Math.random() * MEADOW_FACTS.length)];
  }

  return (
    <div
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
        <strong style={{ fontSize: 15 }}>{title}</strong>
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
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{fact}</div>
      {entry.kind === 'meadow' && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          In bloom now: {PLANTS.filter((p) => p.bloom.includes(season)).map((p) => p.name).join(', ') || 'a quiet winter — the bees rest.'}
        </div>
      )}
    </div>
  );
}
