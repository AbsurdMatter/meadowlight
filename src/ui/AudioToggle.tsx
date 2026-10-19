import { useEffect, useState } from 'react';
import {
  startAmbientAudio,
  stopAmbientAudio,
  setBeeCountSource,
} from '../engine/audio';
import { beeDebug } from '../render/BeeSwarm';
import { solitaryBeeDebug, rareBeeDebug } from '../render/SolitaryBees';

/**
 * Single visible audio toggle: OFF by default. The WebAudio graph is
 * constructed only inside this button's click handler (a real user gesture),
 * never on mount. Plain DOM UI — no canvas pointer interception.
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
        padding: '8px 12px',
        borderRadius: 10,
        border: `2px solid ${on ? '#7a9d54' : '#d9b36a'}`,
        background: on ? '#dcedc2' : '#fff4dc',
        color: '#5a4322',
        fontFamily: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(122, 90, 43, 0.15)',
      }}
    >
      {on ? '\u{1F507} Sound on' : '\u{1F50A} Sound off'}
    </button>
  );
}
