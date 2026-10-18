import { SEASONS, SEASON_INFO } from '../data/seasons';
import { usePlacementStore } from '../render/placementStore';

const uiButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 10,
  border: `2px solid ${active ? '#d24a43' : 'transparent'}`,
  background: active ? '#ffe9b8' : '#fff8e8',
  color: '#7a5a2b',
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
});

export function SeasonDial() {
  const season = usePlacementStore((s) => s.season);
  const setSeason = usePlacementStore((s) => s.setSeason);
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 14,
        background: 'rgba(255, 244, 220, 0.9)',
        boxShadow: '0 4px 16px rgba(122, 90, 43, 0.18)',
        alignItems: 'center',
      }}
    >
      {SEASONS.map((s) => (
        <button
          key={s}
          onClick={() => setSeason(s)}
          style={uiButtonStyle(season === s)}
          title={SEASON_INFO[s].tip}
        >
          {SEASON_INFO[s].emoji} {SEASON_INFO[s].label}
        </button>
      ))}
    </div>
  );
}
