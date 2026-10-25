'use client';

import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { SITE_ENTOURAGE_ME } from './entourage-me-anchor';

/**
 * 🫵 "SEE WHERE YOU ARE ↓" — under Me's / the Welcome's "You are <role>", one quiet link to the viewer's own marked
 * name in the entourage (owner 2026-10-17: *"so they can see where they are"*; the mark is `entourage-you.tsx`).
 *
 * 🔑 DRAWN ONLY WHEN THE PLACE IS ON THE PAGE. The link appears after the page has loaded, and only if the page
 * holds `#site-entourage-me` — which the entourage draws only for a recognised guest who is in it, on a stage that
 * shows it. A link to an id that is not there fails silently (it scrolls nowhere), so a stranger, a host, a guest who
 * is not in the entourage, a stage without the entourage and the Maker's canvas (no mark there) all get no link.
 *
 * 🔒 NO AUTO-SCROLL. Nothing moves until they tap. A plain `#` link: on the one page it scrolls there; from Me (a
 * page of its own) the guest bar's frame opens the page holding the id and brings it into view (`hub-shell.tsx`
 * `openMark`) — the same path as every other mark on the page.
 */
export function SeeWhereYouAre({ target = SITE_ENTOURAGE_ME, pill = false }: { target?: string; pill?: boolean }) {
  const [there, setThere] = useState(false);
  useEffect(() => {
    setThere(placeIsOnThePage(document, target));
  }, [target]);
  if (!there) return null;
  /* 🔘 On the redrawn Me (owner 2026-10-24): a small icon-and-word pill — a pressable thing looks pressable. */
  return pill ? (
    <p>
      <a
        href={`#${target}`}
        data-see-where-you-are=""
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/20 px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/5"
      >
        <ArrowDown aria-hidden className="h-4 w-4 shrink-0" />
        <span>See where you are</span>
      </a>
    </p>
  ) : (
    <p>
      <a
        href={`#${target}`}
        data-see-where-you-are=""
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink/70 underline underline-offset-4 hover:text-ink"
      >
        See where you are
        <span aria-hidden>&darr;</span>
      </a>
    </p>
  );
}

/**
 * 👗 "SEE THE FULL DRESS CODE ›" — Me › What to wear's one quiet link to the couple's guide on Details (owner
 * 2026-10-24, the Me redraw: personal = Me · general = Details). Drawn only when that guide is on the page — the same
 * rule as "See where you are": a link to an id that is not there fails silently.
 */
export function SeeTheDressCode({ target }: { target: string }) {
  const [there, setThere] = useState(false);
  useEffect(() => {
    setThere(placeIsOnThePage(document, target));
  }, [target]);
  if (!there) return null;
  return (
    <p>
      <a href={`#${target}`} data-see-the-dress-code="" className="inline-flex min-h-[44px] items-center text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
        See the full dress code ›
      </a>
    </p>
  );
}

/** Is the viewer's marked place on this page? Pure over a structural document — the link's one condition. */
export function placeIsOnThePage(doc: { getElementById(id: string): unknown }, target: string = SITE_ENTOURAGE_ME): boolean {
  return doc.getElementById(target) !== null;
}
