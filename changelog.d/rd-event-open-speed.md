## 2026-10-16 · perf(dashboard): opening an event — the board hydrates once, the Home's reads start together, the guest list does no work twice

Owner, 2026-10-16: *"Opening my events takes so long."* Measured on a production build with the
owner's own rows replayed read-only (each read timed at its production `pg_stat_statements` mean),
Chromium 375 px, 4× CPU, Fast 4G. Table: `controller-2026-10-12/event-open-speed/MEASURE.md`.

- **`/dashboard` hydrated twice.** `event-card-menu.tsx:RemoveDialog` drew `null` on the server and a
  portal on the hydration pass, so React threw #418 on every phone load and re-rendered the board.
  It now waits for `useHydrated()` (`lib/use-hydrated.ts`). 🔒 `lib/a-portal-waits-for-hydration.test.ts`.
- **A traced logo froze the board.** `LayeredLogoPlayer`'s pen walk called `getPointAtLength` ~640
  times on one 2,147-character outline: 648 ms in ONE task at 4× CPU. Same samples and pens; the
  walk now yields every ~8 ms, and the layer stays hidden until its pen is ready.
  🔒 `lib/the-pen-is-traced-in-slices.test.ts`.
- **The three personal shelves share one read.** `fetchUserEvents(…, 'couple' | 'guest' |
  'coordinator')` now sends one identical `member_type=in.(…)` query that `cache()` answers once —
  on every page and every prefetch. 🔒 `lib/the-shelves-share-one-read.test.ts`.
- **The event Home's second run of reads starts together.** The header cover (page) and What's
  next's type photo, hero, profile scope, poster, budget visibility, paywall flag, Sai price, store
  shell and upcoming items were awaited one after another; they are started at once
  (`lib/start-ahead.ts`) and awaited where they were. 🔒
  `app/dashboard/[eventId]/the-home-second-reads-start-together.test.ts`.
- **Guests.** Group memberships are read once per load (`readEventGroupMemberships`, 🔒
  `lib/the-groups-are-read-once.test.ts`); the quick-add sheet gets the same row objects as the
  list (each row travels once in the RSC payload); the row fit skips the ResizeObserver's starting
  report (🔒 `app/dashboard/[eventId]/guests/the-guest-list-does-no-work-twice.test.ts`).

No change to what any page shows; every failed read still reads as "not measured", never empty.

SPEC IMPACT: None.
