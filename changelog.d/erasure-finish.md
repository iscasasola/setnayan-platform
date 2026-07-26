## 2026-07-26 · fix(privacy): make account deletion actually finish — RA 10173 erasure completeness

The owner asked for one thing: "make it finish." It did not finish. It barely started.

### The part nobody knew about

`eraseUserAccount` addressed columns by name through an **untyped** supabase-js client (`createAdminClient()` returns a `SupabaseClient` with no generated `Database` type, so `tsc` cannot see a wrong name). **Five of those names were not columns:**

| written to | actually lives on |
|---|---|
| `events.owner_email` | nowhere — it is an output alias of the admin-intelligence **VIEW** (`20261202001000`) |
| `events.owner_display_name` | same |
| `users.venue_address` | `events` |
| `users.venue_name` | `events` |
| `users.social_post_url` | `vendor_profiles` |

PostgREST rejects the **entire** `UPDATE` when one key is not a column (PGRST204). So **both** statements failed in full, every time:

- **the owned-event purge** — no birth date/time, no BaZi consent stamp, no photo-delivery account email, and **no photo-delivery OAuth token** was ever cleared;
- **the `users` anonymize** — no display name, phone, photo, birth date, slug, religion, civil status, sex or normalised address was ever cleared, **and `deleted_at` was never stamped**. `deleted_at` is what the middleware and the dashboard/vendor-dashboard layouts read to lock the account out. So "delete my account" left the account **live, named, and logged-in-able**.

Nothing surfaced it, and that is the interesting part: the best-effort design (correctly) writes `erasure_purge_failed` to `admin_audit_log` and carries on, precisely so a stuck purge can never trap an account in an undeletable state. The property is right; it just had nothing watching the audit rows. Verified against prod `information_schema` — and `events.photo_delivery_account_email` is non-null on the one real event today, so this was not theoretical, only unexercised (1 signup ever, 0 deletion requests, so nothing was exposed).

Three of the five were found by the new CI guard, not by reading. That is the whole argument for the guard.

### What else now gets erased

**`events.wizard_state` (the JSONB second copy — the gap that started this).** Scrubbed **surgically, by allow-list**: only `completed_at` and `in_flight_since` survive. Everything else in a task entry is payload — the wedding + prenup dates, budget, pax, monogram initials, site slug, per-task vendor ids, and an **unbounded `meta` passthrough** whose target task ids are `cenomar_bride` / `cenomar_groom` / `church_paperwork` / `marriage_license`, i.e. slots designed to hold PSA and CENOMAR reference numbers (Philippine civil-registry documents, sensitive PI under §3(l)).

Allow-list, not deny-list, deliberately: `WizardState` has an open index signature and `markTaskInFlight` copies **any** `meta_*` form field straight in, so a deny-list fails **open** for every key added later — which is exactly how this gap was born. The allow-list fails **closed**; a test proves an invented future key is stripped without anyone editing the list.

Not a wholesale delete: setup progress is **shared** with the co-partner. Blanking the column would erase their place in ~38 planning cards.

**`event_paperwork`** — the purpose-built home for those same PSA/CENOMAR references. Same payload-vs-progress split: `tracking_reference`, `document_r2_key` and `notes` cleared (and the R2 document deleted); `document_type` and `status` kept as the couple's shared checklist.

**`oauth_grants`** — erasure nulled `events.photo_delivery_oauth_token_encrypted` while a **live, cron-refreshed Google Drive refresh token** sat in `oauth_grants` (keyed by `event_id`, no user FK, so nothing reached it). It erased the pointer and kept the key. Row deleted.

**`auth.users.raw_user_meta_data`** — a second copy of the full name, email and OAuth avatar, written at signup. `updateUserById` now clears it alongside the email.

**`vendor_profiles`** — 19 further PII columns the 10-column scrub never reached as the table grew: `hq_address`, `registered_business_name`, `registered_address`, `tin_number`, `screen_name`, `microsite_about`, `portfolio_r2_keys`, … Live proof: `hq_address` held a real street address on a profile whose `business_owner_name` right beside it was already being nulled.

**Chat attachments** — the message row was hard-deleted and the R2 object left behind: unreachable-but-retained, worse than either. Refs are now collected before the delete.

