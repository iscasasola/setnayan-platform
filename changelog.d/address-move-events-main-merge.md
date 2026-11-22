## 2026-11-22 · fix(addresses): the address-move migration moves forward and keeps main's `articles` word

`origin/main` merged into #7868 (1,695 commits).

- Migration `20271350564435_event_address_owner_and_usernames` is now `20271357986226_…` (allocated with
  `pnpm migration:new`). Main's `20271355258231` had added `articles` to `business_slug_is_reserved`; this PR's
  CREATE OR REPLACE sorted below it, so the DB replay would have dropped the move's words and prod (where this file
  applies last) would have erased `articles`. The body is now `20271355258231`'s plus the move's words.
- Main's newer look wins: no "Live hub" chip on the event page, and `/hub` is main's forwarder. The share card's
  watch link is main's `?tab=live`, built through `publicEventPath`.
- One new hand-typed event link from main (`site-body.tsx`, "See the venue map" → `/find-my-table`) now goes through
  `publicEventPath`, as `an-event-lives-under-its-creator.test.ts` §7 requires.
- `resolveEventOwnerSlug` now logs a failed creator read before it answers the bare address (`ugat-both-ends`:
  a dropped result is a fault even when the fallback is safe).
- `the-day-hub-follows-the-stage.test.ts` re-anchored to the helper-built venue-map door; the rule (the door stands
  beside the seat block) is unchanged.

SPEC IMPACT: None
