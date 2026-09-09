/**
 * A WITHDRAWAL REACHES EVERY COPY — `04` §3 · `07` Q6 (owner-ruled 2026-09-09)
 * · 08 step 4.1. **The list of everywhere, in one place.**
 *
 * ── WHAT WAS TRUE BEFORE THIS FILE ──────────────────────────────────────────
 * A guest could withdraw and it did not come down. Measured, not read:
 *
 *   • the host's guest form (the ONLY writer of `photo_consent = false`)
 *     revalidated `/dashboard/{eventId}/guests` and the `backTo` it came from —
 *     and nothing public at all;
 *   • the guest's own "Not me" (`removeMyTag`) revalidated `/{slug}` and stopped
 *     there;
 *   • `/{slug}/recap` and `/{slug}/print` are their own cached routes at
 *     `revalidate = 300`, so the withdrawn photo stayed on both for up to five
 *     minutes — and `/{slug}/print` is the surface a person is about to PRINT;
 *   • the share card is `max-age=3600, stale-while-revalidate=86400`, so it
 *     could keep showing for a day.
 *
 * ⇒ **The withdrawal came down on the next read and not before.** The write was
 * always correct; every reader of it was on its own clock.
 *
 * ── WHY A LIST AND NOT FIVE CALL SITES ──────────────────────────────────────
 * 🔑 A FIX APPLIED TO ONE READER IS NOT A FIX. This repo has paid for that five
 * times, and the shape is always the same: the rule is written once per surface,
 * a sixth surface is added later by somebody who never read the other five, and
 * the miss is SILENT — a stale page looks exactly like a correct one. So the
 * surfaces are enumerated HERE, once, and every consent write calls the same
 * function. Adding a public surface means adding a line to this file, and the
 * guard that fails otherwise is `a-withdrawal-reaches-every-copy.test.ts`.
 *
 * Pure on purpose — no `server-only`, no `next/cache`, no Supabase. The list is
 * a function of the slug, so a unit test can assert exactly which surfaces are
 * in it without a database or a Next request scope. The effect that consumes it
 * lives in the `.server.ts` beside this file.
 */

import { publicEventPath } from './public-event-url';

/**
 * Every cached PUBLIC surface on which a guest's photograph, name or words can
 * appear for a single celebration.
 *
 * ⚠ `/realstories/{slug}` IS DELIBERATELY NOT HERE, and it looks like it should
 * be. It renders through the identical `EditorialContent` engine and it is
 * `revalidate = false` — a fully static page, the worst possible cache to be
 * wrong about. It is excluded because its slug set is FIXED
 * (`dynamicParams = false`, `generateStaticParams` over `ALL_REAL_WEDDINGS`) and
 * every one of them renders a curated SAMPLE fixture through
 * `SAMPLE_EDITORIAL_IDS`. No real event reaches it, so no real guest is on it.
 * If a real celebration is ever given a `/realstories/{slug}` page, it belongs
 * in this list on the same day.
 *
 * ⚠ THE NESTED `/u/{owner}/{slug}` FORM IS DERIVED, NOT HARD-CODED. The
 * three-tier URL cutover is flag-gated and OFF in production today — verified by
 * the object, not the flag: the live page's own `<link rel="canonical">` reads
 * `https://www.setnayan.com/movie-night`. Asking `publicEventPath` means the day
 * somebody flips that flag, this list grows by itself rather than quietly
 * missing the canonical URL of every story.
 */
export function storySurfacesFor(
  slug: string,
  ownerSlug?: string | null,
): string[] {
  const clean = slug.trim();
  if (!clean) return [];
  const surfaces = [
    // The story itself. Always the bare root as well as the canonical form: a
    // printed QR from before the cutover keeps resolving here.
    `/${clean}`,
    /*
      The Auto-Recap — a DIFFERENT keepsake with its own switch
      (`event_recaps.status`), so narrowing the story's AUDIENCE does not hide
      it (`lib/auto-recap.ts` has 0 references to `audience`).

      🔑 BUT A WITHDRAWAL IS FULLY BINDING ON IT, and the corpus said otherwise
      until this was measured. `lib/auto-recap.ts` contains 0 occurrences of the
      string `event_editorial` — which is what was measured before — yet it calls
      `loadEditorialData` at two call sites, and THAT reads the row. The recap's
      hero goes through the consent veto inside that function
      (`!consentVeto.ids.has(heroPhotoId)`, under a docblock that says consent
      wins over curation), so a vetoed capture stops leading the recap. **A grep
      for a table name cannot see one hop.**
    */
    `/${clean}/recap`,
    // The print keepsake. The one a person is about to put on paper.
    `/${clean}/print`,
    publicEventPath(clean, ownerSlug),
  ];
  return [...new Set(surfaces)];
}

