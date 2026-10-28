## 2026-10-29 · feat(home): Who's here — the team on the dashboard now, and the guests viewing the Event Hub

Owner, verbatim: *"on event>home page. can we add a list of who is viewing our event hub or inside the event dashboard
now?"* → *"a widget for this as well? so when 2 cohost/helper or coordinator is on the dashboard and which guest is
viewing the event hub?"*

- **Home › Who's here** (`app/dashboard/[eventId]/_components/home-cards/home-whos-here-card.tsx`) — one card in the
  service-card style, after Papic on the first screen, under the console on the day, after the summary after the day.
  **On the dashboard:** the others' faces — first name + Host · Co-host · Helper · Coordinator ("Just you right now"
  when alone; the viewer is never a face). **Viewing the Event Hub:** guests who opened it with their own pass (faces,
  "+N"; a tap opens that guest's card — the shipped `GuestCardSheet`, new `home` reader) and everyone else as a number.
  The last 30 minutes, said in the ⓘ. A failed read says "Couldn't load who's viewing" with ⟳ Reload — never "nobody".
- **The team half is Realtime presence on ONE private channel per event** (`event-team:{event_id}`), joined once by the
  event layout (`event-team-presence.tsx`), authorised by `event_team_presence_can_access()` (hosts + accepted
  moderators). Presence only — no `postgres_changes`. A tab hidden for 30 s leaves the list.
  ⚠ **This is the one live channel a layout reaches** — the 2026-10-21 rule "the chrome is not live"
  (`lib/a-socket-only-where-something-is-live.test.ts`) now lists it in `LAYOUT_MAY_REACH` with its gate:
  `TEAM_PRESENCE_DISABLED=1` joins nothing. Cost: one socket per VISIBLE dashboard tab of an event's team (never
  guests). Flagged for the owner — the alternative is presence on Home only ("who's on Home", not "on the dashboard").
- **The guest half is one write per guest per 30 minutes, never a connection.** The hub page fires
  `POST /api/hub/seen` once after it draws (`hub-seen-beacon.tsx`, idle callback, `sendBeacon`, remembered in the
  browser's own storage — not a cookie). The route names a guest only from their verified pass; strangers are +1 on a
  per-event quarter-hour counter; the team's own looks are dropped. `record_hub_view` (service role only) refuses to move
  a guest seen in the last 30 minutes. Rows are kept a day (deleted on write).
- **The cached hub is untouched:** the beacon is a separate request, and the middleware's cache-bust cookie now skips it
  (`HUB_BUST_EXEMPT_PATHS`) — otherwise every open would have cost that guest their cached copy.
- **Kill switch:** `HUB_VIEWS_DISABLED=1` (Vercel env + redeploy) — no beacon drawn, the route writes nothing, the card
  says it is off. Default ON (load estimate in the PR: 500 guests opening in 2 minutes ≤ 500 row writes, ~4/s).
- **Privacy:** read by the event's team only (RLS at CREATE TABLE; a name only where the caller may read that guest's row,
  so a helper without the guest list sees no names and is told so). Strangers are a count with no person, cookie or hash
  column. Added to the RA 10173 export (`event_hub_opens`, the subject's own guest rows) and to account erasure
  (`hub_guest_views` by the subject's guest ids). In-app only, no email.
- **Window is 30 minutes, not 15:** the window must be at least the debounce, or a guest still looking drops off the card
  for half of every half hour. `lib/whos-here.ts` pins window ≥ debounce.
- Migration `20271295895751_hub_viewers.sql` · Ugat joint J58 · exposure baseline regenerated (authenticated SELECT on
  the two tables, two invoker functions; nothing for anon) · guards `lib/whos-here.test.ts` +
  `tests/db/who-is-viewing-the-hub.db.test.ts` (each sabotaged red once) · load harness `--beacon 1 --strangers N` in
  `scripts/load-test-event-day.mjs` with the stand-in modelling `record_hub_view`.

SPEC IMPACT: New owner ask recorded in the corpus DECISION_LOG ("WHO'S HERE ON HOME"). One deviation from the brief to
flag: the card's window is 30 minutes (= the 30-minute debounce), not 15 — a 15-minute window over a 30-minute
debounce would show a guest who is still looking as gone. A guest-facing privacy note about the open being counted is
NOT added (no copy invented) — flagged for the owner/DPO.
