import { useEffect, useState } from 'react';
import { SEASONS, SEASON_INFO } from '../data/seasons';
import { seasonProgress, seasonClockOverridden } from '../engine/seasonClock';
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
  position: 'relative',
  overflow: 'hidden',
});

/**
 * #11: a gentle honey-colored underline on the active season button showing
 * how far the season has drifted along. Reads as ambience, not a progress
 * bar — thin, soft-colored, updates at a calm 1s cadence so it never
 * flickers with the frame loop. Hidden while an override holds the
 * calendar (nothing is advancing, so there is nothing to show).
 */
function SeasonProgressUnderline() {
  const [p, setP] = useState(() => seasonProgress());
  useEffect(() => {
    const t = setInterval(() => setP(seasonProgress()), 1000);
    return () => clearInterval(t);
  }, []);
  if (seasonClockOverridden()) return null;
  return (
    <span
      data-season-progress
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 3,
        width: `${Math.min(100, p * 100)}%`,
        background: theme.color.honey,
        borderRadius: 2,
        opacity: 0.85,
      }}
    />
  );
}

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
          {season === s && <SeasonProgressUnderline />}
        </button>
      ))}
    </div>
  );
}
