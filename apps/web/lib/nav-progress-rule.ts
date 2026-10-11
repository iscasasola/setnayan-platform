/**
 * lib/nav-progress-rule.ts — WHICH NAVIGATIONS START THE TOP LOADING LINE.
 *
 * The line (`app/_components/nav-progress.tsx`) has ONE way to finish: the
 * pathname `usePathname()` reports changes, which means the new route has
 * rendered. So it may only START for a navigation that will change the
 * pathname. Anything else — a tab's `?tab=details`, a `#mark`, the phone's Back
 * between two tabs of the same page — re-renders nothing the line can see, and
 * a line started for it runs until its ten-second safety timer.
 *
 * Measured on the guest page (`/maria-and-jose`, 375 px, 2026-10-11): tap
 * Details, press Back — the page was drawn at once and a gold line crawled
 * across the top for 10–12 seconds. The link-click path already asked this
 * question; the Back / Forward path did not.
 *
 * Pure, so the rule is executed by a test rather than read out of a handler.
 */

/** Does going from `fromPathname` to `toPathname` change the page the line can watch finish? */
export function navStartsTheLine(fromPathname: string, toPathname: string): boolean {
  return fromPathname !== toPathname;
}
