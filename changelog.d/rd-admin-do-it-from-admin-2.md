## 2026-10-01 · feat(admin): do it from admin — their data, the supplier record, the digest, rows 22/25/31/37

P5a part 2 of 2 (admin audit 2026-09-30).

- **Download their data (§2e).** Admin › Users › an account › Privacy tab now has
  "Download their data": the same RA 10173 file the person downloads themselves, built by
  the same code (now `lib/personal-data-export.ts`, lifted out of
  `app/api/profile/export/route.ts`). Admin-only route handler
  (`app/admin/users/[userId]/export/route.ts`, 404 for anyone else), logged in
  `admin_data_access_log`, the file says an admin prepared it, and message text is left out
  (staff never read it). Face-tag and godparent rows are scoped to the subject for BOTH
  callers (#6228's reads, moved into the builder). The Governance tab is now named Privacy.
- **Supplier record page (§3.4, row 26).** `/admin/vendors/<id>` for claimed shops: shop,
  owner, plan, team, verification, newest payouts, demo flag. Every read says "Couldn't load"
  when it fails. Integrity Watch / Repost Watch "Open supplier →" and the claimed-shop edit
  redirect land here instead of the list.
- **Morning digest (row 38).** The send is only kept as "sent" when an email was accepted;
  otherwise the claim is released. Digest emails are logged with their own kind. The switch
  moved to Settings › Notifications, next to "Last digest sent …" / "Last send failed … —
  reason" / "No digest sent yet" / "Couldn't check".
- **Row 25:** the unclaimed-supplier list no longer includes demo shops.
- **Row 22:** supplier-plan names can be renamed in the pricing catalogue.
- **Row 31:** an approved deletion whose account was never erased shows "Run erasure again";
  the confirm text now says what erasure actually does (no hard delete).
- **Row 37:** Unlock waits for a finished scan (page and server); Re-scan is shown in every
  state.

Guards: `lib/admin-do-it-from-admin.test.ts` (12 tests; 13 sabotages, all RED); export guards
re-pointed to the builder (`export-reads-are-subject-scoped`, `export-coverage-guardrail`,
`host-means-host`, `shop-contact-is-not-session-readable`, `events-private-details`).

SPEC IMPACT: None
