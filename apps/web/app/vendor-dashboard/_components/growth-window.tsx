'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { GrowthWindow } from '@/lib/analytics-growing';

/**
 * 🪟 THE ONE WINDOW (Shop › Analytics, owner-approved 6 Nov 2026 — "Analytics, growing"): Last 30 days · Last 12 months,
 * picked once under the pinned row, and EVERY windowed number on the page follows it — the pinned row's three figures
 * included. A context, because the pinned row (`ShopSegments`) and the page body are siblings; both windows are read on
 * the server, so a pick swaps them here with no refetch.
 *
 * Absent (every other Shop page) → `null`, and nothing changes.
 */
type Ctx = { window: GrowthWindow; setWindow: (w: GrowthWindow) => void };
const GrowthWindowCtx = createContext<Ctx | null>(null);

export function useGrowthWindow(): Ctx | null {
  return useContext(GrowthWindowCtx);
}

export function GrowthWindowScope({ initial, children }: { initial: GrowthWindow; children: ReactNode }) {
  const [win, setWin] = useState<GrowthWindow>(initial);
  return <GrowthWindowCtx.Provider value={{ window: win, setWindow: setWin }}>{children}</GrowthWindowCtx.Provider>;
}
