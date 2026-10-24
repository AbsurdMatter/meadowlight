import { useEffect, useState } from 'react';
import {
  startAmbientAudio,
  stopAmbientAudio,
  setBeeCountSource,
} from '../engine/audio';
import { beeDebug } from '../render/BeeSwarm';
import { solitaryBeeDebug, rareBeeDebug } from '../render/SolitaryBees';
import { theme } from './theme';

/**
 * Single visible audio toggle: OFF by default. The WebAudio graph is
 * constructed only inside this button's click handler (a real user gesture),
 * never on mount. Plain DOM UI — no canvas pointer interception.
 * Styled from the theme module only (#16).
 */
export function AudioToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setBeeCountSource(() => beeDebug.count + solitaryBeeDebug.count + rareBeeDebug.count);
    return () => stopAmbientAudio();
  }, []);
  const toggle = () => {
    const next = !on;
    if (next) {
      const ok = startAmbientAudio();
      setOn(ok);
    } else {
      stopAmbientAudio();
      setOn(false);
    }
  };
  return (
    <button
      onClick={toggle}
      data-audio-toggle
      title={on ? 'Mute the meadow' : 'Listen to the meadow'}
      style={{
        // UI round 3 (#6383867199): shares the corner row's 36px baseline
        height: 36,
        boxSizing: 'border-box',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        borderRadius: theme.border.radius,
        border: `${theme.border.chunk}px solid ${on ? theme.color.sage : theme.color.honey}`,
        background: on ? theme.color.sageLight : theme.color.parchment,
        color: theme.color.text,
        fontFamily: theme.font.family,
        fontSize: theme.font.smallSize,
        cursor: 'pointer',
        boxShadow: theme.border.shadow,
      }}
    >
      {on ? '\u{1F507} Sound on' : '\u{1F50A} Sound off'}
    </button>
  );
}
