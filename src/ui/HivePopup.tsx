import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { usePlacementStore } from '../render/placementStore';
import { STRUCTURE_BY_ID } from '../data/structures';
import { combReady } from '../engine/honey';
import { combStateLine } from '../data/honey';
import { colonyReadback } from '../engine/lifecycle';
import { seasonProgress } from '../engine/seasonClock';
import { theme, headingStyle } from './theme';

/**
 * #36 hive popup (user-approved design): a small popup anchored over the
 * hive on click — the harvest is a MOMENT AT THE HIVE, not a menu trip.
 *
 * One shared harvest path: the button calls the store's harvestHoney —
 * the SAME action the P panel trigger uses (the popup is only UI over it;
 * the dip/settle ceremony + jar toast + fact ride along with the action).
 *
 * Position: screen-projected over the hive (fixed to the viewport — the
 * off-viewport corner-wrapper lesson). The info panel stays reachable
 * via the "more" link. Never a disabled-gray failure read: a not-yet-full
 * comb shows the gentle "the bees are still working" line.
 */
export function HivePopup() {
  const hivePopup = usePlacementStore((s) => s.hivePopup);
  const structures = usePlacementStore((s) => s.structures);
  const hiveCombs = usePlacementStore((s) => s.hiveCombs);
  const honeyJars = usePlacementStore((s) => s.honeyJars);
  const [screen, setScreen] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);

  const hive = structures.find((st) => st.id === hivePopup && st.structureId === 'hive');

  useEffect(() => {
    if (!hive) return;
    const th = (window as unknown as {
      __meadowlight?: { __three?: { camera?: THREE.PerspectiveCamera; gl?: { domElement: HTMLCanvasElement } } };
    }).__meadowlight?.__three;
    if (!th?.camera || !th?.gl) return;
    const cam = th.camera;
    const canvas = th.gl.domElement;
    // project the hive's TOP (a fixed world point just above the hive) —
    // the popup anchors there; per #36 round-5 the anchor is clamped to
    // the viewport with voxel-chrome margins, because a world-unit offset
    // (the old +2.6u) perspective-blows for near hives
    const v = new THREE.Vector3(hive.position[0], hive.position[1] + 2.4, hive.position[2]);
    const project = () => {
      v.set(hive.position[0], hive.position[1] + 2.4, hive.position[2]);
      const p = v.clone().project(cam);
      const rect = canvas.getBoundingClientRect();
      // #36 polish (eyeball verdict): raise the anchor so the popup sits
      // clearly ABOVE the hive — the full silhouette (and the bees'
      // comings-and-goings at the entrance) stays visible under it. The
      // lift is the hive's MEASURED screen height: project the hive's top
      // AND base, take the pixel span, clear it plus headroom.
      const topYpx = ((-p.y + 1) / 2) * rect.height;
      // #36 zoom-out residual: the lift must be CAMERA-INDEPENDENT. The
      // hive's projected span shrinks with distance while the popup's
      // pixel height is constant — a span-based lift collapsed at full
      // zoom-out and the popup covered the hive. The lift is now
      // (popup's own rendered height + 20px clearance), floored below
      // by the hive's span for zoomed-in views: the popup's BOTTOM edge
      // clears the hive's projected top at every zoom level.
      const popupEl = document.querySelector('[data-hive-popup]') as HTMLElement | null;
      const popupPx = popupEl ? popupEl.offsetHeight : 150;
      // the x clamp must account for the popup's FULL rendered width
      // (content-box width + chunky borders + padding) — a fixed 135
      // margin under-clamped and the panel could overflow the edge
      const popupW = popupEl ? popupEl.offsetWidth : 290;
      const halfW = popupW / 2;
      const hiveSpan = (() => {
        const b = v.clone().set(hive.position[0], hive.position[1], hive.position[2]).project(cam);
        return Math.max(0, topYpx - ((-b.y + 1) / 2) * rect.height);
      })();
      const lift = Math.max(popupPx + 20, hiveSpan + 20);
      // clamp keeps the whole popup in-viewport with chrome margins —
      // including far hives whose projection lands near the fold
      const x = THREE.MathUtils.clamp(((p.x + 1) / 2) * rect.width, halfW + 10, rect.width - halfW - 10);
      const y = THREE.MathUtils.clamp(topYpx - lift, 90, rect.height - popupPx - 12);
      setScreen({ x, y });
      rafRef.current = requestAnimationFrame(project);
    };
    rafRef.current = requestAnimationFrame(project);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hive]);

  if (!hive || !screen) return null;
  const fill = hiveCombs[hive.id] ?? 0;
  // ONE shared predicate: the same combReady the harvest path uses
  // (the isDaylight lesson — no second definition of full)
  const ready = combReady(fill);
  const name = STRUCTURE_BY_ID.hive?.name ?? 'Hive';
  // the ONE shared state line (src/data/honey) — the info panel's hive
  // hint renders the same strings, so both surfaces always agree
  const fillLine = combStateLine(fill);
  // U3: the colony-breath line — ONE shared source (engine/lifecycle);
  // the popup, the info panel, and the P inspector all render this exact
  // string set, so no surface can ever disagree (or invent a decline read)
  const colony = colonyReadback(usePlacementStore.getState().season, seasonProgress());

  // the projection is the SINGLE anchor source (raised + clamped); the
  // style layer must not apply a second offset
  const panelStyle: CSSProperties = {
    position: 'fixed',
    left: Math.max(10, screen.x - 144),
    top: Math.max(10, screen.y),
    width: 250,
    padding: theme.spacing.panelPadding,
    borderRadius: theme.border.radiusPanel,
    background: theme.color.panelSolid,
    border: `${theme.border.chunky}px solid ${theme.color.honey}`,
    boxShadow: theme.border.shadowPanel,
    color: theme.color.text,
    fontFamily: theme.font.family,
    zIndex: 45,
  };
  const btnStyle = (active: boolean): CSSProperties => ({
    marginTop: 8,
    padding: '5px 10px',
    borderRadius: theme.border.radius,
    border: `${theme.border.chunk}px solid ${active ? theme.color.clay : theme.color.honeyDark}`,
    background: active ? theme.color.honeyActive : theme.color.parchmentLight,
    color: theme.color.text,
    fontFamily: theme.font.family,
    fontSize: theme.font.smallSize,
    cursor: 'pointer',
  });

  return (
    <div data-hive-popup style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={headingStyle(theme.font.bodySize)}>{'\u{1F41D}'} {name}</strong>
        <button
          data-hive-popup-close
          onClick={() => usePlacementStore.getState().closeHivePopup()}
          style={{ border: 'none', background: 'transparent', color: theme.color.textSoft, fontSize: 15, cursor: 'pointer', fontFamily: theme.font.family }}
        >
          {'\u2715'}
        </button>
      </div>
      <div style={{ fontSize: theme.font.smallSize, lineHeight: 1.4, marginTop: 4 }}>{fillLine}</div>
      <div style={{ fontSize: theme.font.smallSize, lineHeight: 1.4, marginTop: 4 }}>{colony.line}</div>
      {ready ? (
        <button
          data-hive-popup-harvest
          onClick={() => {
            // ONE shared path: same harvestHoney the P panel calls —
            // the dip/settle ceremony + jar toast ride along
            usePlacementStore.getState().harvestHoney(hive.id);
            usePlacementStore.getState().closeHivePopup();
          }}
          style={btnStyle(true)}
        >
          {'\u{1F36B}'} bring a jar in
        </button>
      ) : (
        <div style={{ fontSize: theme.font.smallSize, opacity: 0.75, marginTop: 8 }}>
          the bees are still working {'\u{1F42B}'}
        </div>
      )}
      <button
        data-hive-popup-more
        onClick={() => {
          usePlacementStore.getState().closeHivePopup();
          usePlacementStore.getState().openNotebook({ kind: 'structure', id: 'hive', instanceId: hive.id });
        }}
        style={{ ...btnStyle(false), marginLeft: ready ? 6 : 0 }}
      >
        more about the hive
      </button>
      {honeyJars > 0 && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          {honeyJars} jar{honeyJars === 1 ? '' : 's'} of honey brought in so far
        </div>
      )}
    </div>
  );
}
