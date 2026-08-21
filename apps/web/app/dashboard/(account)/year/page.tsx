import { redirect } from 'next/navigation';

/**
 * YOUR YEAR IS RETIRED AS A PAGE (owner 2026-08-21: *"remove the your year …
 * we already have the your year inside my events"*).
 *
 * 🔑 A REDIRECT, NOT A DELETE, AND THE DIFFERENCE IS OTHER PEOPLE'S LINKS.
 * `/dashboard/year` is reachable from things this repo does not control: the
 * daily digest email has carried it as its call to action, and anybody who
 * bookmarked their own year still has it. Deleting the route turns every one of
 * those into a 404 — the person did nothing wrong and the product looks broken.
 * Redirecting takes them to the shelf that replaced it.
 *
 * ⚠ THE CONTENT MOVED FIRST, WHICH IS WHAT MAKES THIS HONEST. This page's own
 * sections were "Worth planning for" and "The year ahead", and the ONLY thing it
 * held that the shelf did not was the holiday set — `year-moments-strip.tsx` now
 * builds with `includeHolidays: true`, so nothing is lost on the way here.
 * Retiring it before that would have quietly deleted Christmas and Valentine's
 * from the one surface that warns about dates booking out early.
 *
 * The full previous page is in git history; recover it with
 * `git show 877c7305d:apps/web/app/dashboard/(account)/year/page.tsx`.
 */
export default async function YearPage() {
  redirect('/dashboard#worth-planning');
}
