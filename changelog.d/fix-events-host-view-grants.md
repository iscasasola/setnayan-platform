## 2026-07-26 · fix(security): `events_host` was created WRITABLE by `authenticated` — main was red

Migration `20271008731642_events_private_details_guest_lock` (PR #3736) failed
its **own** post-condition, `events_host-is-writable`, so migration replay
aborted and **every one of the 310 DB tests failed on `main`** — along with the
unit tests that replay migrations. Main has been red since 09:24.

### The bug

Supabase's platform `ALTER DEFAULT PRIVILEGES` grants `ALL` on every newly
created table/view in `public` to `anon, authenticated, service_role`. So
`CREATE VIEW public.events_host` is born **writable by `authenticated`**.

The migration then did:

```sql
REVOKE ALL ON public.events_host FROM PUBLIC;   -- role grants untouched
REVOKE ALL ON public.events_host FROM anon;     -- fixes anon only
GRANT SELECT ON public.events_host TO authenticated, service_role;  -- ADDITIVE
```

`GRANT SELECT` does not *replace* the pre-existing `ALL`, and revoking from
`PUBLIC` does not touch a role-specific grant. `authenticated` kept
`UPDATE/INSERT/DELETE`.

That matters exactly as the migration's own comment says: `events_host` is an
**auto-updatable view with `security_invoker = false`**, so a write through it
runs with definer rights and goes **straight past `couple_can_update_event`**.
The post-condition caught it and refused to apply — working as designed.

### The fix

One line: `REVOKE ALL ON public.events_host FROM authenticated;` before the
`GRANT SELECT`.

### Blast radius: none in prod

The migration **never applied** — `events_host` does not exist in prod
(`supabase_migrations.schema_migrations` tops out at `20271008300000`), so no
privilege-escalation path was ever live. ⚠ It also means **SEC-2b's guest-surface
lock is not live in prod** either.

**Verification:** DB suite goes from **0 pass / 310 fail** to **305 pass / 2 fail**.
The 2 remaining failures are pre-existing and were *masked* by the total replay
abort — they belong to the security wave and are reported, not papered over:

1. `THE FREEZE: the exposure surface has not widened` — #3742's committed
   baseline does not contain #3736's `events_host` view. The freeze correctly
   flags a view readable by `authenticated` that does not honour the caller's
   RLS. It is **deliberately** a definer view, row-scoped in its own `WHERE` via
   `current_couple_event_ids()` — so accepting it into the baseline is a real
   security judgement (safety moves from RLS to that helper) and needs a human,
   not an automatic re-baseline.
2. `checkout is untouched: authenticated can still INSERT an order carrying
   pax_snapshot` — same wave, needs the same owner.

SPEC IMPACT: None (defect fix). Security handoff should note SEC-2b is NOT live
in prod.

### Second fix (same PR): a stale checkout assertion, not a broken checkout

`orders-pax-snapshot-freeze.db.test.ts` asserted that `authenticated` must keep
INSERT on `orders`, on the premise that *"submitOrderAction inserts through the
session-bound (authenticated) client"*. **That premise is stale**, and the two
halves of the security wave contradicted each other on it:

- migration `20271008178212` (`revoke_orders_payments_insert_from_session_roles`)
  deliberately removed INSERT on `orders` from the session roles — and it **is
  applied in prod**;
- checkout does not use a session client for money. `submitOrderAction` builds
  `const moneyWriter = createAdminClient()` and inserts through that, and
  `lib/order-price-authority.test.ts` independently **enforces** that every
  `from('orders').insert(` goes through the admin client.

So **the revoke never touched the till**, and the test was asserting the very
hole the migration closed. Corrected to assert what "checkout is untouched"
actually means — the service-role writer still works — plus a new companion test
pinning that `authenticated` **cannot** mint an order, so the file cannot drift
back.

**DB suite now 307 pass / 1 fail.** The only remaining failure is THE FREEZE,
which is an owner decision and is deliberately left red.
