## 2026-10-07 · fix(reads): a schema-cache blip retries — never not-found, redirect or empty

Owner "Yes" (2026-10-07) to the roadmap item §2.3: every deploy that carries a
migration makes PostgREST answer `503 · PGRST002` for 20 s – 1 min, and the read
paths turned it into an answer about the person — the Maker's membership read
redirected out, EventLayout's reads fell to `notFound()`, and Home's
`fetchUserEvents` degraded to an empty board (prod bursts 2026-10-05 13:54Z and
2026-10-06 02:12Z).

- New `lib/read-retry.ts`: `withSchemaRetry` retries a READ on a transient error
  (PGRST000–003, or a 5xx other than a statement timeout) with backoff — 3.25 s
  in all. A blip that outlasts it throws `SchemaBlipError`, whose digest reaches
  `app/error.tsx`, which shows "Reconnecting…" and refreshes three times
  (2 s · 4 s · 8 s) before the existing "Something on our end didn't work".
  A refusal (RLS, 4xx, phantom column) is read once, exactly as before.
- Wired into: EventLayout's `event_members`, `event_moderators` and `events`
  reads; the Maker's (`LaunchPage.membership`) read; Home's three board reads
  via the new `fetchUserEventsOrReconnect` (same cached read as
  `fetchUserEvents`, which keeps its never-throws contract and now also retries).
- No writes and no server actions retry. +0 server actions.
- 🛡 `lib/read-retry.test.ts`.

SPEC IMPACT: None (implements ROADMAP_TO_APPLE_CHECK_2026-10-06.md §2.3 as written).
