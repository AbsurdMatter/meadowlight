import { useEffect, useMemo, useState } from 'react';
import { PLANTS } from '../data/plants';
import { STRUCTURES, type StructureId } from '../data/structures';
import { usePlacementStore } from '../render/placementStore';
import { renderVoxelThumb, renderVoxelCloseUp } from '../engine/thumbnails';
import { plantingsBySeason, bloomSeasonsLabel, seasonBadge } from '../data/bloomWindows';
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

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 14px',
  borderRadius: theme.border.radius,
  border: `${theme.border.chunk}px solid ${active ? theme.color.sage : theme.color.honeyDark}`,
  background: active ? theme.color.sageLight : theme.color.parchment,
  color: theme.color.text,
  fontFamily: theme.font.family,
  fontSize: theme.font.smallSize,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  cursor: 'pointer',
});

/** UI round 2 (#6383805035): the tab bodies — PLANTING groups flowers by
 *  bloom season (derived from the engine's bloom data); EQUIPMENT is the
 *  bee-care structures + the nature structures that live with them. */
export function Palette() {
  const [tab, setTab] = useState<'planting' | 'equipment'>('planting');
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
      // UI round 2: chips show CLOSE-UP bloom art (identifiable at a glance)
      t['plant:' + p.id] = renderVoxelCloseUp(p.parts) ?? renderVoxelThumb(p.parts, p.height);
    }
    for (const st of STRUCTURES) {
      const h = Math.max(...st.parts.map((p) => p.offset[1] + p.size[1] / 2));
      t['structure:' + st.id] = renderVoxelThumb(st.parts, h);
    }
    setThumbs(t);
  }, []);
  // season-grouped planting tab: derived from the engine's bloom windows
  // (one source — plantingsBySeason reads PLANTS[].bloom directly)
  const seasonGroups = useMemo(
    () =>
      plantingsBySeason().map((g) => ({
        season: g.season,
        entries: g.plants.map((p) => ({
          key: 'plant:' + p.id,
          name: p.name,
          kind: 'plant' as const,
          id: p.id,
          thumb: thumbs['plant:' + p.id] ?? null,
          swatch: p.parts[p.parts.length - 1].color,
        })),
      })),
    [thumbs],
  );
  // the nature structures that belong WITH planting (hedge/wildcorner/bush):
  // one block at the end of the planting tab, not interleaved
  const natureEntries: PaletteEntry[] = useMemo(
    () =>
      STRUCTURES.filter((s) => s.id === 'hedge' || s.id === 'wildcorner' || s.id === 'bush').map((s) => ({
        key: 'structure:' + s.id,
        name: s.name,
        kind: 'structure' as const,
        id: s.id,
        thumb: thumbs['structure:' + s.id] ?? null,
        swatch: s.parts[s.parts.length - 1].color,
      })),
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
    // tooltip: name + BLOOM SEASONS derived from the engine's bloom data
    // (one source: bloomSeasonsLabel reads PLANTS[].bloom) — structures
    // keep their plain tooltip
    const plantDef = e.kind === 'plant' ? PLANTS.find((p) => p.id === e.id) : undefined;
    const badge = plantDef ? seasonBadge(plantDef) : null;
    const tooltip = !enabled
      ? 'keep tending the meadow to unlock this'
      : plantDef
        ? `${e.name} — ${bloomSeasonsLabel(plantDef)}`
        : e.name;
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
        title={tooltip}
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
        <span style={{ fontSize: theme.font.smallSize, color: theme.color.textSoft, whiteSpace: 'nowrap' }}>
          {e.name}
          {badge && (
            <span
              data-season-badge={e.key}
              style={{ marginLeft: 3, fontSize: 9, opacity: 0.8, color: theme.color.textFaint }}
            >
              {badge}
            </span>
          )}
        </span>
      </button>
    );
  };
  return (
    <div
      data-palette-dock="bottom"
      style={{
        // UI round 2 (#6383805035): BOTTOM dock with two tabs — the left
        // dock overlapped the top-left scene info and read unclear. The
        // dock is a compact bottom bar: tabs on the left edge, the active
        // tab's content in a wrapped row, the placement-mode toggle at
        // the far right, separated by a divider. The meadow above stays
        // fully visible; the bar scrolls horizontally only if the tab
        // outgrows the viewport.
        position: 'absolute',
        bottom: 16,
        // UI round 3 (#6383867199): the dock sits in the space BETWEEN the
        // onboarding panel (bottom-left) and the corner controls
        // (bottom-right, ~420px of lane incl. the journal row below the
        // buttons) — a reserved RIGHT GUTTER, width-independent: at any
        // viewport the controls' lane is never covered. Reserving the same
        // gutter on the left keeps the dock optically centered in the
        // remaining space instead of hugging the left.
        // #6384003544: PINNED LEFT — the left edge is invariant across tab
        // switches (the old margin:auto re-centered per content width); only
        // the content width varies. The right edge still yields to the
        // corner controls' lane.
        left: 16,
        right: 460,
        width: 'fit-content',
        maxWidth: 'calc(100vw - 492px)',
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        padding: '8px 12px',
        borderRadius: theme.border.radiusPanel,
        background: theme.color.panel,
        border: `${theme.border.chunk}px solid ${theme.color.honey}`,
        boxShadow: theme.border.shadowPanel,
        fontFamily: theme.font.family,
      }}
    >
      {/* the tab flip: PLANTING vs EQUIPMENT */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <button
          data-palette-tab="planting"
          onClick={() => setTab('planting')}
          style={tabStyle(tab === 'planting')}
          aria-pressed={tab === 'planting'}
          title="Flowers & nature — grouped by bloom season"
        >
          🌿 Planting
        </button>
        <button
          data-palette-tab="equipment"
          onClick={() => setTab('equipment')}
          style={tabStyle(tab === 'equipment')}
          aria-pressed={tab === 'equipment'}
          title="Bee housing & care"
        >
          🐝 Equipment
        </button>
      </div>
      {/* the tab body */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflowX: 'auto',
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        {tab === 'planting' ? (
          <>
            {seasonGroups.map((g) => (
              <div
                key={g.season}
                style={sectionStyle('rgba(220, 236, 194, 0.35)')}
                data-palette-section={'season:' + g.season}
              >
                <span style={sectionLabelStyle} data-section={g.season}>
                  {g.season}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {g.entries.map((e) => renderEntry(e))}
                </div>
              </div>
            ))}
            <div
              style={sectionStyle('rgba(220, 236, 194, 0.22)')}
              data-palette-section="nature"
            >
              <span style={sectionLabelStyle} data-section="nature">
                nature
              </span>
              <div style={{ display: 'flex', gap: 6 }}>{natureEntries.map(renderEntry)}</div>
            </div>
          </>
        ) : (
          <div style={sectionStyle('rgba(255, 233, 184, 0.35)')} data-palette-section="beecare">
            <span style={sectionLabelStyle} data-section="beecare">
              🐝 Bee care
            </span>
            <div style={{ display: 'flex', gap: 6 }}>{beeCare.map(renderEntry)}</div>
          </div>
        )}
      </div>
      {/* the placement-mode toggle: separated at the far right (a mode,
          not an item) */}
      <div
        data-palette-section="mode"
        style={{
          borderLeft: `1px solid ${theme.color.honeyDark}44`,
          paddingLeft: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: theme.font.smallSize,
          color: theme.color.textSoft,
          whiteSpace: 'nowrap',
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