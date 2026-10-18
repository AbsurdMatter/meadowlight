import { PLANTS } from '../data/plants';
import { usePlacementStore } from '../render/placementStore';

const chipStyle = (active: boolean): React.CSSProperties => ({
  border: active ? '2px solid #d24a43' : '2px solid transparent',
  borderRadius: 12,
  padding: '6px 10px',
  background: active ? '#ffe9b8' : '#fff8e8',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  fontFamily: 'inherit',
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
  const select = usePlacementStore((s) => s.select);
  const placementVariation = usePlacementStore((s) => s.placementVariation);
  const toggleVariation = usePlacementStore((s) => s.toggleVariation);

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
        <span>Random rotation: {placementVariation ? 'on' : 'off'}</span>
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
              style={chipStyle(active)}
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
      </div>
    </div>
  );
}
