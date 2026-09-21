import { GridPageSkeleton } from '@/components/skeletons';

/**
 * NO HEADER BUTTONS ARE RESERVED, because the page's header no longer has any.
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
    <GridPageSkeleton tiles={15} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" tileClass="h-24" />
  );
}
