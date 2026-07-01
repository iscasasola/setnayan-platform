'use client';

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
    <div
      className="inline-flex rounded-full border p-0.5"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      role="tablist"
      aria-label="Momentum window"
    >
      {isFull && (
        <ToggleButton label="Daily" value="day" active={effectiveMode === 'day'} onSelect={onSelect} />
      )}
      <ToggleButton label="Monthly" value="month" active={effectiveMode === 'month'} onSelect={onSelect} />
      <ToggleButton label="Annual" value="year" active={effectiveMode === 'year'} onSelect={onSelect} />
    </div>
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
    <button
      type="button"
      onClick={() => onSelect(value)}
      role="tab"
      aria-selected={active}
      className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
      style={
        active
          ? { background: 'var(--m-ink)', color: 'var(--m-paper)' }
          : { color: 'var(--m-slate)' }
      }
    >
      {label}
    </button>
  );
}
