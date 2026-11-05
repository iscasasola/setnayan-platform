'use client';

import Link from 'next/link';
import { PenLine, UploadCloud } from 'lucide-react';

import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';

/**
 * <MarkToggle> — the one control at the top of the Monogram Maker.
 *
 * Owner 2026-09-20, asked where the "Both ways to make it" link and the
 * "Vector Studio · Design your mark from scratch" heading should move: *"make a
 * toggle. what will switch which editor or uploader will show under. under it
 * is the animate."*
 *
 * So the page is four rows, top to bottom: this toggle, the editor OR the
 * uploader it selects, the effects, and the two save buttons. It replaces a chooser SCREEN (two large
 * door cards you had to pass through), a "Both ways to make it" link back to
 * that screen, and a separate heading-plus-paragraph inside each door — four
 * pieces of navigation for one binary choice.
 *
 * Labels are the owner's own: *"Create your own or Upload your monogram"* — a
 * toggle "with labels on which editor will show", so each side names what opens
 * beneath it rather than a verb like "Design it" that says nothing about where
 * you end up.
 *
 * Links, not client state: each side carries `?mode=`, so Back and refresh keep
 * the side you were on, a deep link can open either one, and the choice works
 * before any JavaScript has loaded. `aria-current` marks the active side for
 * screen readers; both targets are ≥44px.
 *
 * 🎚 THE ONE PILL SELECTOR (owner 2026-10-08: *"adjust all pill selectors to this if possible"*): the track, the
 * two sides and the terracotta thumb that slides between them are the app's template
 * (`app/_components/pill-selector.tsx`) — still two real `<Link>`s, the same two addresses. This file is a client
 * file ONLY so it can read the template's class strings (they live in a client module); it holds no state.
 *
 * ⚠ THE TWO HREFS ARE WRITTEN OUT LITERALLY, ON PURPOSE. `lint-port-no-lost-
 * controls` reads destinations statically and cannot follow a URL built by a
 * helper call. Measured, not assumed: the chooser this replaces built its
 * `?mode=` links through `href(mode)`, and they were NEVER in the guard's
 * baseline — the page's only recorded destination was the plain `…/monogram`
 * link. Written literally, both sides of this toggle are now recorded, so
 * deleting either one turns the guard red. (The guard also keeps the query as
 * part of the key, so `?mode=design` and the bare path are different
 * destinations to it — which is why removing the bare "Both ways to make it"
 * link is a real, deliberate removal and its baseline is regenerated.)
 */
export function MarkToggle({ eventId, mode }: { eventId: string; mode: 'design' | 'upload' }) {
  return (
    <nav aria-label="How to make your mark" className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} w-full max-w-lg`}>
      <PillThumb />
      <Link
        href={`/dashboard/${eventId}/monogram?mode=design`}
        aria-current={mode === 'design' ? 'page' : undefined}
        className={`${pillSegClass(mode === 'design')} gap-2 px-4`}
      >
        <PenLine aria-hidden className="h-4 w-4" strokeWidth={2} />
        Create your own
      </Link>
      <Link
        href={`/dashboard/${eventId}/monogram?mode=upload`}
        aria-current={mode === 'upload' ? 'page' : undefined}
        className={`${pillSegClass(mode === 'upload')} gap-2 px-4`}
      >
        <UploadCloud aria-hidden className="h-4 w-4" strokeWidth={2} />
        Upload your monogram
      </Link>
    </nav>
  );
}
