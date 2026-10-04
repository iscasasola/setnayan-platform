## 2026-10-04 · fix(hardening): crawlers never spend a guest code · one tile code per day · the schedule moves all-or-nothing · honest held label · one next-path rule

The independent audit's follow-ups on train g (#6348).

- **Crawlers never spend a guest code.** A chat app previewing a pasted landing
  address (`/{slug}/invite/enter?k=`) was redirected to `/{slug}/redeem`, where it
  EXCHANGED the guest's single-use re-entry code and took the Set-Cookie. A
  link-preview fetcher (`isLinkPreviewFetch`) is now answered in place on both:
  the landing renders a 200 (`LinkPreviewAnswer`) instead of redirecting, and the
  redeem answers any fetcher (code or token) with a 200 before any database read
  — no code spent, no pass, no scan row. Held by `lib/guest-pass-hop.test.ts` 9 ·
  9b (the real route, every database read counted through `fetch`).
- **One tile code per guest per day.** `generateMetadata` on the landing minted a
  fresh 24-hour tile code on EVERY render. The tile code is now DERIVED (an HMAC
  under the guest-pass seal of event · guest · UTC day · n), so every render that
  day names the same code, and its row is written at most once a day
  (`ensureTileReentryCode`). A spent code makes way
  for the next (at most `TILE_CODES_PER_DAY` = 3 a day). Still 32 bytes, stored
  only hashed, spent once. Held by `lib/guest-reentry.test.ts` 8 · 8b · 8c · 8d.
- **The Schedule moves with the date all-or-nothing, and once — from where it
  stands.** Apply moved the Schedule one UPDATE per block: a failure part-way
  left half the day on the new date, two racing Applies each shifted every block
  (the day moved twice), and the coordinator's hidden prep never moved. New
  SECURITY DEFINER `public.move_event_schedule_with_date(event, to_day)`
  (pinned search_path, `authenticated` only, fails closed for anyone but the
  couple or a Schedule EDIT delegate) shifts every block in one statement, locks
  the event row, and runs only once the live date IS the new day. The distance is
  measured from the day the Schedule STANDS ON — `event_schedule_day_anchor`,
  seeded by a trigger on `events` the first time an exact date changes, kept
  through date changes made elsewhere (which do not move the Schedule), dropped
  when a month/year breaks the chain, and FORGOTTEN by any hand edit of a block
  (a trigger on `event_schedule_blocks`; the move writes it back after its own
  shift) — never from a caller-chosen day or a stale record. The event row is
  locked `FOR NO KEY UPDATE`, so guest/child inserts are not blocked. So a
  second Apply finds it `aligned`; a date sent back elsewhere can never make a
  real move be skipped or doubled; and a move that did not happen (`stale`,
  `no-anchor`) is never reported as ok. Held by
  `tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts` 9–15.
- **Honest held label.** `reentry:refused` logged `held: 'other-event'` whenever
  the phone held any pass; one `passHeldKind` answer now says `this-event` for a
  pass of this event (another guest), shared with the landing.
- **Link previews from Viber, LINE and Signal** are fetchers too: Viber's
  published link-sharing agent (QtWebEngine … `Viber`) and `ViberBot`, LINE's
  `line-poker`, Signal's `WhatsApp/2`. Zalo is not listed — no published string
  could be found, and a guessed one could catch a person.
- **A tile code is named only once its row is stored** — the metadata and the
  body share one call per request; a failed write names none.
- **One next-path rule.** `isNativeSaveHandOff` judged `next` with its own
  "starts with `/`, not `//`" check; it now uses `isSafeNext` (lib/safe-next.ts),
  so `/\evil.com` and `/\t/evil.com` are refused.

Migration: `20271264726195_the_schedule_moves_with_the_date_all_or_nothing.sql`.

SPEC IMPACT: None — hardening of shipped behaviour (owner rulings unchanged: the
whole Schedule follows the date; the tile keeps the guest in).
