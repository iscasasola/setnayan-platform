'use client';

import { useEffect, useRef, useState } from 'react';
import {
  pickRosterColumn,
  resolveRosterColumns,
  rosterSlotCount,
  type RosterColumn,
} from '@/lib/roster-columns';

/**
 * The Guest list's column slots on THIS device (owner 2026-09-30: "number of
 * columns to show depends on the width of the screen" · the picks are
 * "remembered per device"). The rules are `lib/roster-columns.ts`; this only
 * measures the list, remembers the picks, and hands back what to draw.
 *
 *   · `fixedSlots` — the phone: exactly one slot beside the name.
 *   · otherwise the list's own width decides, re-measured on every resize.
 *
 * Browser storage can be absent or refuse (a private window, blocked site
 * data), so every read and write is inside try/catch and the defaults stand in.
 * Before the first measurement the list draws 4 slots — the 1280px answer — so
 * the server's HTML and the first client paint agree.
 */
export function useRosterColumns({
  storageKey,
  defaults,
  fixedSlots,
}: {
  storageKey: string;
  defaults: readonly RosterColumn[];
  fixedSlots?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [remembered, setRemembered] = useState<unknown[] | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) setRemembered(parsed);
    } catch {
      /* No storage here — the defaults stand. */
    }
  }, [storageKey]);

  useEffect(() => {
    if (fixedSlots) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedSlots]);

  const slots = fixedSlots ?? (width ? rosterSlotCount(width, defaults.length) : Math.min(4, defaults.length));
  const columns = resolveRosterColumns(remembered, defaults, slots);

  const pick = (slot: number, column: RosterColumn) => {
    const next = pickRosterColumn(columns, slot, column);
    setRemembered(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Not remembered on this device — it still applies now. */
    }
  };

  return { ref, columns, pick };
}
