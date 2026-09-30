## 2026-09-29 · feat(discover): Concert · Open house · Grand opening; "Get tickets" on public events; choosing Public turns on "Ask to join"

PR 1 of the Discover build (spec corpus DECISION_LOG 2026-09-29, "DISCOVER —
UNPARKED" and "DISCOVER BUILD — TWO LAST ANSWERS").

**Three new kinds of event** — migration `concert_open_house_grand_opening`
mints `concert`, `open_house` and `grand_opening` in `event_type_vocab`, each with
a profile (copied from `corporate` / `gala_night`; open house and grand opening
drop `seating`, they are walk-in), the marketplace tiles `corporate` reaches, a
Papic sizing row copied from the `'default'` row, and a widened
`events_community_class_consistency` so a Samahan may own them. Code maps:
`CHECKLIST_EVENT_LABELS`, `HOST_ROLES_BY_EVENT_TYPE`,
`PAPIC_ACCESS_PHASE_1_TYPES`, `LIVE_EVENT_TYPES`, `AI_TIER_BY_EVENT_TYPE`.
Priced like corporate (owner 2026-09-29, "yes like corporate"): the AI band is
copied from corporate's `event_type_vocab.ai_price_tier` (code map 'B') and each
Papic sizing row copies corporate's row. "Competition" is a search word that finds
`tournament` (`EVENT_TYPE_TERMS`), not a type. The features page stops writing a
count of event types.

**"Where to get tickets"** — new `events.ticket_url` (nullable, https only,
≤ 500 chars, CHECK `events_ticket_url_https`; SELECT to `authenticated` only, no
UPDATE grant, `events_host` rebuilt). The host sets it in the Maker's "Who can
open your Event Hub" panel, right under Public; `updateLandingPageVisibility`
parses it (`lib/ticket-url.ts`, the same rule as the CHECK) and writes it through
the service role after its host gate. The guest Event Hub shows **Get tickets**
(new tab, `rel="noopener noreferrer"`) only while the event is Public. The
organizer sells the tickets; Setnayan never does.

**Public → "Anyone, I approve"** — `rsvpAskConfigOnGoingPublic` (lib/rsvp-ask.ts)
sets `rsvp_ask_config.whoCanRsvp = 'anyone'` on the move INTO public only, in
the host's explicit switch only (`updateLandingPageVisibility` — the privacy page
and the Maker panel). A Save-the-Date launch also makes the page public and
leaves `rsvp_ask_config` untouched (owner 2026-09-29: "no"). A Maker draft that
already holds the RSVP questions follows (`lib/going-public.ts`), so an older
draft cannot switch requests back off at Apply. The privacy page's Public
description now says requests are on by default and can be turned off.

Tests: `ticket-url.test.ts`, `choosing-public-turns-on-asks.test.ts`,
`concert-open-house-grand-opening.test.ts`, the privacy-copy guard extended,
`papic-event-access.test.ts` roster 17 → 20.

- 2026-09-29 owner answers applied (DECISION_LOG "PUBLIC EVENTS (PR #6159) —
  TWO OWNER ANSWERS"): the three kinds priced like corporate; the Save-the-Date
  launch no longer turns on "Anyone, I approve" (a guard now pins that it leaves
  `rsvp_ask_config` untouched), and the privacy page's Public copy says so.

SPEC IMPACT: None beyond the three 2026-09-29 DECISION_LOG rows this implements.