**The disarmed CASCADEs.** When `eraseUserAccount` stopped issuing `auth.admin.deleteUser` (it threw on any account with activity), the ~60 `ON DELETE CASCADE` FKs to `auth.users` stopped firing and nothing replaced them — the docstring recorded the RESTRICT motivation and not this side effect. Explicit deletes restored for the subset that is unambiguously the subject's own: `notifications`, `api_keys`, `chat_thread_reads`, `guest_saved_vendors`, outbound `user_follows`/`vendor_follows`, `seating_editor_locks`, `vendor_push_tokens`, and the four `*_oauth_state` tables. Plus `scan_events` (scanner identity + IP + UA nulled, the host's scan row kept) and `event_moderators` (own invitation email/phone/token nulled, `display_label` kept — the host's record of who their coordinator was).

**Pre-signup captures** (`couple_waitlist_signups` + the two notify-me tables) have **no user FK at all**, so a `user_id`-driven erasure could never reach them. Matched on the original email, captured before the tombstone.

Also: `users.public_profile_enabled` is now cleared (the slug was nulled but the flag stayed on), and `/u/[slug]` is revalidated so the cached public page does not outlive the account.

### The forward guard

The underlying defect is a hand-maintained list drifting from reality, so the fix is not "add the missing names once".

- The erasure surface is now **data** (`lib/erasure/coverage.ts`) and the purge **executes those same constants** — there is no second list to drift.
- `lib/erasure/coverage-guardrail.test.ts` (10 checks) holds every name against the schema parsed from `supabase/migrations`, and every subject-bearing table against four buckets: `PURGED` (derived), `PARTIALLY_PURGED` (the own-vs-shared line runs *through* a table), `DELIBERATE_EXCLUSIONS` (34 reasoned entries), `KNOWN_GAPS`. A new table lands in none of them and CI goes red.
- It reuses the **existing** parser from the export guardrail, extracted to `lib/security/migration-schema.ts` rather than cloned. Two parsers would disagree invisibly. The parser was widened to see unqualified `ALTER TABLE foo` (it only matched `public.foo`, which produced a false "phantom column" on `gallery_video_links`); the export guardrail still passes 12/12 unchanged.
- **What it cannot do**, stated in the file: it cannot tell a *correct* purge from a *syntactically valid* one; it cannot see keys typed inline rather than through the constants; and its subject-column detector is **not a superset of what erasure must cover** — 9 tables this purge reaches (`oauth_grants`, `event_paperwork`, `guest_face_enrollments`, `vendor_push_tokens`, `couple_waitlist_signups`, the four `*_oauth_state`) carry no subject column at all, so a future table shaped like them will not be flagged. Pinned and counted rather than glossed.
- `UNDECIDED_BACKLOG` (82 tables) is **not a clean bill of health** — it is pre-existing debt, frozen as a ratchet that may only shrink. 82 reasons invented in one sitting would be the rubber stamp the export guardrail's own docblock warns about.

### Tests

`tests/db/erasure-completeness.db.test.ts` runs the **real** purge against the **real** schema (every migration replayed into PGlite) through a PostgREST-shaped adapter that returns errors as data, exactly as supabase-js does. A mocked client would only have tested the mock's opinion of the schema — which is how three phantom columns survived.

25 subtests: deletion of every newly-covered location; **survival** of shared and co-partner state; a failing step still deleting the account and still auditing the miss. Anti-vacuity: 4 META controls, plus a neutralisation proof with measured counts — restoring the five phantom columns fails **4 of 25** (and the static guard, and the unit suite); scorched-earthing `wizard_state` fails **1 of 25**, and it is the co-partner-survival control; swallowing adapter errors fails **2 of 25**, one of which is the control that exists for exactly that.

`npx tsc --noEmit` clean · `test:unit` 3867/3867 · `test:db` 286/286.

**No migration.** `wizard_state` is `{}` on both prod events (0 keys, verified) so there is nothing to backfill, and no DDL is required — writing a migration to rewrite live rows would have been churn against data that does not exist.

SPEC IMPACT: `DECISION_LOG.md` — new row recording (a) the five phantom columns and the two statements that never executed, (b) the wizard_state allow-list as the standing pattern for JSONB erasure, (c) the erasure coverage guard + its 82-table ratchet, (d) nine DPO questions surfaced rather than answered.
