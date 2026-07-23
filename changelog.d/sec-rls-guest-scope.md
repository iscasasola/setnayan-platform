## 2026-07-23 · fix(security): re-scope guest-leaking RLS policies off current_event_ids + close two server-action authz holes

**Root cause.** `public.current_event_ids()` is `SELECT event_id FROM event_members WHERE user_id = auth.uid()` with **no `member_type` filter**, so a plain guest (`member_type='guest'`, seeded when someone joins via `app/join/[eventId]/actions.ts`) is returned as a full event "member." Every sensitive RLS policy scoped on that helper therefore leaked to any guest who joined the event.

**Migration `20270920030000_rls_guest_scope.sql`** DROP/CREATEs seven policy families, changing ONLY the scope helper (RLS stays enabled, no policy widened, no blanket allow-all):

- `oauth_grants · event_member_reads_oauth_grants` (SELECT) → `current_couple_event_ids()` — plaintext Google/YouTube OAuth refresh tokens; couple only.
- `guests · event_member_can_read_guest` (SELECT) → `current_couple_or_coordinator_event_ids()` — exposed every guest's `qr_token` (→ ephemeral session mint). Co-hosts manage the list; the separate `guest_reads_own_row` policy is untouched so a guest still sees their own row (`AND deleted_at IS NULL` guard preserved).
- `orders · orders_owner_read` (SELECT) → `user_id = auth.uid()` OR `current_couple_event_ids()` OR `is_admin()` — money ledger; co-host (spouse) read kept, guest and coordinator excluded (money-wall).
- `guest_face_enrollments · event_member_can_read_face_enrollment` (SELECT) → `current_couple_event_ids()` — biometric face vectors + selfie refs; couple only.
- `event_vendor_payment_plan · host SELECT + host FOR ALL` → `current_couple_event_ids()` — a guest could previously read AND DELETE the frozen vendor payment schedule (money-wall). Table comment corrected (it claimed "Host-scoped RLS via current_event_ids()").
- `budget_allocation_decisions · SELECT + DELETE` → `current_couple_event_ids()` — table comment already claimed "Couple-own-only"; it wasn't (a guest could read every snapshot AND erase them). Re-scoped both the read and the RA-10173 DELETE to make it true; the INSERT policy was already couple-gated.
- `event_appointments · couple INSERT + couple UPDATE` → `current_couple_or_coordinator_event_ids()` — a guest could cancel/move the couple's vendor appointments. Day-of ops = couple + coordinator. The couple READ policy is deliberately left on `current_event_ids()` (appointment visibility is benign event context, like the schedule).

Two further policies re-scoped after review (same leak class):

- `guest_message_blocks · guest_message_blocks_manage` (FOR ALL) — its USING already gated on `member_type IN ('couple','coordinator')` but its **WITH CHECK** required only `current_event_ids()`, so a guest could INSERT a block row directly over PostgREST (anon-key browser client), bypassing the `blockKwentoGuest` server action entirely. WITH CHECK tightened to mirror the USING clause — the DB is now the real gate; `is_admin()` arm preserved.
- `patiktok_oauth_grants · event_member_reads_oauth_grants` (SELECT) → renamed `couple_reads_patiktok_oauth_grants`, re-scoped `current_couple_event_ids()` — stores plaintext TikTok `access_token`/`refresh_token` (both NOT NULL); its SELECT policy was guest-readable via `current_event_ids()`. **DORMANT** today (gated behind unset `TIKTOK_*` env, no rows), which is the only reason it was not live-exploitable — folded in to close the OAuth-token leak class fully. Outside the brief's literal 7-table list → flagged for owner sign-off in the PR.

Benign event-context tables (schedule / run-of-show / seat plan / the event row) are deliberately left on `current_event_ids()` — guests keep those. A `DO $$` post-condition asserts each re-scoped policy still exists and no longer references `current_event_ids()` (mirrors the assert style in `20270828140000_papic_one_tiers.sql`).

**Two server-action holes** (defense-in-depth alongside the RLS above):

- `app/dashboard/[eventId]/studio/papic/moderation/actions.ts` `blockKwentoGuest` — added an explicit couple/coordinator authority check (via `isKwentoModerator`) before the insert, matching the file's other moderation actions. Now belt-and-suspenders with the tightened `guest_message_blocks_manage` WITH CHECK above.
- `app/api/crew/register-device/route.ts` — stopped trusting the client-supplied `vendor_profile_id` (the endpoint writes with the service-role client, which bypasses RLS). Now requires an authenticated session and verifies the supplied id against `current_vendor_profile_ids()` (via `resolveAuthorizedCrewVendorId`), returning 401/403 otherwise. Stale "crew hold no auth session" doc comment corrected.

Pure predicates extracted to `lib/security/{crew-vendor-authz,kwento-moderation-authz,rls-guest-scope-audit}.ts` with unit suites (17 tests). The migration audit test reads the real migration file and fails on any regression back to `current_event_ids()`, and now also asserts the tightened `guest_message_blocks_manage` WITH CHECK and the re-scoped `patiktok_oauth_grants` read. Typecheck clean.

**Adoption changes (adversarial review before merge):**
- **`orders` read scope — owner decision 2026-07-23: couple + COORDINATOR** (not
  couple-only as first drafted). Couple-only would have reverted the signed-off
  `20270129279924` co-host widening; couple+coordinator closes the guest leak
  while keeping coordinators (event managers) on the shared purchase view, and
  matches the guests-table scope. Updated the migration policy + the auditor's
  expected helper for `orders_owner_read`.
- **Re-stamped** `20270831174208` → `20270920030000` (was below main's current
  max — would apply out-of-order on `db push`); updated the 5 files that
  reference the migration filename, incl. the audit test's `readFileSync`.
- `/api/crew/register-device` requiring a vendor session breaks no in-app flow
  (no fetch caller exists; only a route-helper string). A live-DB role-based RLS
  verify (`rls_entitlement_verify_2026-07-23.sql`) is recommended as a
  post-merge confirmation; the audit test statically proves the SQL is correct.

SPEC IMPACT: None (security hardening of existing shipped policies/endpoints; no SKU, schema-rename, or feature-scope change). Owner decision 2026-07-23: a plain guest gets a read-only benign event view but never reaches tokens, orders, payments, biometrics, or other guests' secrets.
