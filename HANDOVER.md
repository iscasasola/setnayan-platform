# HANDOVER — claude/guest-hub-cacheable (Builder EV1, 2026-10-28) · PR #7016 (draft, do-not-auto-merge)

Contract: DECISION_LOG 2026-10-28 "NO EVENT HUB MAY CRASH" + "EVENT DAY NEVER FAILS" (EV1). Owner: *"Our priority is not
crash any event hub most specially during their event"*. Offline caching is EV2 — not here.

## State
- Cache: `middleware.ts` → `lib/hub-view-route.ts` (stamp RPC memo 3 s, pass → seal) → `/{slug}/cached/{key}`
  (`app/[slug]/cached/[key]/page.tsx`, ISR 60 s). Key codec + shape rule: `lib/hub-view-key.ts`. Viewer held per render:
  `lib/hub-request.ts`; readers that ask it first: `lib/auth.ts`, `lib/supabase/server.ts`, `lib/guest-session.ts`
  (`readHeldPass`, `signedInAccountId`), `lib/request-platform.ts`, `lib/view-as-free.server.ts`, `app/[slug]/page.tsx`.
  Off switch: `HUB_CACHE_DISABLED=1`.
- Layout reads no viewer. Announcement: `app/[slug]/announcement/route.ts` + `_lib/latest-announcement.server.ts`
  (gate) + `_lib/announcement-stage.ts` (stage rule). Card polls 30 s ± 20 %, visible only, back-off. No channel, no ping.
- Guests' run of show: `app/api/live/run-of-show/[eventId]/route.ts`; `run-of-show-header.tsx` polls when `forGuests`.
- Guard: `lib/the-guest-hub-stays-cacheable.test.ts` (14 tests; sabotage script in the session scratchpad, 9/9 red).
- Lab: `apps/web/scripts/event-day-lab-stub.mjs` (stand-in, counts DB round trips + max open) and
  `apps/web/scripts/load-test-event-day.mjs` (500 guests, polls, scans, an announcement). Local build only.

## Decisions taken (not covered by the record)
- Signed-in accounts, any query the page reads (except `tab`), the Terms / view-as / host-preview / demo cookies and the
  native shells keep the LIVE render (unchanged). A pass for ANOTHER event keeps it live too (the pass-book rules).
- Freshness: the event stamp (`event_public_revs`) is part of the key, so every write the guest page's shared reads see
  is immediate; anything else (a purchase, a gift setting, the clock's phase) shows within `revalidate` (60 s — the
  2026-05-22 owner-accepted window). A guest's OWN write (any non-GET with a pass) moves `sn_hub_bust` → fresh copy.
- The announcement now appears after the page paints (one small fetch) instead of in the server HTML — the layout can
  no longer know who is looking. Same words, same gate, same look.

## Next (EV2)
Build offline on top of the cached copy: the service worker can keep the guest's own `/{slug}` response (one stable,
cacheable document per guest key) + `/{slug}/announcement` + `/api/live/run-of-show/<event>` JSON.
