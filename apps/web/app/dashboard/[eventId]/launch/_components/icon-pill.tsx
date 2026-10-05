import type { ReactNode } from 'react';

/**
 * 💊 THE SHARED ICON PILL — Keynote's toolbar rule, in our own buttons (owner
 * 2026-10-05, *"What I want is the shared pill style concept"*; design
 * `prototypes/maker_keynote_chrome_2026-10-05_fable.md`, "The pill system"):
 *
 *   · a LONE control is its own pill — ✕ Exit (red), ✓ Apply (green);
 *   · RELATED controls share ONE pill, a hairline between them — [ ↺ Undo | 👁 Preview ];
 *   · the active one is filled (the button's own `aria-expanded` / `aria-pressed` fill).
 *
 * The ONE wrapper wherever the Maker groups icons: `tone` says which pill it is,
 * and the buttons inside keep their own 44 × 44 shape (`MAKER_BAR_ICON`). No
 * family colour; never Apple purple.
 */
export type IconPillTone = 'shared' | 'exit' | 'apply';

const PILL: Record<IconPillTone, string> = {
  /* A soft grey stadium, a hairline between its buttons. */
  shared: 'inline-flex shrink-0 items-center rounded-full bg-ink/[0.06] divide-x divide-ink/10',
  /* A lone control: the button IS the pill — `ICON_PILL_EXIT` (red), `MAKER_BAR_APPLY` (green). */
  exit: 'inline-flex shrink-0 items-center rounded-full',
  apply: 'inline-flex shrink-0 items-center rounded-full',
};

/** ✕ Exit's own pill — red, the one way out of the Maker (owner: *"exit on the left side is red with an X icon"*). */
export const ICON_PILL_EXIT =
  'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#B3261E] text-cream transition-colors duration-sn-control ease-sn hover:bg-[#9A1F19]';

export function IconPill({
  tone = 'shared',
  label,
  className = '',
  children,
}: {
  tone?: IconPillTone;
  /** The group's accessible name ("Undo and preview"). */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span role={tone === 'shared' ? 'group' : undefined} aria-label={label} data-icon-pill={tone} className={`${PILL[tone]} ${className}`}>
      {children}
    </span>
  );
}
