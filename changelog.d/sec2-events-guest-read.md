## 2026-07-26 · fix(security): scope guest reads on events — secrets off the guest surface

**SEC-2** (2026-07-26 privilege audit, deferred out of PR #3715). A wedding
**guest** — not a host, not a coordinator — could `SELECT` the entire `events`
row, including `master_qr_token` (the crew-pairing credential) and the Google
Drive OAuth token, straight through PostgREST with the public anon key.

Root cause: `public.current_event_ids()` (20260512000000) has no `member_type`
filter, and `event_member_can_read` is `FOR SELECT TO authenticated USING
(event_id IN current_event_ids())`. A plain `member_type='guest'` row (seeded by
`app/join/[eventId]`) is therefore a full event "member". Migration
`20270920030000` re-scoped that pattern on seven tables but deliberately left the
`events` row on it — and the tokens live on that row.

**Fix — column-level `SELECT` privileges, not a policy re-scope.** Postgres RLS
is row-level only, so a policy cannot say "this guest sees 18 of the 192
columns", and a guest genuinely reads a narrow slice of this row through the
authenticated client (`lib/events.ts` `fetchUserEvents`' PostgREST embed +
`get-switcher-data.ts`). A column privilege is checked before and independently
of every policy, so one `REVOKE` closes the credentials against all three SELECT
policies on the table at once (member / moderator / community), every future
policy, every embed from the 152 FK'd tables, `select=*`, and the WHERE /
ORDER BY blind-search oracles. This is the read-side twin of `20271005100000`.

**Denied to `authenticated` + `anon`:** `master_qr_token`,
`photo_delivery_oauth_token_encrypted`, `photo_delivery_oauth_expires_at`.
`service_role` is untouched and is now the only read path.

- `supabase/migrations/20271007100000_events_column_select_privileges.sql` —
  revoke table-level SELECT, grant back a **computed** allow-list (all columns
  minus the deny-set), with post-conditions asserting (a) the credentials are
  unreadable by both roles, (b) the guest-visible slice survives, (c) the
  couple's host reads survive, (d) `service_role` is intact, (e) the #3715
  UPDATE/INSERT grants were not collaterally revoked.
- `apps/web/app/dashboard/[eventId]/event-qr/page.tsx` — the one authenticated
  reader of `master_qr_token`. Now reads it with the service-role client behind
  an explicit `requireHostMembership()` gate instead of inheriting authorization
  from the parent layout. The rotate action is untouched (it UPDATEs and RETURNs
  only `master_qr_token_rotated_at`).
- `apps/web/lib/security/events-column-select-privileges.ts` + `.test.ts` —
  build-time auditor over the migration text, with 10 meta-tests that neutralize
  the real SQL and assert the auditor fails.
- `apps/web/tests/db/events-guest-read-scope.db.test.ts` — the enforcement proof.
  Replays every migration into PGlite, seeds a real `member_type='guest'` row,
  `SET ROLE authenticated`, and asserts 42501. Includes the anti-vacuity guards:
  a meta-test that `current_user='authenticated'` with no BYPASSRLS and no
  ownership of `public.events`, a meta-test that the guest is still *admitted by
  the row policy* (so a denial can never be a row filter in disguise), a
  positive control, and a service-role differential on every denial.

**Still open (reported, not fixed here):** the row-level half. A guest can still
read the couple's `partner_a/b_birth_date` + `_birth_time`,
`bazi_birthdata_consent_at`, `estimated_budget_centavos`, `wizard_state`, and
`photo_delivery_folder_id` / `_folder_name` / `_account_email`. Those are read by
the couple with the same `authenticated` role, so a role-level grant cannot close
them — they need `event_member_can_read` re-scoped off `current_event_ids()` plus
a narrow guest-scoped surface to replace it.

SPEC IMPACT: None. No pricing, SKU, entitlement or product-surface change — a
database privilege change plus one internal read-path swap. `DECISION_LOG.md`
row not required (implementation detail of the 2026-07-26 privilege audit).
