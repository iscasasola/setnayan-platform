## 2026-09-20 · feat(live-studio): venue screens — pair a TV at /live and choose what it shows (DAY-12)

The Live Studio controller (`/panood/control/[eventId]`) now has a **Venue screens**
section. The host adds a screen, opens `setnayan.com/live` on any TV, projector or LED
wall, and types its 6-character code. From then on the controller chooses what that
screen shows, per screen or all at once:

- **Live background** — the couple's monogram (their real mark when they have one),
  names and date on the obsidian ground, tinted with their monogram colour.
- **Mirror the livestream** — their YouTube watch link, embedded muted, always with the
  notice "Livestream · about 10–30 seconds behind the room".
- **Off** — a black screen.

Owner rulings, 2026-09-20 (the three questions that had stopped DAY-12 on 09-18): screens
belong in the unified controller; a Live Studio screen never shows the photo wall; the
mirror is acceptable only with a visible delay label.

How it holds together:
- `lib/live-screens.ts` is the one rule both ends import. Any stored mode outside the
  three — including the column default `photos` from the legacy Cast room — draws the
  live background. Mirror with no watch link also draws the live background on the TV,
  and the controller says why.
- A paired TV holds a signed httpOnly cookie (`lib/live-screen-session.ts`) bound to the
  row's `paired_at`. Remove and "New code" take effect on the screen's next poll.
- Pairing codes are single-use, expire after a day, and are throttled per client address.
- Presence ("Connected / Not responding") is read from `last_seen_at` against the clock,
  because an unplugged TV cannot write "offline".
- A refused read is never rendered as emptiness: the controller says it couldn't load the
  screens, and a TV keeps its last picture with a small "Reconnecting…" mark.
- No migration. Reuses `panood_screens`, `generateScreenPairingCode`, and
  `events.panood_watch_url`. `app/live/` now exists, so `live` joins the generated half of
  `lib/reserved-slugs.ts` and stays in the database-mirrored half.
- `live` joins the service worker's `RESERVED` set (`public/sw.js`). Without it the worker
  reads `/live` as a couple's guest slug and serves the TV a stale cached copy of the
  pairing page. `app/sw-reserved-routes.test.ts` caught it.
- The cookie-consent and demo banners stay off `/live/screen` (new `isRoomDisplayRoute` in
  `app/_components/capture-safe-routes.ts`, exact path). Nobody is at a TV to dismiss a card
  sitting on the couple's monogram all night. `/live` itself keeps the consent ask, because a
  person types the code there. While undecided, analytics never initialise, so no consent is
  bypassed.

Guarded by `apps/web/lib/live-screens.test.ts` (13 tests) and three new cases in
`capture-safe-routes.test.ts`. Sabotaging the notice render or the
legacy-mode fallback each turns one red.

Verified locally: `/live` renders chrome-less and refuses a malformed code with its
message. Not verified end to end: the local environment has no service-role key, so
pairing, the controller section and the screen picture could not be exercised, and prod
has zero screen rows. First real check: add a screen on a test event, pair a browser tab at
`/live`, and flip the three modes.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-20 row recording the owner's three DAY-12 answers and
the phone-tab decision (keep "Event Hub Controller").
