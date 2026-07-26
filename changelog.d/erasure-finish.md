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

---

## 2026-07-26 · fix(privacy): scope erasure per-partner, and purge vendor government IDs

Follow-up to the entry above, landing the two items the review left open.

### 1 · Erasure was deleting the OTHER partner's documents

**Owner ruling 2026-07-26: "a leaver deletes only their OWN paperwork; the remaining partner keeps theirs."**

`event_paperwork` and `oauth_grants` are both keyed by `event_id` and had **no per-user column**, so the purge scoped them `.in('event_id', eventIds)` — **event-wide**. One partner deleting their account destroyed the **other partner's** PSA birth certificate, CENOMAR and baptismal/confirmation scans (DB row *and* the R2 object), and revoked a Google credential that may well be the co-partner's own account. That is a third party's sensitive personal information under §3(l), destroyed by someone with no standing to request its erasure — and unlike over-retention, it does not come back.

Migration `20271009200000` adds two nullable attribution columns: `event_paperwork.subject_user_id` and `oauth_grants.granted_by_user_id`, both `REFERENCES public.users(user_id) ON DELETE SET NULL`.

- **Not `CASCADE`** — a paperwork row is the *couple's* shared checklist entry, so cascading would rebuild the same defect one level down.
- **Not `NO ACTION`/`RESTRICT`** — that would add a 42nd FK to the set that already makes a hard `DELETE FROM auth.users` throw, the very reason `eraseUserAccount` stopped issuing one.
- `SET NULL` degrades to exactly the state the purge already treats as "subject unknown → do not touch". The FK's failure mode and the purge's failure mode agree, which is what makes fail-closed coherent.

The purge now **fails closed**: it deletes only what is *provably* the leaver's, and every unattributable row it keeps is written to `admin_audit_log` as a new `erasure_unattributed_retained` action with counts (never reference numbers).

**The cost, stated plainly rather than buried.** Nothing populates `subject_user_id`, so the paperwork step currently erases **nothing at all**. That is deliberate: retaining a document too long is a fixable compliance miss with an audit trail pointing at it; destroying a co-partner's civil-registry documents is irreversible and harms someone who never asked for anything. When the two failure modes are not symmetric, fail toward the reversible one. Live rows: `event_paperwork` = 0, so nothing regressed in practice.

**The real fix is deliberately NOT built here.** What is missing is a user↔partner-slot link, and it genuinely does not exist: `event_members.role` is only `'host'` or `NULL`, `events` has `bride_name`/`groom_name`/`partner_a_birth_date`/`partner_b_birth_date` but **no `partner_a_user_id`**, and the second partner frequently has no account at all. "Is this leaver partner 1 or partner 2" is unanswerable with today's data, and an erasure path — the one place a wrong guess destroys someone else's documents — is the worst possible place to invent an answer. It is a product-model change and belongs in its own PR.

`oauth_grants` **is** attributable today, and now is: all three OAuth callbacks already read `oauth_state.initiated_by`, so they stamp it at consent time. The pre-existing columns could not serve as the key — `external_account_id` is a provider subject id, and `external_account_display` is an email on the Drive grant but a **YouTube CHANNEL TITLE** on the other, so string-matching it to a Setnayan account would both over-delete (a couple sharing one Gmail) and under-delete (any account whose Google address differs from their login). Already-`revoked_at` rows are deleted too: `revoked_at` means the token no longer works *for us*, while the row still holds an email, a provider subject id and an avatar URL.

### 2 · Vendor government IDs survived account deletion entirely

`vendor_verification_applications.doc_uploads` (JSONB) holds uploaded **government IDs, DTI/SEC certificates, BIR 2303s and Mayor's Permits** in the private `setnayan-vendor-verification` bucket. There was **no deletion code for it of any kind.**

The guardrail could never have said so. The table's only `*_user_id` column is `admin_user_id` — the *reviewing staff member*, which the subject detector correctly ignores — and everything else keys off `vendor_profile_id`. So the miss was **structural**, not an omission from a list. It is now pinned in `PURGED_WITHOUT_SUBJECT_COLUMN` with that reasoning written next to it, so the next reader distrusts the guard's green tick in the right place.

Purge resolves the subject's shop (`vendor_profiles.user_id` is UNIQUE = sole owner), deletes the R2 objects **first**, then empties `doc_uploads` and resets the `docs_complete` derivative. The **row survives**: it is also the admin verification decision record (`admin_user_id`, `decision`, `decision_reason`, `decided_at`) — the same call already made for `vendor_verifications`. Documents go, accountability trail stays.

