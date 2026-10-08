'use client';

import { PillButton, PillTrack } from '@/app/_components/pill-track';
import type { MomentumMode } from './momentum-card';

/**
 * Daily / Monthly / Annual window toggle — lifted out of MomentumCard so it
 * can sit in the shared filter row alongside the service-scope selector.
 * Controlled: the parent owns `mode` state (needed to also drive MomentumCard).
 */
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

  return (
    <PillTrack role="tablist" aria-label="Momentum window">
      {isFull && (
        <ToggleButton label="Daily" value="day" active={effectiveMode === 'day'} onSelect={onSelect} />
      )}
      <ToggleButton label="Monthly" value="month" active={effectiveMode === 'month'} onSelect={onSelect} />
      <ToggleButton label="Annual" value="year" active={effectiveMode === 'year'} onSelect={onSelect} />
    </PillTrack>
  );
}

function ToggleButton({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: MomentumMode;
  active: boolean;
  onSelect: (value: MomentumMode) => void;
}) {
  return (
    <PillButton on={active} onClick={() => onSelect(value)} role="tab" aria-selected={active} className="px-3.5">
      {label}
    </PillButton>
  );
}
