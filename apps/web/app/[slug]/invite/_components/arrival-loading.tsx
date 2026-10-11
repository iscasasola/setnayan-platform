import type { CSSProperties } from 'react';
import { DoorShell, type DoorShellProps } from '@/app/_components/door/door-shell';
import { GuestLookScope } from '../../_components/guest-look-scope';
import { lookScopeProps } from '../../_components/host-draft-look';
import type { GuestLook } from '../../_lib/loaders';

/**
 * arrival-loading.tsx — what a guest sees while their landing or their reply
 * page is still being put together.
 *
 * WHY THIS EXISTS. `/[slug]/invite/enter` (where every personal link and QR
 * lands) and `/[slug]/invite/reply` each ran a dozen-plus awaits one after
 * another with no boundary anywhere under them, so not one byte was drawn until
 * the last one answered — measured as a 2.9 s blank on a good connection, and
 * as long as the database takes on a bad one (the small plan's first call
 * after a quiet gap is up to 3 s by itself). A guest who has just tapped their
 * link and is looking at nothing taps again, or decides the link is broken.
 *
 * It is the SAME answer `/[slug]` already gives (`invitation-skeleton.tsx`,
 * 2026-08-05), for the same reason, and under the same rule:
 *
 * ⛔ NOT A `loading.tsx`. A route-level loading file commits HTTP 200 before
 * the page has decided anything, so an address that matches no event becomes a
 * soft-404 (the file `[slug]/loading.tsx` was deleted for exactly that —
 * app/[slug]/page.tsx, "THE BLANK WHITE SCREEN"). This is the fallback of a
 * `<Suspense>` INSIDE each page, placed AFTER its last `notFound()` and
 * `redirect()`, so the status is settled before the first flush.
 *
 * 🪞 IT IS THE DOOR ITSELF, LOADING — not another page under it (owner
 * 2026-09-27: "before the actual website runs, i see another website under").
 * It is `DoorShell`, the component the page draws, with the header the page
 * will give it — the couple's names, their mark, the date line — from the event
 * row the page has ALREADY read to make its routing decision. Nothing here is
 * read for the fallback's sake.
 *
 *   · the look — `loadGuestLook(slug)`, the value the guest layout already
 *     asked for on this very request (`cache()`d), worn through the same
 *     `lookScopeProps` the page uses. Without it the door would flash the
 *     house look first (the layout leaves `/invite/*` undressed).
 *   · the mark — still, never playing: whether an animation is owned is one
 *     of the slow reads, exactly as on the Event Hub's skeleton.
 *   · NOT here: the Main background, the couple's line under their names, and
 *     everything inside the card — those need the slow reads, and arrive with
 *     the page.
 *
 * The bars are the house `.skeleton` sweep in the theme's own ink and paper,
 * and give up after a while (`.sn-skeleton-gives-up`) like the Event Hub's. A
 * screen reader hears "Loading your invitation…" — the same words.
 *
 * 🛡 app/[slug]/invite/the-arrival-shows-something-while-it-loads.test.ts
 */

/** The house shimmer, in the theme's own ink and paper (as `invitation-skeleton.tsx`). */
const SHIMMER: CSSProperties = {
  backgroundColor: 'rgb(var(--color-ink) / 0.07)',
  backgroundImage:
    'linear-gradient(90deg, rgb(var(--color-cream) / 0) 0%, rgb(var(--color-cream) / 0.6) 50%, rgb(var(--color-cream) / 0) 100%)',
};

function Bar({ className }: { className: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} style={SHIMMER} />;
}

export function ArrivalLoading({
  look,
  door,
}: {
  /** The Event Hub's look for this event — what the guest layout already resolved. */
  look: GuestLook | null;
  /** The door's own header, as the page will draw it. (`brand` is not a choice: see below.) */
  door: Omit<DoorShellProps, 'children' | 'brand'>;
}) {
  return (
    <GuestLookScope {...lookScopeProps(look)}>
      {/* `brand="foot"` spelled here, not passed in: every door on a couple's
          page carries the couple on top and "Made with Setnayan" at the foot
          (the-guest-doors-wear-the-event.test.ts reads it at the tag). */}
      <DoorShell brand="foot" {...door}>
        {/* Announced, not drawn: a sighted guest sees the door filling in. */}
        <p role="status" className="sr-only">
          Loading your invitation…
        </p>
        <div aria-busy="true" data-arrival-loading="" className="sn-skeleton-gives-up space-y-3">
          <Bar className="h-3 w-24 rounded-full" />
          <Bar className="h-5 w-2/3 rounded-full" />
          <Bar className="h-3 w-full rounded-full" />
          <Bar className="h-3 w-5/6 rounded-full" />
          <Bar className="mt-5 h-12 w-full rounded-full" />
        </div>
      </DoorShell>
    </GuestLookScope>
  );
}
