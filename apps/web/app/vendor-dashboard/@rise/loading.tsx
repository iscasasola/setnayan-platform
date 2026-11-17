/**
 * The empty rise slot's own loading boundary: its reset pages (`page.tsx`, `[...rest]/page.tsx`) draw NOTHING, so while
 * one streams the slot draws nothing too — never the supplier dashboard's page-title skeleton, which would promise a
 * heading these routes never paint (the-skeleton-promises-only-what-the-page-draws.test.ts). Each risen page keeps its
 * own skeleton (`(.)<page>/loading.tsx`).
 */
export default function NothingRisingYet() {
  return null;
}
