import { useState } from 'react';
import { usePlacementStore } from '../render/placementStore';
import { theme, headingStyle } from './theme';

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
 * overlap. Styled from the theme module only (#16).
 */
const STEPS: { title: string; body: string }[] = [
  {
    title: '🌼 Plant a flower',
    body: 'Pick any flower from the palette below and click the meadow to plant it. There is no wrong spot — winding drifts look best.',
  },
  {
    title: '🐝 Click it to learn',
    body: 'Click any flower, hive, or bath with an empty hand (no tool selected) and your field notebook shares a real bee fact.',
  },
  {
    title: '🌇 Come back tomorrow',
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
        // #6384003544: renders ABOVE the palette dock — anchored to the
        // dock's top edge (the dock is bottom:16 + its height), never
        // overlapping the dock or the corner controls
        position: 'absolute',
        bottom: 120,
        left: 16,
        maxWidth: 320,
        padding: theme.spacing.panelPadding,
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        color: theme.color.text,
        fontFamily: theme.font.family,
        pointerEvents: 'auto',
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: theme.font.smallSize - 1, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.color.textFaint, marginBottom: 4 }}>
        Welcome to your meadow · step {step + 1} of 3
      </div>
      <div style={{ ...headingStyle(theme.font.bodySize + 1), marginBottom: 6 }}>{STEPS[step].title}</div>
      <div style={{ fontSize: theme.font.smallSize + 1, lineHeight: theme.font.lineHeight, marginBottom: 10 }}>{STEPS[step].body}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => (last ? dismissOnboarding() : setStep(step + 1))}
          data-onboarding-next
          style={{
            padding: '4px 12px',
            borderRadius: theme.border.radius,
            border: `${theme.border.chunk}px solid ${theme.color.sage}`,
            background: theme.color.sageLight,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontSize: theme.font.smallSize + 1,
            cursor: 'pointer',
            boxShadow: theme.border.shadow,
          }}
        >
          {last ? 'begin 🐝' : 'next'}
        </button>
        <button
          onClick={dismissOnboarding}
          data-onboarding-dismiss
          style={{
            padding: '4px 10px',
            borderRadius: theme.border.radius,
            border: 'none',
            background: 'transparent',
            color: theme.color.textFaint,
            fontFamily: theme.font.family,
            fontSize: theme.font.smallSize,
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
