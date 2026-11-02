## 2026-08-06 · fix(db): capture 6 prod-only functions into migrations, strip a hard-coded webhook credential, and close the internal-numbers matview

Two findings, both of the same shape: something real existed in production that
the repository could not see.

### 1 · Six functions and two triggers lived in prod with no migration

Diffing `pg_proc` / `pg_trigger` / `pg_event_trigger` in prod against every name
any file in `supabase/migrations` mentions turned up six functions applied by
hand:

| object | state |
|---|---|
| `notify_chat_message_webhook()` + trigger `chat_messages_notify_webhook` | LIVE — fires on every chat message |
| `rls_auto_enable()` + EVENT TRIGGER `ensure_rls` | LIVE — enables RLS on every new `public` table |
| `get_vendor_mood_board(uuid)` | LIVE — the vendor mood-board page calls it |
| `confirm_guest_delivery(uuid,text,text)` | ORPHANED — no caller anywhere in the repo |
| `undo_guest_delivery(uuid,text)` | ORPHANED |
| `list_vendor_delivery_bookings()` | ORPHANED |

This is not bookkeeping. Every data-layer guard here — the exposure freeze, the
anon-RPC surface, the schema-drift check, the FK-behaviour file — is derived from
a **replay of the migrations**, so an out-of-band object is invisible to all of
them simultaneously, and invisible in a way that looks exactly like clean. Four
of the six are `SECURITY DEFINER` and `anon`-EXECUTE, meaning
`anon-rpc-surface.baseline.txt` — a file whose entire job is to enumerate that
set — was six short and had no way to know. Back-filled in
`20271115531329_backfill_prod_only_functions_and_triggers.sql`; all six now
appear in both baselines.

The three orphaned delivery RPCs are **captured, not dropped**. Dropping is the
right end state and is proposed to the owner: "no caller in this repo" is not
"no caller anywhere", and capturing first makes the eventual DROP a reviewable
diff instead of another out-of-band act.

### 2 · 🚨 That chat trigger carried a credential in its body — ROTATE IT

`notify_chat_message_webhook()` built its `x-webhook-secret` header from a
64-hex-character literal typed straight into the function body, and
`pg_proc.prosrc` is world-readable inside the database. The value is **not**
reproduced in the migration. It now comes from Supabase Vault
(`notify_webhook_secret`), the same pattern migration `20270930270000` already
uses for the quarterly-2307 cron job, and the function **fails closed**: no Vault
row means no call, rather than a chat message leaving the database with an empty
credential attached. The function was also `SECURITY DEFINER` with no
`SET search_path`; that is pinned now.

**OWNER ACTIONS:** rotate the value, then set it in two places — Vercel
(`NOTIFY_WEBHOOK_SECRET`) and the Supabase Vault secret `notify_webhook_secret`.
Until the Vault row exists, vendor chat push notifications pause (silent, logged;
prod currently has no push subscribers).

A new guard makes the class visible rather than this one instance: **no function
body in `public` may contain a quoted 32+ hex-character literal.** Measured
across the whole replayed corpus that pattern matches nothing legitimate, so it
costs no false positives — and it is watched failing against a planted literal.

### 3 · Every signed-in account could read the company's own numbers

`bottleneck_signals_current` is the materialized view behind the Hiring
Predictive Guide: vendor-verification backlog, support response time, weekly
signups, open disputes, verified-vendor count. Its defining migration gave
`SELECT` to `authenticated`. Its three sibling *tables* each got an owner-only
RLS policy — but **a materialized view cannot carry RLS**, so there was no
policy to write and the GRANT was the whole access control. Supabase publishes
matviews through PostgREST, so it was one authenticated `GET` away for any
couple, vendor, guest or coordinator.

Revoked in `20271116295515_revoke_bottleneck_signals_matview_from_authenticated`.
It cost nothing: both readers use the service-role client. Scale, honestly — the
single row in prod is dated 2026-05-20 and every number in it is `0`, because
prod is pre-launch-empty *and* because of the finding below. The exposure was
real; today's contents were not interesting.

### 4 · Found in passing: those numbers have never refreshed

`refreshBottleneckSignalsIfStale()` calls `refresh_bottleneck_signals`, which
**does not exist** — no migration creates it and prod's `pg_proc` has no such
name. Worse, the miss was unobservable: a missing RPC does not throw through
postgrest-js, it resolves with `{ error }`, so the `try`/`catch` wrapped around
it could never fire and its warning has never printed. The error is now read and
logged. Creating the function is left alone deliberately — it has its own
decisions (`CONCURRENTLY` cannot run inside PostgREST's transaction) and this
file is the reader, not the owner of that call.

### Harness

`net.http_post`'s replay stub now matches real pg_net's parameter list and order
(it accepted a convenient 3-arg subset, which was invisible while every caller
lived inside a `cron.schedule()` string the replay never executes), and a
`supabase_vault` stub was added so Vault reads have somewhere to land. Nothing in
the harness holds a secret; tests seed their own fake.

SPEC IMPACT: None. No SKU, price, scope or locked decision changes. The webhook
secret rotation and the Vault row are operational owner actions, tracked in the
PR body, not spec edits.
