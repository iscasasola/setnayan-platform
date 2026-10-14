import { figureDataUri, figurePeopleSvg, roleFigureDataUri, type FigurePerson, type FigurePick } from '@/lib/role-figure';

/**
 * THE ILLUSTRATED PERSON IN A ROLE'S COLOURS (owner 2026-09-27, "an ILLUSTRATED person in the exact role colours —
 * not AI, exact colour, free"; redrawn 2026-10-14, DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"). ONE component,
 * TWO places: the guest's dress code (server-rendered) and the Studio's Attire blocks (the Mood Board's lazy chunk).
 * The drawing is `lib/role-figure.ts` over the artwork seam `lib/attire-figures.ts`, shown as an image — no markup is
 * injected into the page. Nothing to wear (no valid colour) → nothing drawn.
 *
 * Either the role's colours (`roleKey` + `hexes`, and its `picks` — who and what each wears) or the `people`
 * themselves (the Studio, where "Not said yet" is the dotted silhouette).
 *
 * No hooks, no state.
 */
export function RoleFigure({
  roleKey,
  hexes = [],
  meaning = 'outfit',
  picks = null,
  people = null,
  className = 'h-16 w-auto',
}: {
  /** A Mood Board `PaletteKey`, a `custom:<slug>`, or a guest-list role. */
  roleKey: string;
  hexes?: readonly string[];
  /** `options` = the guests: a colour each, never combined. */
  meaning?: 'outfit' | 'options';
  /** Who the role's people are and what each wears (`picksOf`, `lib/attire-rows.ts`). */
  picks?: readonly FigurePick[] | null;
  /** The people, drawn exactly — overrides the rest. */
  people?: readonly FigurePerson[] | null;
  className?: string;
}) {
  const src = people ? figureDataUri(figurePeopleSvg(people)) : roleFigureDataUri(roleKey, hexes, meaning, picks);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI drawn from the role's own colours
    <img src={src} alt="" aria-hidden className={`shrink-0 ${className}`} data-role-figure={roleKey} />
  );
}
