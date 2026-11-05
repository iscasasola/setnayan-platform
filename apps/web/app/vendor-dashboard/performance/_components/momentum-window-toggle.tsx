'use client';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { MomentumMode } from './momentum-card';

/**
 * Daily / Monthly / Annual — the window the Momentum card and "Your business" read. ONE dropdown (owner 2026-10-30
 * "ONE SELECTOR FOR EVERY PAGE", Q1 "the segmented rows become the same ▾"; house rule "every choice is one
 * dropdown"): the shared `PickMenu`, never a pill row. Was a `PillTrack` (2026-10-08). Controlled: the parent owns
 * `mode` (it also drives MomentumCard), so a pick swaps the pre-rendered window instantly — no refetch.
 * 🔒 performance/the-pickers-are-one-dropdown.test.ts
 */
const WINDOWS: ReadonlyArray<{ key: MomentumMode; label: string }> = [
  { key: 'day', label: 'Daily' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Annual' },
];

export function MomentumWindowToggle({
  mode,
  isFull,
  onSelect,
}: {
  mode: MomentumMode;
  /** 'basic' (Solo) hides the Daily option. */
  isFull: boolean;
  onSelect: (value: MomentumMode) => void;
}) {
  const effectiveMode: MomentumMode = !isFull && mode === 'day' ? 'month' : mode;
  const options = WINDOWS.filter((w) => isFull || w.key !== 'day');
  return (
    <PickMenu
      label="Momentum window"
      value={effectiveMode}
      options={options.map((w) => ({ key: w.key, label: w.label }))}
      compact
      className="!min-h-11"
      dataAttr="data-momentum-window"
      onPick={(key) => {
        const hit = options.find((w) => w.key === key);
        if (hit) onSelect(hit.key);
      }}
    />
  );
}
