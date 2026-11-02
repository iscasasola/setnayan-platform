## 2026-10-20 · fix(guest): an essential read that lapsed on its own limit tries once more, inside the page budget

Production 2026-10-19: the owner's live invitation threw `GuestPageDidNotLoad` twice in 24 h while the
whole Supabase instance stalled for 5–10 s. At 21:15:04Z the layout's `rpc/event_public_stamp` ran out
its own 6 s `READ_LIMIT_MS`; a read sent at 21:15:11.8 answered in 1.9 s — with 4 s of the 10 s
`PAGE_BUDGET_MS` still unspent.

- `lib/read-limit.ts` `fetchWithinReadLimit`: an ESSENTIAL read whose own per-read limit ran out is
  sent ONCE more, at once, only while page budget remains; the retry's wait is
  `min(READ_LIMIT_MS, budget left)`. Never a decoration read, never a read the budget cut short, never
  a real error / HTTP answer / caller's abort, never a table write; a POST `/rpc/…` only when the
  function is named in `RETRIED_RPCS`.
- A retry that still does not answer is a lapse exactly as before — the page still throws
  `GuestPageDidNotLoad`, and the boundary's own retry (`lib/invitation-retry.ts`) is unchanged.
- The retry is logged on its own call site `read-limit:retry` (Vercel `[supabase-query-error]` line +
  Sentry message), with `recovered` true/false.
- Guards: `lib/an-essential-read-tries-twice.test.ts` (fake timers, the REAL 6 s / 10 s limits, through
  the real service client) and `tests/db/a-retried-guest-read-cannot-write.db.test.ts` (every
  `RETRIED_RPCS` function exists and every overload is STABLE/IMMUTABLE). `lib/read-limit.test.ts`'s
  "sent once" became "sent once + one retry".

SPEC IMPACT: None — no UI change; the guest's words and the error page are unchanged.
