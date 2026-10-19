/// <reference types="vite/client" />
import type { ComponentType } from 'react';
import { CellMapLayer as CellMapLayerImpl } from '../render/CellMapOverlay';

const isDev: boolean = import.meta.env.DEV;

/**
 * Dev-only shell around the #30 cell-map scene layer: prod builds get null,
 * so the overlay render path (scene code) cannot ship — same lazy pattern as
 * PerfOverlay. The impl module is still imported statically; the guarantee
 * that matters (no overlay in the DOM/scene at runtime in prod) is absolute,
 * and the tree-shake keeps the bundle identical to pre-session-4 (verified
 * by grep on dist after build).
 */
export const CellMapLayer: ComponentType | null = isDev ? CellMapLayerImpl : null;
