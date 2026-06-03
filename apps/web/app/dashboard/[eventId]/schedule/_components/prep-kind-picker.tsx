'use client';

// ============================================================================
// PrepKindPicker — the shared Task / Meeting / Payment segmented control used
// by BOTH the couple add control (prep-item-controls.tsx) and the vendor add
// control (vendor-dashboard/bookings/_components/vendor-prep-add.tsx) for the
// typed Preparation items feature (2026-06-03).
//
// Typed items let a couple OR a booked vendor place a generic task, a meeting
// schedule, or a payment schedule on the Preparation agenda. This control just
// drives the `kind` the parent form submits + toggles which fields show; the
// server actions stamp `kind` + (for payments) `amount_php`. Clean Editorial
// tokens only (cream / ink / mulberry). Kept here (couple folder) and imported
// across the boundary so there's a single source of truth for the picker.
// ============================================================================

import { ListPlus, Users, Wallet, type LucideIcon } from 'lucide-react';

export type PrepKind = 'task' | 'meeting' | 'payment';

const OPTIONS: ReadonlyArray<{ value: PrepKind; label: string; Icon: LucideIcon }> = [
  { value: 'task', label: 'Task', Icon: ListPlus },
  { value: 'meeting', label: 'Meeting', Icon: Users },
  { value: 'payment', label: 'Payment', Icon: Wallet },
];

export function PrepKindPicker({
  value,
  onChange,
  disabled,
}: {
  value: PrepKind;
  onChange: (next: PrepKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-ink">Type</span>
      <div
        role="radiogroup"
        aria-label="Item type"
        className="grid grid-cols-3 gap-1.5 rounded-xl border border-ink/10 bg-ink/[0.03] p-1"
      >
        {OPTIONS.map(({ value: v, label, Icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(v)}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-50 ${
                active
                  ? 'bg-mulberry text-cream shadow-sm'
                  : 'text-ink/70 hover:bg-mulberry/5 hover:text-mulberry'
              }`}
            >
              <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