Refs are gathered by walking the whole JSONB for `r2://` strings rather than reading a known key: `DocUpload` is a seven-member union and two slots (`portfolio_samples`, `client_references`) are **arrays**, so a fixed-key read silently misses them — and a missed ref means the file stays in the private bucket with the row that named it wiped. Live shape confirmed against prod before coding (1 row, keys `bir_2303` + `dti_certificate`, both values currently `null`).

### 3 · Three smaller defects, each verified

- **`deletePublicAsset` could not fail.** It `console.error`'d and returned on *every* failure path, so the purge's `chat-attachment-r2-delete` audit stage was **unreachable** and no attachment miss was ever recorded. It now returns a `PublicAssetDeleteResult`; the erasure adapter converts a failure into the throw the purge already audits. Its sibling `r2Delete` throws and was audited correctly — this is parity, and the other five callers are unaffected because they ignore the return value.
- **Silent no-op when `R2_PUBLIC_URL` is unset or rotated.** `parseR2Url` then stops recognising our *own* public-bucket URLs, every object falls through the "external CDN" tail, and it survived with **no log line at all**. Now logged and reported, with the env var's state in the message.
- **Wrong bucket in a docstring.** The chat note claimed `setnayan-thread-files` (private). `chat-send.ts` passes `pathPrefix: chat/<thread_id>`, which `bucketForPrefix` does not special-case, so it takes the default: **`setnayan-media`, the PUBLIC bucket**. The correction raises the stakes — a missed delete leaves an uploaded contract at a permanently public URL, not behind a presigned GET.

### Guards and tests

New `ERASURE_FILTER_COLUMNS` + check **G2b**: a phantom name in an `UPDATE`'s `.eq()` now fails in CI exactly as a phantom name in its payload does. Same blast radius (Postgres rejects the whole statement), and the new scoping columns exist in one migration each — the shape of name that goes stale first.

The **export** guardrail went red on its own, correctly: the attribution columns made both tables visible to *its* subject detector too. Neither gap is new; the visibility is. Classified honestly rather than silenced — `oauth_grants` → `DELIBERATE_EXCLUSIONS` (live bearer tokens, same rule as `api_keys`), `event_paperwork` → `KNOWN_GAPS` with `KNOWN_GAP_CEILING` **88 → 89**. The reusable lesson is written into the ceiling's own changelog: **a table with no user column is not clean, it is unread**, and one attribution column fixed over-deletion on the erasure side while exposing a silent gap on the access side.

DB suite **25 → 32** subtests; the new ones are mostly **survival** assertions, because over-deletion is invisible to a suite that only checks that data is gone. Four `event_paperwork` rows (one per scoping case) and three `oauth_grants` with three attributions are seeded, plus a second vendor's shop so over-deletion has something to hit.

Four new neutralisation probes, all measured and reverted:

| probe | mutation | result |
|---|---|---|
| **N5** | drop the paperwork `subject_user_id` filter (the shipped code) | **3 of 32 fail** — 3g co-partner's CENOMAR destroyed, 3h unattributed row destroyed, 3i joint licence destroyed. **Every deletion assertion still passes.** |
| **N6** | scope the grant delete `.in('event_id', …)` again | **2 of 32 fail** — 3j co-partner's refresh token revoked, 3l no retained-audit note left to write |
| **N7** | remove the vendor-verification purge | **1 of 32 fails** (2n) — and the *static guardrail stays green*, because it cannot see that table |
| **N8** | naive top-level `r2_key` read | **1 of 32 fails** (2n), naming `portfolio-1.jpg` — the nested array slot a known-key read misses |

`tsc --noEmit` clean (proved non-vacuous by injecting a deliberate type error and confirming it was reported) · `test:unit` 3868/3868 · `test:db` 293/293.

The other **eight DPO questions** the parent PR surfaced are untouched, as are audit-log retention (`admin_audit_log`, `admin_data_access_log`) and the `events` shared-field line.

SPEC IMPACT: `DECISION_LOG.md` — new row recording (a) the owner's per-partner erasure ruling and the fail-closed rule it implies, (b) that the user↔partner-slot mapping is a known missing primitive blocking complete self-erasure of paperwork, (c) `granted_by_user_id` as the standing attribution pattern for event-keyed credentials, (d) vendor verification documents now in erasure scope, and (e) the guardrail lesson that a table with no user column is unread, not clean.
