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

/**
 * #36 item 2 (approved scope): the time controls sit directly ABOVE the
 * season dial — pause + 1x/2x/4x/8x discrete steps (8x ≈ 90s night, ~2min
 * season: slow phases can be genuinely skipped, not nudged), plus a
 * "morning / spring" jump that REUSES the existing force-day/force-season
 * override paths (renamed for users — never a new time path).
 * NOT persisted: reload resumes natural time — a returning visitor never
 * finds a frozen world.
 */
import {
  SPEED_STEPS,
  currentSpeedStep,
  isPaused,
  setPaused,
  setSpeedStep,
  type SpeedStep,
} from '../engine/timeControl';
import { setDayPhase } from '../engine/dayCycle';

export function TimeControls() {
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);
  useEffect(() => {
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, []);
  const btn = (label: string, active: boolean, onClick: () => void, key: string, title: string) => (
    <button
      data-time-control={key}
      key={key}
      onClick={() => {
        onClick();
        refresh();
      }}
      title={title}
      style={{
        padding: '3px 8px',
        borderRadius: theme.border.radius,
        border: `${theme.border.chunk}px solid ${active ? theme.color.clay : theme.color.honeyDark}`,
        background: active ? theme.color.honeyActive : theme.color.parchmentLight,
        color: theme.color.textSoft,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  // observable pause (the named-state rule): the row dims and a resting
  // chip appears whenever paused — frozen must read at a glance, never as
  // "the controls do nothing" (the silent-success lesson, session 4)
  const paused = isPaused();
  return (
    <div
      data-time-row
      style={{
        position: 'absolute',
        top: 56,
        right: 12,
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        padding: '5px 8px',
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        fontFamily: theme.font.family,
        opacity: paused ? 0.55 : 1,
        transition: 'opacity 0.25s',
      }}
    >
      {paused ? (
        <span
          data-paused-chip
          style={{
            fontSize: 11,
            opacity: 0.9,
            marginRight: 4,
            padding: '1px 6px',
            borderRadius: theme.border.radius,
            border: `${theme.border.chunk}px solid ${theme.color.clay}`,
            color: theme.color.textSoft,
          }}
        >
          {'\u{1F634} resting'}
        </span>
      ) : (
        <span style={{ fontSize: 11, opacity: 0.7, marginRight: 2 }}>
          {'\u{1F552}'}
        </span>
      )}
      {btn('\u23F8', isPaused(), () => setPaused(!isPaused()), 'pause', 'Let the meadow hold still a moment (resumes naturally on your next visit)')}
      {SPEED_STEPS.map((s: SpeedStep) =>
        btn(`${s}x`, !isPaused() && currentSpeedStep() === s, () => setSpeedStep(s), `speed-${s}`, `Let time drift ${s}x faster${s === 8 ? ' — a night passes in about a minute and a half' : ''}`),
      )}
      {btn('\u{1F305} morning', false, () => {
        setDayPhase(0.3);
        usePlacementStore.getState().setSeason('spring');
        usePlacementStore.getState().resumeSeasonClock();
        refresh();
      }, 'jump-morning', 'A new spring morning (the same override the season dial uses)')}
    </div>
  );
}
