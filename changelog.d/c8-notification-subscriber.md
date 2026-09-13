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

Security: this migration's first CI run tripped `exposure-freeze.db.test.ts`
(correctly — a new table inherits `ALTER DEFAULT PRIVILEGES` grants to `anon`
and `authenticated` unless revoked). Fixed by adding
`REVOKE ALL ON TABLE public.guest_push_subscriptions FROM PUBLIC, anon,
authenticated;` followed by `GRANT SELECT, INSERT, UPDATE, DELETE ... TO
authenticated` — the minimum the three RLS policies above actually need.
`anon` gains nothing. The exposure baseline
(`supabase/security/exposure-surface.baseline.txt`) was regenerated in this
same PR; the diff is exactly the new table's own privileges/columns/policies,
nothing else:

```
+tpriv  public.guest_push_subscriptions|authenticated  SIUD
+col    public.guest_push_subscriptions.*  anon=- authenticated=SIU   (×8 columns)
+policy admin_writes_guest_push_subscriptions   cmd=ALL    using=is_admin()
+policy couple_reads_guest_push_subscriptions   cmd=SELECT using=(event_id IN current_couple_event_ids() OR is_admin())
+policy guest_reads_own_push_subscriptions      cmd=SELECT using=(guest_id IN current_user_guest_ids() OR is_admin())
```

Also fixed: the guest-push-prompt "Turn on alerts" button initially used
`bg-terracotta text-cream` (3.48:1, fails WCAG AA) and tripped
`lint-label-on-fill-contrast.mjs`. `terracotta` is this repo's selected/active-
state accent, not a primary-action fill (`globals.css` `.button-primary` docs)
— swapped to `bg-mulberry text-cream` (the house primary-CTA color), which
also clears contrast.

SPEC IMPACT: None — this behavior is not yet documented in the specific
notifications iteration doc as a distinct guest-consent surface. Flagging for
owner awareness: it should probably become the canonical "where guest push
opt-in lives" answer if that page is ever expanded.
