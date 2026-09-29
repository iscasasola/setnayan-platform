## 2026-09-29 · perf(pages): five more pages start their reads at once

The follow-on to #6124 (home board). The same fault, measured on prod
2026-09-29 while signed in: server components ran their Supabase reads one
after another, each waiting for the last, though most needed nothing from each
other. Each page now starts its independent reads as promises, keeps every
graceful-degrade and log line exactly as it was, and awaits them in one
`Promise.all` under a `THE ONE WAIT` banner.

- `app/dashboard/[eventId]/layout.tsx`: shared by every event page. 5 serial
  stages after the access gate become 1.
- `app/dashboard/[eventId]/page.tsx`: the event overview (~1.4 s measured).
  About 5–7 serial trips become the event row plus one wait.
- `app/dashboard/[eventId]/checklist/page.tsx` (~1.0 s): 9 serial become the
  gate plus one wait. The seed still finishes before the rows are read (same
  promise). It now uses the request-cached `getCurrentUser()` instead of a
  second `auth.getUser()` round trip.
- `app/vendor-dashboard/shop/page.tsx` (`loadShopData`, ~1.7 s): about 18
  serial become the gate plus one wait. `enrichTeamWithUsers(createAdminClient())`
  still waits for this shop's own team rows.
- `app/dashboard/[eventId]/messages/[threadId]/page.tsx` and
  `app/vendor-dashboard/messages/[threadId]/page.tsx`: 17 and up to 25 serial
  waits become one. The two writes (mark-read, and `resolveLivePax`'s pax lock)
  never start earlier than before, and the conversation list still reads after
  mark-read.

Unchanged: every access gate (auth, membership, moderator, shop ownership,
thread ownership) still runs first, and no service-role read starts before the
gate that guards it.

Guards (each sabotaged and seen to fail, then restored byte-identical):
`the-event-reads-at-once.test.ts`, `the-checklist-reads-at-once.test.ts`,
`my-shop-reads-at-once.test.ts`, `lib/a-chat-thread-reads-at-once.test.ts`.

⚠ `tsx --test` treats a literal `[eventId]` in a path as a glob and silently
runs ZERO tests from it. Escape it as `[[]eventId]`.

SPEC IMPACT: None.
