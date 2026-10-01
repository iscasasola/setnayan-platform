# Progress — rd/admin-do-it-from-admin-2 (admin audit 2026-09-30 PR 2 "Do it from admin")

Stopped mid-build on 2026-10-01 by the controller (moving to a cloud session). WIP commit — NOT
typechecked, NOT linted, NOT built. Only five export guards were run (all green, see below).

## Done (code written)

**(b) Data export for someone else (audit §2e)**
- `apps/web/lib/personal-data-export.ts` — the JSON builder lifted out of
  `app/api/profile/export/route.ts` (same selects, same WHY notes, moved by script). Exports
  `buildPersonalDataExport(user, supabase, preparedBy)` + `personalDataExportResponse(exported, userId)`
  + `ADMIN_PREPARED_WITHHELD`. The key-gated privileged client stays INSIDE the builder (verbatim) so
  the contact-column scanner still sees `admin = createAdminClient()`.
- Admin mode (`'setnayan_admin'`): `supabase` = service-role client, so the two reads that leaned on
  RLS alone now carry explicit subject filters (face enrollments → the subject's own
  `event_members.guest_id`s; godparents → `owner_user_id` OR a dependent they claimed). Message TEXT
  (`chat_messages_authored.body`, `samahan_messages.body`) is stripped and named in `not_included`
  (privacy wall: staff never read message text). `prepared_by` appears only on admin files, so the
  self-serve file is unchanged.
- `app/api/profile/export/route.ts` now just calls the builder (behaviour unchanged).
- `app/admin/users/[userId]/export/route.ts` — admin-gated GET (isAdminProfile, 404 otherwise),
  `admin.auth.admin.getUserById`, builds, logs `logAdminDataAccess(surface 'admin_user_data_export')`.
- `app/admin/users/[userId]/page.tsx` — "Their data" section + "Download their data" link on the
  Governance tab; tab label renamed Governance → **Privacy** (key stays `governance`);
  access-log surface keys shown as words (ACCESS_SURFACE_LABEL).
- Guards repointed from the route to `lib/personal-data-export.ts`: export-coverage-guardrail (ROUTE),
  host-means-host, shop-contact-is-not-session-readable, events-private-details (+ its .ts list).
  Ran: export-coverage-guardrail 16/16 · host-means-host 7/7 · shop-contact 7/7 ·
  events-private-details 21/21 · erasure coverage-guardrail 17/17.

**(c) Supplier record page (row 26 · §3.4)**
- NEW `app/admin/vendors/[vendorProfileId]/page.tsx` — server component; shop facts, owner link,
  plan (→ ./plan), team count (→ ./team), verification state + latest application (→ /admin/verify),
  newest 10 payouts in ConsoleTable (→ /admin/payouts?filter=all&vendor=…), demo flag; every read
  binds its error and renders "Couldn't load"; logs `admin_supplier_page` for the owner.
- integrity-watch + repost-watch (2 links) now point at `/admin/vendors/<id>` ("Open supplier →");
  `edit/page.tsx` claimed-shop redirect → `/admin/vendors/${vendorProfileId}`.
- Added to CONVERTED in `admin-console-is-one-table.test.ts`.

**(d) Digest (row 38) — PARTIAL**
- `lib/admin/digest-flush.ts`: claim is now RELEASED (restored to the previous value, conditional on
  still being our stamp) unless ≥1 email was accepted; also released on recipients-read failure / zero
  recipients; each send passes `kind: DIGEST_EMAIL_KIND` so email_deliveries records the result; a
  throwing send counts as not accepted.
- `lib/admin/digest-content.ts`: `DIGEST_EMAIL_KIND`, `DIGEST_SUBJECT_PREFIX`, pure
  `summarizeDigestSends(rows|null)` → unread / never / sent / failed.

## Not done

- (d) the READER + UI: read `email_deliveries` where `kind = 'admin_digest'` OR subject like
  `'Setnayan HQ · %'` (older digests were kind 'other'), newest first, ~20 rows, error → null; render
  "Last digest sent …" / "Last send failed … — reason" / "No digest sent yet" / "Couldn't load" at the
  top of `app/admin/settings/_surfaces/notifications-surface.tsx`; MOVE the digest switch there from
  `settings-surface.tsx` (one button "Turn on"/"Turn off", disabled when the settings read failed);
  rename `saveAdminDigest` → e.g. `switchMorningDigest` (same count) and point its redirects at
  `/admin/settings?tab=notifications&digest=…`; forward `digest`/`digest_error` from
  `app/admin/settings/page.tsx` into NotificationsSurface; no raw error.message in the UI.
- (e) row 25 `.eq('is_demo', false)` on the unclaimed read in `accounts/_surfaces/vendors-surface.tsx`.
- (e) row 22 `saveVendorRow` writes `title` (+ in `prior` select, `same` check and audit metadata);
  `catalog-editor.tsx` vendor branch gets the same title input as retail, drop "migration-owned, edit
  in code".
- (e) row 31 account-deletions: `intent=rerun` branch in `approveRequest` (load status 'approved'
  instead of 'pending', skip the mark, call deleteUser); page: users lookup also selects `deleted_at`,
  show "Run erasure again" on approved rows whose user still has `deleted_at` null (form posts to
  approveAndDelete with intent=rerun); flash map for `actioned`; honest confirm text (erasure =
  sign out + lock + wipe name/email/phone/photos + remove own records; orders/payments kept without
  name; email freed; not undoable) — see `lib/erasure/purge.ts` eraseUserAccount docblock.
- (e) row 37 editorial-review detail: Unlock only when scan_status ∈ {clean, flagged, skipped};
  Re-scan shown in every state (incl. pending/scanning); "No flags" line only after a finished scan;
  `unlockForCouple` refuses server-side while pending/scanning (no new export).
- Guards for every row (render-level, copy lib/admin-reads-are-truthful.test.ts) + sabotage each:
  planned `lib/admin-supplier-page-is-honest.test.ts`, an export guard (admin door strips bodies,
  scopes face/godparents, logs access, is admin-gated), a digest guard (claim released before
  "sent" can survive; kind passed; summarizeDigestSends unit cases), rows 22/25/31/37 guards.
- `pnpm admin:map && pnpm admin:jobs` (commit generated files); check ADMIN_NAV_DESCRIPTIONS /
  ALIASES + MODEL_CHOICE_CAP tests (dynamic routes are skipped by the map scanner, so they may not
  need entries — run the tests to see).
- changelog fragment `changelog.d/rd-admin-do-it-from-admin-2.md`.
- All checks: typecheck, root lint, every `scripts/lint-*.mjs` in ci.yml, touched tests file by file,
  server-action count (was 1225/1225 before; nothing added so far), bundle size.
- PR routine (draft, do-not-auto-merge label, disable auto-merge).

## Next step

Finish (d) reader + UI move, then (e) rows 25 → 22 → 37 → 31, then guards + sabotage, then
registries/generators, then the full check list.

## Flag for the owner

- The existing SELF-serve export reads `guest_face_enrollments` through RLS with no subject filter,
  and policy `event_member_can_read_face_enrollment` (20270920030000) lets a COUPLE read every
  enrollment on their events — so a couple's own file includes other guests' enrollment metadata.
  Left unchanged here (behaviour must not change); the admin door is scoped to the subject's own
  guest rows. Needs its own fix.
- Admin-prepared files omit message text by design (trust promise); the person gets it from their own
  download or via the DPO.
