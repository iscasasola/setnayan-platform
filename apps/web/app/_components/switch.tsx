'use client';

/**
 * 🔘 THE SWITCH — one on/off control for a fact that is simply on or off
 * (owner 2026-10-07, Event Details: *"accordion that opens and has toggles for
 * toggle based"*). Extracted from `PlanMyselfSwitch`'s anatomy (`role="switch"`,
 * a 44 × 24 track, a cream knob) and drawn in the ok tone (`--color-ok`, as
 * built #2B744A) when on. It only DRAWS: the caller owns the state and the
 * save (`lib/optimistic-switch.ts` — flip first, save behind).
 *
 * A two-value fact only. A choice of three or more is one dropdown
 * (`PickMenu`) — owner 2026-09-28, "any set of choices is a dropdown".
 */
export function Switch({
  on,
  onChange,
  label,
  disabled = false,
  data,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Its accessible name — the row's own label. */
  label: string;
  disabled?: boolean;
  data?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      data-switch={data}
      className={`relative h-6 min-h-0 w-11 shrink-0 rounded-full transition-colors duration-150 after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:cursor-default disabled:opacity-60 ${
        on ? 'bg-[var(--color-ok,#2B744A)]' : 'bg-ink/15'
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-transform duration-150 ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
