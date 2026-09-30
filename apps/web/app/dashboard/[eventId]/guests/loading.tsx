import { GridPageSkeleton } from '@/components/skeletons';

/**
 * ONE HEADER BUTTON IS RESERVED, AT EVERY WIDTH — the ⋯ beside the title
 * (F2, 2026-10-01: frame 2 of the approved simple phone app, "title + ⋯", and
 * the same ⋯ on a computer). It is always drawn, so the skeleton always holds
 * its place.
 *
 * ── Before F2 ──
 * No header buttons were reserved, because the page's header had none.
 *
 * ⚖ Owner 2026-09-20: the masthead's doors ("Invite guests", "Arrange the
 * room", the Wedding March, Share, Check-in) became ONE ROW of tabs under the
 * title — `_components/roster-tabs.tsx`. This skeleton used to reserve two 44px
 * pills at `lg` for them; left in place, that is exactly the phantom chrome
 * `the-skeleton-promises-only-what-the-page-draws.test.ts` exists to refuse — a
 * reservation for buttons the page no longer draws, collapsing on arrival.
 *
 * ⚠ KNOWN AND NOT HIDDEN: the tab row sits BELOW the title, and this skeleton
 * type has no band to reserve there. So on a desktop the list arrives ~42px
 * lower than the skeleton drew it. That is smaller than the pills' old
 * collapse and it is not zero — reserving it properly needs a tabbed variant of
 * GridPageSkeleton, which is its own change.
 */

export default function GuestsLoading() {
  return (
    <GridPageSkeleton tiles={15} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" tileClass="h-24" actions={1} />
  );
}
