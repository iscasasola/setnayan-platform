import type { ReactNode } from 'react';

import type { EntourageGroup } from '@/lib/entourage';
import { marchPlaceLine, marchPlaceOf } from '@/lib/march-place';

import { meAnchorOf } from './entourage-me-anchor';

/**
 * 🫵 "SO THEY CAN SEE WHERE THEY ARE" — the viewer's own name, marked, in every entourage look.
 *
 * ⚖ Owner 2026-10-17, verbatim: *"if they are at the wedding march, we want to highlight them on the wedding march
 * so they can see where they are."* The March already lifted the signed-in member's line; On the axis (the default —
 * the owner's own event) and Lines marked nobody, so a sponsor or a parent opening their invitation could not find
 * themselves among 80 names. One mark, drawn by every look from here:
 *
 *   · THEIR NAME ONLY — a soft veil wash and a gold underline on the name, never the partner beside it;
 *   · a small gold "You" after it;
 *   · under the heading, "Your place is marked." — and, for someone who walks, where (`marchPlaceLine`, the SAME
 *     sentence Me reads under "You are …": "You walk 5th, with Tito Ben, after …");
 *   · every place they print — a bridesmaid who is also a candle sponsor is marked under both;
 *   · the FIRST mark carries `<section id>-me` (`#site-entourage-me` on the event page), the one place Me's
 *     "See where you are ↓" (`see-where-you-are.tsx`) goes to.
 *
 * 🔒 WHO IS MARKED: only the id the page was handed as `myGuestId` — the guest tree's own signed guest. A stranger,
 * a host and the Maker's canvas (See as · View as a role — a stand-in, never a real name) pass none, and so draw
 * nothing: no wash, no "You", no heading line, no anchor. Held by
 * `lib/the-guest-sees-their-place.test.ts`, on every registered entourage style.
 *
 * Presentational and pure — nothing here decides who is in the entourage (`lib/entourage.ts` does).
 */

/** The heading's line, said only when a mark is drawn. */
export const YOUR_PLACE_IS_MARKED = 'Your place is marked.';

/** Who is marked in this drawing, and which of their marks carries the anchor. */
export type EntourageMe = {
  id: string;
  /** The anchor id the first mark carries. */
  anchor: string;
};

/** Does any of these people carry the viewer's id? */
export function holdsMe(people: ReadonlyArray<{ id: string | null } | null>, me: EntourageMe | null): boolean {
  return me !== null && people.some((p) => p !== null && p.id === me.id);
}

/**
 * The viewer, for a drawing — or null when nobody on it is them (a stranger, an unknown id, a preview's stand-in,
 * or a guest who is not in the entourage). `drawn` is everyone the look actually draws, so a guest beyond a
 * preview's cut is not told "Your place is marked." about a place that is not on the page.
 */
export function entourageMeOf(
  myGuestId: string | null | undefined,
  drawn: ReadonlyArray<{ id: string | null } | null>,
  sectionId: string | undefined,
): EntourageMe | null {
  if (!myGuestId) return null;
  const me = { id: myGuestId, anchor: meAnchorOf(sectionId) };
  return holdsMe(drawn, me) ? me : null;
}

/** "You", after their name. Small caps in the gild, like every role word on the page — no box (nothing to press). */
export function YouTag() {
  return (
    <span data-you-tag="" className="ml-1.5 whitespace-nowrap font-sans text-xs uppercase not-italic tracking-[0.16em] text-gild">
      You
    </span>
  );
}

/**
 * THEIR NAME, MARKED — the wash and the underline on the name, then "You". `anchor`: this is their first place on
 * the page, the one "See where you are ↓" lands on (`scroll-mt` keeps it clear of the page's top bar).
 */
export function MineName({ children, anchor }: { children: ReactNode; anchor?: string | null }) {
  return (
    <span
      data-entourage-me=""
      id={anchor ?? undefined}
      className="scroll-mt-28 rounded-sm bg-veil/60 px-1 box-decoration-clone"
    >
      <span className="underline decoration-gild decoration-2 underline-offset-4">{children}</span>
      <YouTag />
    </span>
  );
}

/**
 * Hands out the anchor ONCE, in drawing order: the first of the viewer's marks carries it, the rest do not (an id
 * is unique on a page). Make one per drawing.
 */
export function anchorOnce(me: EntourageMe | null): () => string | null {
  let given = false;
  return () => {
    if (!me || given) return null;
    given = true;
    return me.anchor;
  };
}

/**
 * "Your place is marked." — and, for someone who walks, where: the shipped `marchPlaceLine` from the shipped
 * `marchPlaceOf`, so the entourage and Me can never say two different places.
 */
export function YourPlaceLine({
  me,
  groups,
  walks = true,
  className = 'text-sm text-ink/65',
}: {
  me: EntourageMe | null;
  groups: readonly EntourageGroup[];
  /** False after the day (Post Event): nobody is about to walk. */
  walks?: boolean;
  className?: string;
}) {
  if (!me) return null;
  const place = walks ? marchPlaceOf(groups, me.id) : null;
  return (
    <p className={className} data-entourage-you="">
      {YOUR_PLACE_IS_MARKED}
      {place ? ` ${marchPlaceLine(place)}` : ''}
    </p>
  );
}