/**
 * THE SHARE CARD CANNOT BE REVALIDATED, SO ITS URL HAS TO MOVE.
 *
 * `/api/og/realstory-slug/{slug}` is a Route Handler that returns a `Response`
 * carrying `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
 * That header is honoured by the viewer's browser, by the CDN, and by every
 * social platform that has already fetched it — **none of which Next's
 * `revalidatePath` can reach**. Calling `revalidatePath` on it would look like a
 * fix and do nothing at all, which is worse than leaving it alone.
 *
 * A cache keyed on a URL is busted by changing the URL. So the `og:image` the
 * page publishes carries the moment the story last changed, and the next fetch
 * of the page yields a card address nobody has cached.
 *
 * 🔑 AND SAY WHAT THIS STILL CANNOT DO. A post somebody already shared holds the
 * OLD address, and we cannot reach into it any more than we can reach into a
 * printed page. What changes is that every share from now on, and every
 * platform that re-scrapes, gets the current card. Never write copy that implies
 * an already-posted share is recalled.
 */
export function ogCardVersionToken(storyVersionAt: string | null | undefined): string | null {
  if (!storyVersionAt) return null;
  const ms = Date.parse(storyVersionAt);
  if (!Number.isFinite(ms)) return null;
  return String(Math.floor(ms / 1000));
}

/** Append the version to a card address, when we know one. */
function withVersion(base: string, storyVersionAt: string | null | undefined): string {
  const token = ogCardVersionToken(storyVersionAt);
  return token ? `${base}?v=${token}` : base;
}

/** The story's share card. */
export function ogCardUrlFor(
  siteUrl: string,
  slug: string,
  storyVersionAt: string | null | undefined,
): string {
  return withVersion(`${siteUrl}/api/og/realstory-slug/${slug}`, storyVersionAt);
}

/**
 * The AUTO-RECAP's share card — a SECOND cached card, and it was nearly missed.
 *
 * 🔑 THIS IS THE FIFTH SURFACE, AND IT IS EXACTLY THE SHAPE OF MISS THIS MODULE
 * EXISTS TO END. `04` §3 names four things — the story, the recap, the print
 * route, "the OG card" — and "the OG card" reads as one card. There are two.
 * `/api/og/recap/{slug}` renders `loadRecapCardData`'s `heroUrl`, which comes
 * from `loadEditorialData` and therefore CAN be a guest's photograph, and it
 * carries the same hour-long `Cache-Control` nothing on the server can reach.
 * Fixing four of five would have been a fix that looks complete and is not.
 */
export function recapCardUrlFor(
  siteUrl: string,
  slug: string,
  storyVersionAt: string | null | undefined,
): string {
  return withVersion(`${siteUrl}/api/og/recap/${slug}`, storyVersionAt);
}

/* ─── What a printed copy says ──────────────────────────────────────────────
 *
 * ⚠ THESE SENTENCES ARE THE RULING, NOT COPY. `07` Q6 asks in as many words for
 * the limit to be stated in the product and not only in a pull request: **a copy
 * printed before this shipped carries no stamp and can never know anything, and
 * paper cannot be recalled.** The stamp lets a reader CHECK. It does not reach
 * a printed page and nothing here may suggest that it does — which is why
 * `the-stamp-never-promises-paper.test.ts` reads these strings and fails on the
 * vocabulary of recall.
 */

/** Introduces the moment the paper was true. Followed by the formatted date. */
export const PRINTED_STAMP_LEAD = 'This copy shows the story as it stood on';

/**
 * The limit, said plainly, on the paper itself.
 *
 * It says what a reader can DO — scan and look — rather than reassuring them
 * that we will keep their copy right. We cannot.
 */
export const PRINTED_STAMP_LIMIT =
  'A guest can ask for their photo to come down at any time, and it comes down ' +
  'from the story — but never from a printed page. Scan to see the story as it is now.';

/**
 * The stamp, as one sentence, in the celebration's own time zone.
 *
 * ⚠ THE ZONE IS PASSED IN AND NEVER GUESSED. A date rendered without a
 * `timeZone` is rendered in whatever zone the server happens to be running in —
 * this repo has a guard for exactly that (`a-date-is-not-decided-by-the-machine`)
 * — and a keepsake stamped in the deploy region's afternoon would be wrong on
 * the one artefact a person keeps.
 *
 * Returns `null` when there is no stamp, and the caller then prints NOTHING
 * rather than today's date: a story whose version we do not know is exactly the
 * copy printed before this shipped, and inventing a moment for it would be the
 * one lie this whole feature exists to prevent.
 */
export function printedStampLine(
  storyVersionAt: string | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  if (!storyVersionAt) return null;
  const ms = Date.parse(storyVersionAt);
  if (!Number.isFinite(ms)) return null;
  const zone = timeZone?.trim() || 'Asia/Manila';
  let stamped: string;
  try {
    stamped = new Intl.DateTimeFormat('en-PH', {
      timeZone: zone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    // An unknown zone throws (`RangeError`). Manila is the product's home and
    // the honest fallback; failing to print the stamp at all would be worse.
    stamped = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  }
  return `${PRINTED_STAMP_LEAD} ${stamped}.`;
}
