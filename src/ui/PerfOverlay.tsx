/// <reference types="vite/client" />
import type { ComponentType } from 'react';
import { PerfOverlay as PerfOverlayImpl } from './PerfOverlayImpl';
const isDev: boolean = import.meta.env.DEV;
export const PerfOverlay: ComponentType | null = isDev ? PerfOverlayImpl : null;
