import type { ReactNode } from 'react';

/**
 * 💊 THE SHARED ICON PILL — Keynote's toolbar rule, in our own buttons (owner
 * 2026-10-05, *"What I want is the shared pill style concept"*; design
 * `prototypes/maker_keynote_chrome_2026-10-05_fable.md`, "The pill system"):
 *
 *   · a LONE control is its own pill — ✓ Apply (green) (✕ Exit, red, was one — dropped 2026-10-30, the app's nav
 *     is the way out of the Hub);
 *   · RELATED controls share ONE pill, a hairline between them — [ ↺ Undo | 👁 Preview ];
 *   · the active one is filled (the button's own `aria-expanded` / `aria-pressed` fill).
 *
 * The ONE wrapper wherever the Maker groups icons: `tone` says which pill it is,
 * and the buttons inside keep their own 44 × 44 shape (`MAKER_BAR_ICON`). No
 * family colour; never Apple purple.
 *
 * 🖥 PHONE ONLY THIS ROUND (< lg, the lower third's breakpoint): a desktop keeps
 * its bar as it was — no pill ground, ‹ Exit, the wine ✓: every phone look is a
 * `max-lg:` class, so no stylesheet order can leak it onto a desktop.
 */
export type IconPillTone = 'shared' | 'apply';

const PILL: Record<IconPillTone, string> = {
  /* A soft grey stadium, a hairline between its buttons. */
  shared: 'inline-flex shrink-0 items-center rounded-full max-lg:bg-ink/[0.06] max-lg:divide-x max-lg:divide-ink/10',
  /* A lone control: the button IS the pill — `MAKER_BAR_APPLY` (green). */
  apply: 'inline-flex shrink-0 items-center rounded-full',
};

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
