import { SEASONS, SEASON_INFO } from '../data/seasons';
import { usePlacementStore } from '../render/placementStore';
import { theme } from './theme';

const uiButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: theme.border.radius,
  border: `${theme.border.chunk}px solid ${active ? theme.color.clay : theme.color.honeyDark}`,
  background: active ? theme.color.honeyActive : theme.color.parchmentLight,
  color: theme.color.textSoft,
  fontFamily: theme.font.family,
  fontSize: theme.font.smallSize,
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
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        fontFamily: theme.font.family,
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
