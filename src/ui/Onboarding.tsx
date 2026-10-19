import { useState } from 'react';
import { usePlacementStore } from '../render/placementStore';

/**
 * Gentle 3-step onboarding: "plant a flower" -> "click it to learn" ->
 * "come back tomorrow". Shown exactly once — dismissal persists in the save
 * (v4, additive; existing saves never see it retroactively).
 *
 * One-input-path rule: the card is a small lower-left panel with
 * pointerEvents: 'auto' ONLY on itself — no full-screen backdrop, so every
 * click outside it (placement, camera, palette) flows to the canvas
 * untouched. A single dismiss click at any step (including mid-step) ends
 * it forever; "next" advances. It never blocks placement where it doesn't
 * overlap.
 */

const STEPS: { title: string; body: string }[] = [
  {
    title: '\u{1F33C} Plant a flower',
    body: 'Pick any flower from the palette below and click the meadow to plant it. There is no wrong spot — winding drifts look best.',
  },
  {
    title: '\u{1F41D} Click it to learn',
    body: 'Click any flower, hive, or bath with an empty hand (no tool selected) and your field notebook shares a real bee fact.',
  },
  {
    title: '\u{1F305} Come back tomorrow',
    body: 'The meadow grows on its own while you are away. Turn the season dial, keep bees happy, and check back for milestones.',
  },
];

export function Onboarding() {
  const dismissed = usePlacementStore((s) => s.onboardingDismissed);
  const dismissOnboarding = usePlacementStore((s) => s.dismissOnboarding);
  const [step, setStep] = useState(0);
  if (dismissed) return null;
  const last = step >= STEPS.length - 1;
  return (
    <div
      data-onboarding
      style={{
        position: 'absolute',
        bottom: 16,
        left: 12,
        maxWidth: 320,
        padding: '14px 16px',
        borderRadius: 16,
        background: 'rgba(255, 244, 220, 0.95)',
        boxShadow: '0 4px 16px rgba(122, 90, 43, 0.22)',
        color: '#5a4322',
        fontFamily: 'inherit',
        pointerEvents: 'auto',
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: '#9a7a45', marginBottom: 4 }}>
        Welcome to your meadow \u00b7 step {step + 1} of 3
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{STEPS[step].title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>{STEPS[step].body}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => (last ? dismissOnboarding() : setStep(step + 1))}
          data-onboarding-next
          style={{
            padding: '4px 12px',
            borderRadius: 8,
            border: '2px solid #7a9d54',
            background: '#dcedc2',
            color: '#5a4322',
            fontFamily: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {last ? 'begin \u{1F41D}' : 'next'}
        </button>
        <button
          onClick={dismissOnboarding}
          data-onboarding-dismiss
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#9a7a45',
            fontFamily: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          skip — I know the way
        </button>
      </div>
    </div>
  );
}
