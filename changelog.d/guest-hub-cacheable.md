## 2026-10-28 · feat(event-hub): the guest Event Hub is served from the cache, and guests hold no live connection (EV1)

Owner, verbatim: *"Our priority is not crash any event hub most specially during their event"* (DECISION_LOG 2026-10-28
"NO EVENT HUB MAY CRASH" + "EVENT DAY NEVER FAILS" — EV1).

- **The hub is cacheable now.** `revalidate = 60` on `app/[slug]/page.tsx` was dead (the page reads cookies and the
  query). The middleware now rewrites a guest's or a stranger's `/{slug}` to `/{slug}/cached/{key}`
  (`app/[slug]/cached/[key]/page.tsx`, ISR, `revalidate = 60`), keyed by the event's stamp (`event_public_stamp` — a
  write to any table the guest page shows moves it), the viewer (nobody, or a SEAL of this event's pass — never the
  pass), the four device facts the Apple Wallet offer reads, the tab and the guest's own last write. That route renders
  the live page's own function and reads nothing from the request: `lib/hub-request.ts` holds the viewer for the render,
  and every request reader in the tree (`getCurrentUser`, the guest pass, the cookie-scoped Supabase client, the
  native-shell marks, "view as free", the user agent, the Terms cookie) asks it first. Signed-in accounts, hosts'
  previews, one-shot query flashes and the native apps keep the live render, unchanged. `HUB_CACHE_DISABLED=1` turns it
  all off.
- **The `[slug]` layout reads no viewer.** The coordinator's announcement is fetched by its card from
  `GET /{slug}/announcement` (guests of this event only — the same gate; one remembered answer per event, cleared by the
  send) instead of being read by the layout, which made all twelve guest pages render per request.
- **No Realtime channel for guests.** The announcement's per-guest broadcast channel and its ping are gone (the card
  asks every ~30 s while looked at, backing off after misses); the guests' run-of-show header polls
  `/api/live/run-of-show/<event>` (one answer per event, CDN-held for open events) instead of `postgres_changes` —
  coordinators, hosts and suppliers keep their socket. The wall poll backs off ×2…×8 after misses.
- **Guard:** `lib/the-guest-hub-stays-cacheable.test.ts` (14 tests; 9 sabotages red) — the cached route's server tree
  reads nothing from the request; the readers ask first; the middleware's shape rule and key; every timer under
  `app/[slug]/**` listed with its reason; no channel at all.
- **Load test:** `apps/web/scripts/load-test-event-day.mjs` + the lab stand-in `apps/web/scripts/event-day-lab-stub.mjs`
  (local build only; refuses anything but localhost). Pass bar and before/after numbers in the PR body.

SPEC IMPACT: None to a locked decision — this implements EV1 of the 2026-10-28 "EVENT DAY NEVER FAILS" plan. One
behaviour to note for the owner: a guest's page may show a host's change up to ~60 s late when the change is to
something outside the guest page's stamp (a purchase, a gift setting); everything the stamp covers is immediate, and a
guest's OWN write is immediate for them.
