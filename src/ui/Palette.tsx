import { useEffect, useMemo, useState } from 'react';
import { PLANTS } from '../data/plants';
import { STRUCTURES, type StructureId } from '../data/structures';
import { usePlacementStore } from '../render/placementStore';
import { renderVoxelThumb } from '../engine/thumbnails';

const chipStyle = (active: boolean, enabled: boolean): React.CSSProperties => ({
  border: active ? '2px solid #d24a43' : '2px solid transparent',
  borderRadius: 12,
  padding: '6px 8px',
  background: active ? '#ffe9b8' : '#fff8e8',
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  fontFamily: 'inherit',
  opacity: enabled ? 1 : 0.45,
});

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: '#9a7a45',
  alignSelf: 'flex-start',
  marginBottom: 2,
};

/** one panel, clear headers, generous gap, subtle per-section tint */
const sectionStyle = (tint: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '6px 10px 8px',
  borderRadius: 12,
  background: tint,
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
      ...STRUCTURES.filter((s) => s.id === 'hedge' || s.id === 'wildcorner').map((s) => ({
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
              border: '2px solid #7a9d54',
            }}
          />
        )}
        <span style={{ fontSize: 12, color: '#7a5a2b', whiteSpace: 'nowrap' }}>{e.name}</span>
      </button>
    );
  };

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
        <span>Natural placement: {placementVariation ? 'on' : 'off'}</span>
        <button onClick={toggleVariation} style={buttonStyle(placementVariation)}>
          {placementVariation ? 'ON' : 'OFF'}
        </button>
        <span style={{ opacity: 0.65 }}>(F)</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={sectionStyle('rgba(220, 236, 194, 0.35)')} data-palette-section="flora">
          <span style={sectionLabelStyle} data-section="flora">
            🌿 Flora &amp; nature
          </span>
          <div style={{ display: 'flex', gap: 6 }}>{flora.map(renderEntry)}</div>
        </div>
        <div style={sectionStyle('rgba(255, 233, 184, 0.35)')} data-palette-section="beecare">
          <span style={sectionLabelStyle} data-section="beecare">
            🐝 Bee care
          </span>
          <div style={{ display: 'flex', gap: 6 }}>{beeCare.map(renderEntry)}</div>
        </div>
      </div>
    </div>
  );
}
