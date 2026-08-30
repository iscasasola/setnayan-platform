## 2026-08-31 · feat(notifications): ask guests for push permission at the seat-claim moment

Web push was fully built and mounted — `lib/web-push.ts`, `PushToggle` on the
couple/vendor/admin surfaces, `emitNotification` wired throughout — but nothing
ever asked a **guest**, so production held zero subscriber rows. Guests carry a
signed-cookie session (`guest-session.ts`), never a Supabase auth identity, so
neither existing push table (`push_subscriptions.user_id → auth.uid()`,
`vendor_push_tokens.vendor_profile_id`) can hold a guest row.

Added:
- `supabase/migrations/20271185475723_guest_push_subscriptions.sql` — a new
  guest-scoped table, RLS enabled at create time, no guest write policy (the
  row is written server-side via the service-role admin client after
  `readGuestSession()` verifies the cookie — mirrors `scan_events`, the
  existing precedent for guest-originated writes).
- `apps/web/app/[slug]/seat/actions/guest-push-actions.ts` — the guest-side
  `saveGuestPushSubscription` server action.
- `apps/web/app/[slug]/seat/_components/guest-push-prompt.tsx` — a
  dismissable, one-time banner mounted on the personal Seat Pass (right after
  `ArrivalBloom`), adapted from the existing `PushToggle` /
  vendor-dashboard-registrar subscribe flow rather than re-derived. Never
  blocks the pass; never re-prompts after a decline or dismissal
  (`localStorage`-remembered, since a browser-denied permission is permanent
  anyway).
- `apps/web/app/[slug]/seat/notifications-finally-have-a-subscriber.test.ts` —
  asserts the write path uses `readGuestSession()` + the service-role admin
  client (never the RLS-scoped user client, which silently no-ops for a
  guest), that the migration carries no guest write policy, and that the
  prompt is actually mounted and never loops.

Pre-flight (autonomy rule 12/gate check): confirmed `VAPID_SUBJECT`,
`VAPID_PRIVATE_KEY`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are all present in the
Vercel **production** environment (type `sensitive`) via the project env API
before building — the send path (`/api/notify`, `lib/web-push.ts`) only warns
and continues when they're missing, so a broken setup looks identical to a
working one with no subscribers otherwise.

Scope: this is the ASK, not new push plumbing — no service-worker or send-path
changes. Sending an actual notification to a subscribed guest is future work;
this closes the gap where nobody could ever say yes.

SPEC IMPACT: None — this behavior is not yet documented in the specific
notifications iteration doc as a distinct guest-consent surface. Flagging for
owner awareness: it should probably become the canonical "where guest push
opt-in lives" answer if that page is ever expanded.
