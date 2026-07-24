/**
 * Guest-website revalidation helpers (OPEN-BROWSE PR10 — council verdict
 * 2026-07-22 §1.4 "one revalidateGuestSite(slug) helper"). The website editor
 * actions each hand-wrote the same `revalidatePath` calls after a save; a typo
 * or a forgotten path silently serves stale chrome. Centralizing the paths here
 * means a future caching/ISR change (the page is fully dynamic today, but that
 * can change) has ONE place to update.
 */
import { revalidatePath } from 'next/cache';

/**
 * Revalidate the public guest site for a slug (`/[slug]`). No-op when the slug
 * is falsy (an event with no slug has no public page to revalidate).
 */
export function revalidateGuestSite(slug: string | null | undefined): void {
  if (!slug) return;
  revalidatePath(`/${slug}`);
}

/**
 * Revalidate the couple's website manager surface for an event — the board
 * root (`/dashboard/[eventId]/website`) plus an optional sub-editor route
 * (e.g. `'site-chrome'` → `/dashboard/[eventId]/website/site-chrome`).
 */
export function revalidateWebsiteEditor(eventId: string, subroute?: string): void {
  revalidatePath(`/dashboard/${eventId}/website`);
  if (subroute) revalidatePath(`/dashboard/${eventId}/website/${subroute}`);
}
