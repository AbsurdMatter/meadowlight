import { PLANTS } from '../data/plants';
import { STRUCTURES } from '../data/structures';
import { usePlacementStore } from '../render/placementStore';
import type { StructureId } from '../data/structures';

const chipStyle = (active: boolean, enabled: boolean): React.CSSProperties => ({
  border: active ? '2px solid #d24a43' : '2px solid transparent',
  borderRadius: 12,
  padding: '6px 10px',
  background: active ? '#ffe9b8' : '#fff8e8',
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.45,
});

const buttonStyle = (active: boolean): React.CSSProperties => ({
  padding: '2px 10px',
  borderRadius: 8,
  border: `2px solid ${active ? '#7a9d54' : '#b0a58c'}`,
  background: active ? '#dcedc2' : '#f0ead9',
  color: '#5a4322',
  fontFamily: 'inherit',
  cursor: 'pointer',
});

export function Palette() {
  const selectedPlantId = usePlacementStore((s) => s.selectedPlantId);
  const selectedStructureId = usePlacementStore((s) => s.selectedStructureId);
  const select = usePlacementStore((s) => s.select);
  const selectStructure = usePlacementStore((s) => s.selectStructure);
  const placementVariation = usePlacementStore((s) => s.placementVariation);
  const toggleVariation = usePlacementStore((s) => s.toggleVariation);
  const milestones = usePlacementStore((s) => s.milestones);

  const bathUnlocked = milestones.includes('fiveSpecies') || milestones.includes('beeBath');
  const hedgeUnlocked = milestones.includes('firstHive') || milestones.includes('hedgesUnlocked');
  const hotelUnlocked = milestones.includes('tenSpecies');

  const unlocked: Record<StructureId, boolean> = {
    hive: true,
    bath: bathUnlocked,
    hotel: hotelUnlocked,
    hedge: hedgeUnlocked,
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 16,
        background: 'rgba(255, 244, 220, 0.9)',
        boxShadow: '0 4px 16px rgba(122, 90, 43, 0.18)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#7a5a2b',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>Natural placement: {placementVariation ? 'on' : 'off'}</span>
        <button onClick={toggleVariation} style={buttonStyle(placementVariation)}>
          {placementVariation ? 'ON' : 'OFF'}
        </button>
        <span style={{ opacity: 0.65 }}>(F)</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {PLANTS.map((p) => {
          const active = selectedPlantId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => select(active ? null : p.id)}
              style={chipStyle(active, true)}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: p.parts[p.parts.length - 1].color,
                  border: '2px solid #7a9d54',
                }}
              />
              <span style={{ fontSize: 12, color: '#7a5a2b' }}>{p.name}</span>
            </button>
          );
        })}
        {STRUCTURES.map((st) => {
          const active = selectedStructureId === st.id;
          const enabled = unlocked[st.id];
          return (
            <button
              key={st.id}
              onClick={() => (enabled ? selectStructure(active ? null : st.id) : null)}
              style={chipStyle(active, enabled)}
              title={enabled ? st.name : 'keep tending the meadow to unlock this'}
            >
              <span style={{ fontSize: 18, lineHeight: '22px' }}>{st.emoji}</span>
              <span style={{ fontSize: 12, color: '#7a5a2b' }}>{st.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
