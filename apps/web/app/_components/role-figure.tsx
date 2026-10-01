import { roleFigureDataUri } from '@/lib/role-figure';

/**
 * THE ILLUSTRATED PERSON IN A ROLE'S COLOURS (owner 2026-09-27, "an ILLUSTRATED
 * person in the exact role colours — not AI, exact colour, free"). The picture
 * is drawn by `lib/role-figure.ts` — the reception scene's own gown and suit
 * figures — and shown as an image, so no markup is injected into the page.
 * Nothing to wear (no valid colour) → nothing drawn.
 *
 * No hooks, no state: the Event Hub's server-rendered dress-code scene and the
 * Mood Board's client palette mount the same component.
 */
export function RoleFigure({
  roleKey,
  hexes,
  meaning = 'outfit',
  className = 'h-12 w-auto',
}: {
  /** A Mood Board `PaletteKey`, a `custom:<slug>`, or a guest-list role. */
  roleKey: string;
  hexes: readonly string[];
  /** `options` = the guests: one person per colour, never combined. */
  meaning?: 'outfit' | 'options';
  className?: string;
}) {
  const src = roleFigureDataUri(roleKey, hexes, meaning);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI drawn from the role's own colours
    <img src={src} alt="" aria-hidden className={`shrink-0 ${className}`} data-role-figure={roleKey} />
  );
}
