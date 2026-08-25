import { GridPageSkeleton } from '@/components/skeletons';

/**
 * The printable sheet of guest QR codes.
 *
 * 🔑 IT EXISTS TO STOP BORROWING A TITLE THIS SCREEN DOES NOT DRAW. Without this
 * file the nearest boundary is `dashboard/[eventId]/studio/custom-qr-guest/loading.tsx`, which paints a page-title bar
 * because the screen IT was written for genuinely has one. This screen's
 * masthead renders an sr-only heading and nothing visible, so the borrowed
 * shimmer promised ~64px of chrome that never arrived and the page jumped up
 * when it landed.
 *
 * ⚖ Adding a boundary here is status-neutral: this route ALREADY streams
 * through `dashboard/[eventId]/studio/custom-qr-guest/loading.tsx`, so the HTTP status was committed early either way. (That
 * matters — a route-level loading file is what turned a `notFound()` into a
 * soft-404 on `/v/[slug]`; see `app/[slug]/_lib/first-byte.test.ts`. Nothing
 * here changes when the status commits.)
 */
export default function Loading() {
  return <GridPageSkeleton tiles={8} cols="sm:grid-cols-2" tileClass="h-40" />;
}
