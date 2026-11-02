## 2026-09-18 · fix(concierge): abuse-flag insert error is surfaced, not swallowed

`concierge_abuse_flags` insert (in `apps/web/app/dashboard/(account)/profile/concierge/actions.ts`)
previously wrapped a non-throwing Supabase call in a `try/catch` — the insert's
`{ error }` was never read, so a failed abuse-flag write logged nothing. Now
destructures `{ error }` and `console.error`s it, matching the two calls beside
it. The deny path (`return { status: 'under_review' }`) is unchanged — abuse
detection still blocks the trial regardless of whether the audit row landed.

SPEC IMPACT: None.
