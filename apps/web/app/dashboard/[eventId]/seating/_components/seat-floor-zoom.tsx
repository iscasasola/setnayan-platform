'use client';

import { Minus, Plus, Scan } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import styles from './seat-floor-zoom.module.css';

/**
 * 🔍 THE ZOOM IS IN THE THUMB ROW (owner 2026-11-20, "Yes, your picks"; drawing § 5 "Zoom stack at the right edge → the
 * pill in the thumb row (fit · − · +)" and § 2 "search · (zoom on 2D) · look · Show and sort"). On Guests › Seats › 2D
 * the stack that stood at the floor's right edge leaves the plan, so nothing covers it; these three presses sit in the
 * thumb row as one pill, in the middle of the row. Each is 44 px (the row's own seat sizing, `thumb-row.module.css`
 * `.nodeRound`). The handlers are the plan's own (`fitView` · `zoomAround`) — there is no second zoom.
 * Outside Guests the plan keeps its shipped stack (`zoomStack`). 🔒 the-floor-wears-its-chrome.test.ts
 */
export function SeatZoomPill({ onFit, onOut, onIn }: { onFit: () => void; onOut: () => void; onIn: () => void }) {
  return (
    <span data-seat-plan-zoom="" className={styles.pill}>
      {/* Fit wears corner brackets, never ⤢ — ⤢ reads as "full screen", and the plan has none (owner 2026-10-30). */}
      <ActionButton tone="neutral" iconOnly icon={Scan} label="Fit the room" onClick={onFit} data-seat-zoom="fit" />
      <ActionButton tone="neutral" iconOnly icon={Minus} label="Zoom out" onClick={onOut} data-seat-zoom="out" />
      <ActionButton tone="neutral" iconOnly icon={Plus} label="Zoom in" onClick={onIn} data-seat-zoom="in" />
    </span>
  );
}
