import { useEffect, useMemo, useState } from 'react';
import { PLANTS } from '../data/plants';
import { STRUCTURES, type StructureId } from '../data/structures';
import { usePlacementStore } from '../render/placementStore';
import { renderVoxelThumb } from '../engine/thumbnails';
import { theme, headingStyle } from './theme';

const chipStyle = (active: boolean, enabled: boolean): React.CSSProperties => ({
  border: `${theme.border.chunk}px solid ${active ? theme.color.clay : 'transparent'}`,
  borderRadius: theme.border.radius,
  padding: '6px 8px',
  background: active ? theme.color.honeyActive : theme.color.parchmentLight,
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  fontFamily: theme.font.family,
  opacity: enabled ? 1 : 0.45,
});

const sectionLabelStyle: React.CSSProperties = {
  ...headingStyle(11),
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: theme.color.textFaint,
  alignSelf: 'flex-start',
  marginBottom: 2,
};

/** one panel, clear headers, generous gap, subtle per-section tint */
const sectionStyle = (tint: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '6px 10px 8px',
  borderRadius: theme.border.radius,
  background: tint,
});

const buttonStyle = (active: boolean): React.CSSProperties => ({
  padding: '2px 10px',
  borderRadius: theme.border.radius,
  border: `${theme.border.chunk}px solid ${active ? theme.color.sage : theme.color.honeyDark}`,
  background: active ? theme.color.sageLight : theme.color.parchment,
  color: theme.color.text,
  fontFamily: theme.font.family,
  cursor: 'pointer',
});

const thumbStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  imageRendering: 'pixelated',
};

interface PaletteEntry {
  key: string;
  name: string;
  kind: 'plant' | 'structure';
  id: string;
  thumb: string | null;
  swatch: string;
}

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
  const wildUnlocked = milestones.includes('hotelGuests');
  const unlocked: Record<StructureId, boolean> = {
    hive: true,
    bath: bathUnlocked,
    hotel: hotelUnlocked,
    hedge: hedgeUnlocked,
    wildcorner: wildUnlocked,
    bush: true,
  };
  // voxel thumbnails rendered once at startup, cached (no per-frame cost)
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const t: Record<string, string | null> = {};
    for (const p of PLANTS) {
      t['plant:' + p.id] = renderVoxelThumb(p.parts, p.height);
    }
    for (const st of STRUCTURES) {
      const h = Math.max(...st.parts.map((p) => p.offset[1] + p.size[1] / 2));
      t['structure:' + st.id] = renderVoxelThumb(st.parts, h);
    }
    setThumbs(t);
  }, []);
  const flora: PaletteEntry[] = useMemo(
    () => [
      ...PLANTS.map((p) => ({
        key: 'plant:' + p.id,
        name: p.name,
        kind: 'plant' as const,
        id: p.id,
        thumb: thumbs['plant:' + p.id] ?? null,
        swatch: p.parts[p.parts.length - 1].color,
      })),
      ...STRUCTURES.filter((s) => s.id === 'hedge' || s.id === 'wildcorner' || s.id === 'bush').map((s) => ({
        key: 'structure:' + s.id,
        name: s.name,
        kind: 'structure' as const,
        id: s.id,
        thumb: thumbs['structure:' + s.id] ?? null,
        swatch: s.parts[s.parts.length - 1].color,
      })),
    ],
    [thumbs],
  );
  const beeCare: PaletteEntry[] = useMemo(
    () =>
      STRUCTURES.filter((s) => s.id === 'hive' || s.id === 'bath' || s.id === 'hotel').map((s) => ({
        key: 'structure:' + s.id,
        name: s.name,
        kind: 'structure' as const,
        id: s.id,
        thumb: thumbs['structure:' + s.id] ?? null,
        swatch: s.parts[s.parts.length - 1].color,
      })),
    [thumbs],
  );
  const isActive = (e: PaletteEntry) =>
    e.kind === 'plant' ? selectedPlantId === e.id : selectedStructureId === e.id;
  const isEnabled = (e: PaletteEntry) =>
    e.kind === 'plant' ? true : unlocked[e.id as StructureId];
  const renderEntry = (e: PaletteEntry) => {
    const active = isActive(e);
    const enabled = isEnabled(e);
    return (
      <button
        key={e.key}
        data-palette-entry={e.key}
        onClick={() => {
          if (!enabled) return;
          if (e.kind === 'plant') select(active ? null : e.id);
          else selectStructure(active ? null : (e.id as StructureId));
        }}
        style={chipStyle(active, enabled)}
        title={enabled ? e.name : 'keep tending the meadow to unlock this'}
      >
        {e.thumb ? (
          <img src={e.thumb} alt={e.name} style={thumbStyle} data-palette-thumb={e.key} />
        ) : (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: e.swatch,
              border: `${theme.border.chunk}px solid ${theme.color.sage}`,
            }}
          />
        )}
        <span style={{ fontSize: theme.font.smallSize, color: theme.color.textSoft, whiteSpace: 'nowrap' }}>{e.name}</span>
      </button>
    );
  };
  return (
    <div
      data-palette-dock="left"
      style={{
        // UI verdict (#6383659472): a compact LEFT-DOCKED column, not a
        // full-width bottom bar — the meadow stays visible while browsing.
        // Docked at the free left edge (top-right = dial/time, bottom-right
        // = corner controls, bottom-left = onboarding); chips wrap inside a
        // narrow column, sections stack with headers, and the dock scrolls
        // only when the viewport is short.
        position: 'absolute',
        top: 12,
        left: 12,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        width: 264,
        boxSizing: 'border-box',
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        fontFamily: theme.font.family,
      }}
    >
      <div style={sectionStyle('rgba(220, 236, 194, 0.35)')} data-palette-section="flora">
          <span style={sectionLabelStyle} data-section="flora">
            🌿 Flora &amp; nature
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{flora.map(renderEntry)}</div>
      </div>
      <div style={sectionStyle('rgba(255, 233, 184, 0.35)')} data-palette-section="beecare">
          <span style={sectionLabelStyle} data-section="beecare">
            🐝 Bee care
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{beeCare.map(renderEntry)}</div>
      </div>
      {/* the placement-mode row sits visually SEPARATED from both sections:
          a hairline divider + its own row (it is a mode, not an item) */}
      <div
        data-palette-section="mode"
        style={{
          borderTop: `1px solid ${theme.color.honeyDark}44`,
          paddingTop: 8,
          marginTop: 2,
          fontSize: theme.font.smallSize,
          color: theme.color.textSoft,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>Natural placement</span>
        <button onClick={toggleVariation} style={buttonStyle(placementVariation)}>
          {placementVariation ? 'ON' : 'OFF'}
        </button>
        <span style={{ opacity: 0.65 }}>(F)</span>
      </div>
    </div>
  );
}
