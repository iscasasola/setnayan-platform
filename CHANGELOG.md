# Setnayan — Changelog

Append-only log of every meaningful code change. Newest at top. Each entry includes a `SPEC IMPACT` callout (even if "None") so spec-folder edits via Cowork are never missed.

---

## 2026-05-14 · fix(invitation): monogram QR thumbnails clipped in fixed-size boxes

**Commit:** [3d37ae7](https://github.com/iscasasola/setnayan-platform/commit/3d37ae7) (PR #1)

**What landed:**
- `apps/web/app/dashboard/[eventId]/invitation/page.tsx` — added `[&_svg]:h-full [&_svg]:w-full` to the three QR-thumbnail wrappers (the monogram preview card, the desktop guest-table cell, and the mobile guest-card row). The `qrcode` library bakes `width="256"` into its SVG output, so when the SVG was embedded in `h-32 w-32` / `h-16 w-16` / `h-20 w-20` containers with `overflow-hidden`, only the top-left corner of the 256-px QR was visible. The arbitrary-variant rule forces the inner `<svg>` to fill its constrained parent, matching the pattern the print sheet already uses (`.print-qr svg { width:100%; height:100% }`).
- Public landing page (`apps/web/app/[slug]/page.tsx`) unaffected — it wraps the QR in an `inline-block` with no fixed dimensions, so the SVG renders at its natural 256 px.

**SPEC IMPACT:** None — purely visual bug fix, no schema, RLS, or product-decision change.

---

## 2026-05-14 · transaction-receipt rename + /download 404 fix + remaining form-button sweep

**Commit:** to be filled after commit.

**Three things landed:**

**1. Receipts are not BIR Official Receipts — clarified app-wide.**
The system was labeling the auto-generated receipt as "Official Receipt" and citing "BIR Revenue Regulations". That overclaims: these are app **transaction receipts** for the customer's records. The actual BIR Official Receipt (where applicable) is issued separately, offline. Renames + disclaimers landed in:

- `apps/web/lib/receipts.ts` — `formatOrNumber` → `formatReceiptNumber`. The numbering prefix changed from `SR-YYYY-XXXXXX` to `TXN-YYYY-XXXXXX`. The DB column `or_serial` is unchanged (it's an internal serial; a rename would have required a migration).
- `apps/web/app/receipts/[receiptId]/page.tsx` — page title metadata "Official Receipt" → "Transaction Receipt"; the header badge says "Transaction Receipt"; the "BIR-Registered" label is removed (TIN stays, optional); footer rewritten: *"This is a system-generated transaction receipt for your records. It is NOT a BIR Official Receipt. The corresponding BIR Official Receipt is issued by Setnayan separately."*
- `apps/web/app/admin/receipts/page.tsx` — page heading "Transaction receipts"; explainer says *"not BIR Official Receipts — cross-reference with your BIR-side OR records before filing"*; table column "OR number" → "Transaction No."
- `apps/web/app/admin/settings/page.tsx` — wording on the business-identity section + TIN help text updated.
- `apps/web/app/admin/payments/actions.ts` — code comment + `maybeIssueReceipt` comment.
- `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` — "BIR-compliant OR" banner rewritten to "Transaction receipt issued — Not a BIR Official Receipt".
- `apps/web/app/terms/page.tsx` — legal text rewritten to remove BIR-compliant Official Receipt claim and explain that quoted amounts are pre-VAT base.

**2. /download was 404'ing for anonymous visitors.**
The download flow was redirecting to a GitHub Release asset URL. The repo is **private**, so anonymous downloads got 404 from GitHub. Fixed by:
- Copied the DMG into `apps/web/public/downloads/Setnayan_0.0.1_aarch64.dmg`. Vercel serves `/downloads/...` publicly with no auth.
- `apps/web/lib/desktop-release.ts` updated: `mac.aarch64.url` now points at `/downloads/Setnayan_0.0.1_aarch64.dmg` (relative).
- `apps/web/app/api/download/mac/route.ts` re-implemented as a runtime route (the previous `force-static` directive couldn't reconcile relative URLs at static-export time). Now it resolves the target URL from `request.url` and 302-redirects.
- Removed the now-broken "Release notes →" link from `/download` (the GitHub release page is also private).

**3. Form-button audit — final sweep + login-pending visibility.**
Spawned a parallel agent to do a multi-pass audit. It identified + fixed:

- Couple notifications page: "Mark all read" + "Mark read" now use `SubmitButton`.
- `/help` page contact form: "Send message" now uses `SubmitButton`.
- Vendor notifications + vendor home: equivalent buttons swept.
- `apps/web/app/globals.css`: `.button-secondary` got `disabled:cursor-not-allowed disabled:opacity-60` (matching `.button-primary` which already had it).

**SubmitButton itself was hardened** so the pending state is unmistakable, especially for fast actions like sign-in where the redirect lands ~200ms after click:
- Added `data-pending` attribute (useful for hooks + Cypress later).
- Added `cursor-wait` while pending so the cursor changes immediately on click.
- Bumped Loader2 stroke from 1.75 → 2.25 for a heavier-looking spinner.
- Empty `pendingLabel` (e.g. icon-only Send buttons) now still announces "Working…" to screen readers via `sr-only`.

**Background agent caveat:** the audit agent stalled at ~Pass 9 due to a stream watchdog timeout. Its committed-but-not-reported changes are good; the things it diagnosed but didn't yet fix were rolled into this commit (SubmitButton enhancements + the cursor-wait + sr-only fallback).

**SPEC IMPACT:** 0026 BIR receipts:
- The spec described the auto-issue as an "Official Receipt" — that wording is incorrect for V1. Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork:
  - Rename "Official Receipt" → "App transaction receipt" throughout the iteration doc.
  - Add a callout: V1 does NOT issue BIR-compliant ORs; the platform records a transaction reference for the customer, while the actual BIR OR is issued by Setnayan via its accountant / POS receipt book.
  - The OR numbering prefix changed from `SR-YYYY-NNNNNN` to `TXN-YYYY-NNNNNN`; legacy receipts (if any) keep their SR- numbers since they were already issued.
  - The math (pre-VAT base + 12% VAT added on top = gross) stays correct.

---

## 2026-05-14 · VAT direction fix + sweep of every mutating form for double-submit prevention

**Commits:** to be filled after commit.

**Two issues from the live testing pass:**

1. **VAT math was inverted.** Receipts treated the quoted order total as **VAT-inclusive gross** (back-calculating pre-VAT = total / 1.12). The actual contract is the PH B2B convention: the quoted price is the **pre-VAT base**, and VAT is **added on top**. So a ₱10,000 quote should bill the customer ₱11,200, and the OR shows pre-VAT ₱10,000 + VAT ₱1,200 + gross ₱11,200.

2. **Many submit buttons could double-fire.** During Flow A testing, a double-click on the payment-log button created two duplicate payments at +2s apart. The fix from earlier (a single `<SubmitButton>` reusable component that hooks `useFormStatus`) was applied only to the payment-log surface. Today we swept every mutating form across the app.

**What landed:**

- **VAT math (`apps/web/lib/receipts.ts`):** renamed `computeVatBreakdown(grossPhp)` → `computeVatFromBase(basePhp)`. New math: `vat = base * rate / 100; gross = base + vat`. Order's `*_total_php` columns now semantically mean **pre-VAT base** (not gross). Existing receipts in the DB are unchanged — only new receipts use the new math.
- **`apps/web/lib/orders.ts:computeOrderTotals`:** exposes `base`, `vat`, `vatRatePct`, `gross`. `headlineTotal` is now the gross (what the couple actually pays). `remaining` runs on gross.
- **Couple order detail (`/dashboard/[eventId]/orders/[orderId]`):** stat row now reads **Pre-VAT base → + VAT (12%) → Total to pay → Remaining**. Explanatory line: *"Confirmed base = ₱X. PH BIR-compliant VAT (12%) is added on top — what you actually pay is ₱X·1.12."*
- **Couple orders list (`/dashboard/[eventId]/orders`):** each card now shows the **gross** with an "incl. VAT" subscript, so couples never wonder why the line in payment-instructions is higher.
- **New-order form (`/dashboard/[eventId]/orders/new`):** field re-labeled "Your proposed budget (PHP, pre-VAT)" with explainer text.
- **Admin quote prompt (`/admin/payments` → "Orders needing a quote"):** shows the requested pre-VAT base + computed gross side-by-side: *"Requested (pre-VAT): ₱10,000 · buyer pays ₱11,200 incl. 12% VAT"*. Input now reads "Confirmed pre-VAT total (PHP)" with the same buyer-pays hint below.
- **Receipt auto-issue (`/admin/payments/actions.ts:maybeIssueReceipt`):** uses `computeVatFromBase(base)`. Pre-VAT and gross now diverge correctly; the BIR-compliant OR shows the proper breakdown.

**Form double-submit sweep — every mutating action now uses `SubmitButton`:**

| Surface | Action |
|---|---|
| `/signup`, `/login` (password + magic link) | Sign up / Sign in / Send magic link |
| `/join/[eventId]` | RSVP / Join event |
| `/[slug]` (public guest), `/[slug]/welcome` | Save RSVP / Confirm plus-one |
| `/dashboard/create-event` | Create event |
| `/dashboard/[eventId]/guests/{new,[guestId],import}` | Create / Update / Delete / Import guests |
| `/dashboard/[eventId]/messages` (couple + vendor) | Start thread / Send chat message |
| `/dashboard/[eventId]/orders/{new,[orderId]}` | Submit / Cancel order |
| `/dashboard/[eventId]/invitation` | Save monogram / Re-issue token |
| `/dashboard/[eventId]/schedule` | Add / Toggle / Delete block |
| `/dashboard/[eventId]/vendors` | Add / Update status / Delete vendor |
| `/dashboard/[eventId]/budget` | Add line item / Delete line item / Log payment / Delete payment |
| `/dashboard/[eventId]/seating` | Add table / Delete table / Assign / Unassign guest |
| `/dashboard/[eventId]/services/save-the-date` | Request template |
| `/dashboard/profile` | Save personal info / Change password / Delete account |
| `/dashboard/api-keys` | Create key / Revoke key |
| `/admin/users` | Restore / Toggle team pool / Confirm email / Reset password |
| `/admin/help` | Update status |

Each button now disables itself + shows a "Saving…" / "Logging…" / contextual pending label between click and redirect. The `useFormStatus()` hook unblocks once the server action resolves.

**Skipped intentionally** (low-risk / idempotent): Apply/filter buttons on search pages, sign-out buttons (idempotent), planner step toggles, theme/mode switchers, slug-availability checker, restart-tour, the few action toggles in profile that are pure boolean flips.

**SPEC IMPACT:** Receipts (Iteration 0026 BIR compliance):
- The spec's VAT chapter described the math without nailing direction. Today's flip is the production-correct PH B2B reading: "The quoted price is exclusive of VAT; VAT is added on top." Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork to reflect:
  - Order/quote totals are stored pre-VAT
  - The amount the customer pays is `pre_vat * (1 + vat_rate/100)`
  - The receipt always shows three lines: pre-VAT base, VAT amount, gross total
  - Receipts issued under the old math (before today) are not retroactively adjusted

---

## 2026-05-14 · public macOS download page + GitHub Release v0.0.1

**Commit:** to be filled after commit.

**What landed:**
- Published the locally built desktop bundle as **GitHub Release v0.0.1**: https://github.com/iscasasola/setnayan-platform/releases/tag/v0.0.1 (asset `Setnayan_0.0.1_aarch64.dmg`, 1.4 MB, Apple Silicon).
- New `apps/web/lib/desktop-release.ts` — single source of truth for the currently shipped desktop release (version, tag, file URL, size, publish date). Future version bumps only touch this file.
- New `apps/web/app/api/download/mac/route.ts` — 302 redirect to the GitHub Release asset. Lets the website link `/api/download/mac` indirect through this route so the underlying URL can rotate without touching every page.
- New `apps/web/app/download/page.tsx` — public install page at `setnayan.com/download`. Hero with "Download for Mac" CTA + file metadata card, 4-step install guide, Gatekeeper-warning explainer card, system-requirements card. All Apple-Silicon-only messaging; Intel Mac users get routed back to the web app.
- Homepage updated: small "On a Mac? Download Setnayan for macOS" inline link below the hero CTAs, plus a footer link.

**Operational note:** the in-app/desktop **auto-updater** is **not** wired yet. Users who download v0.0.1 will need to revisit `/download` and reinstall to get future releases. The auto-update plumbing (Tauri updater plugin + signing keypair + manifest endpoint) is a separate task — best done after Apple Developer enrollment so the signed updates flow cleanly past Gatekeeper.

**SPEC IMPACT:** None on locked decisions. The download page itself is new public surface but doesn't change any V1 contract — it just exposes the desktop wrapper Iteration 0023 already shipped (now distributable via the website instead of buried in a GitHub Actions artifact).

---

## 2026-05-14 · desktop local-build fixes (tauri scripts + Cargo.lock)

**Commit:** to be filled after commit.

**What landed:**
- `package.json` tauri scripts were passing `--manifest-path src-tauri/Cargo.toml` to `cargo tauri build` / `cargo tauri dev`. Tauri CLI doesn't accept that flag (it's a `cargo` flag, not a `cargo tauri` flag) — Tauri auto-discovers `src-tauri/`. Scripts now run plain `cargo tauri build` / `cargo tauri dev`. CI was unaffected because `.github/workflows/build-desktop.yml` invokes `tauri build` directly, not via the npm script.
- Added a `tauri:icons` script (`cargo tauri icon src-tauri/icons/icon.svg`) and chained it into `tauri:build`. Generated icons are gitignored on purpose (CI regenerates from `icon.svg`); the chain ensures the local build doesn't fail with *"failed to open icon … 32x32.png: No such file or directory"* on a fresh clone.
- Committed `src-tauri/Cargo.lock` for the first time. App crates (vs library crates) should pin transitive deps via the lockfile so every machine compiles identical bytecode.

**Verified locally:**
- `pnpm tauri:build` produced `src-tauri/target/release/bundle/dmg/Setnayan_0.0.1_aarch64.dmg` (1.4 MB) and `bundle/macos/Setnayan.app` (2.9 MB) on Apple Silicon. Ad-hoc codesigned, opens cleanly, native window loads `https://setnayan.com`.

**SPEC IMPACT:** None — packaging fix only.

---

## 2026-05-14 · desktop shell points at setnayan.com

**Commit:** to be filled after commit.

**What landed:**
- `src-tauri/shell/index.html` now redirects to `https://setnayan.com` instead of the old `setnayan-platform-web.vercel.app`. Three call sites updated (the `<meta http-equiv="refresh">`, the `<noscript>` anchor, and the JS `window.location.replace`). No other Tauri config changes — bundle identifier (`com.setnayan.desktop`), product name, and window chrome stay the same.

**Operational note (not a code issue):** the last 4 desktop builds on GitHub Actions failed with *"recent account payments have failed or your spending limit needs to be increased"*. The fix is on the GitHub billing side — see `OWNER_ACTIONS.md` (or settings at https://github.com/settings/billing/spending_limit). Once billing is unblocked, the next push will produce a `.dmg` + `.msi` pointing at the real domain.

**SPEC IMPACT:** None — Tauri shell URL change only; the spec corpus doesn't pin the redirect target.

---

## 2026-05-14 · admin payments PGRST201 fix — page was silently returning empty (backfilled)

**Commit:** [954def3](https://github.com/iscasasola/setnayan-platform/commit/954def3)

**What broke:** `/admin/payments` showed *"Nothing to reconcile"* even when the DB had 2 pending payments. Supabase quietly returned an empty array. Root cause: PostgREST error `PGRST201` — the `payments` table has two FKs to `users` (`user_id` for the buyer + `reviewed_by_user_id` for the admin reviewer), and the embedded join `user:users(email, public_id)` was ambiguous. PostgREST returned a 300-class error and the data fell through to `[]`.

**Fix:** Disambiguate the embed with the explicit FK constraint name on every Supabase select that joins through these two FKs:

- `user:users!payments_user_id_fkey(email, public_id)` on the payments query
- `user:users!orders_user_id_fkey(email, public_id)` on the orders-needing-quote query

Verified via `curl` with the service-role key — both pending payments + their joined buyer rows came back as expected.

**SPEC IMPACT:** None — implementation defect only; the spec's data model is correct.

---

## 2026-05-14 · pending-state SubmitButton + payment screenshot file upload (backfilled)

**Commit:** [07e301c](https://github.com/iscasasola/setnayan-platform/commit/07e301c)

**Two UX issues from the live Flow A test:**

1. *"When I press the Log Payment button I don't know if it is loading. Seems like I can double-click on it."* → Two duplicate `payments` rows inserted at +2 seconds apart.
2. *"Screenshot URL is not a link — it should be an upload photo."*

**What landed:**

- New reusable client component `apps/web/app/_components/submit-button.tsx`. Hooks `useFormStatus()` from `react-dom` to:
  - Disable the button while the server action is pending (`disabled + aria-busy`).
  - Swap content for a `Loader2` spinner + customizable `pendingLabel` ("Logging…", "Approving…", "Saving…", etc.).
- Wired into the payment-log, approve, reject, confirm-quote, settings-save, QR-upload, QR-remove, and create-order surfaces immediately.
- Payment screenshot input flipped from `<input type="url">` to `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif">`. Form now uses `encType="multipart/form-data"`. Server action `logPayment` parses the file from FormData and uploads via the existing `uploadPublicAsset()` helper to the `platform-assets` bucket under `payment-screenshots/<order_id>/`. Returns the public URL into `payments.screenshot_url`.
- Raised Supabase bucket size cap + added HEIC MIME (iPhone Live-Photo default).
- Raised Next.js `experimental.serverActions.bodySizeLimit` to `'6mb'` so iPhone screenshots survive the multipart hop.

**SPEC IMPACT:** None on locked decisions. UX hardening only.

---

## 2026-05-14 · manual password reset workflows — Phase 2 (Resend) bypass (backfilled)

**Commit:** [b556a6c](https://github.com/iscasasola/setnayan-platform/commit/b556a6c)

**Why:** The owner chose to skip Resend email setup pre-launch (cost/quota concerns). Without a transactional email provider, the Supabase magic-link / password-reset emails don't go out. To unblock users, two manual workflows were added.

**What landed:**

- **Admin-initiated:** new server action `resetUserPassword(formData)` in `apps/web/app/admin/users/actions.ts`. Calls `supabase.auth.admin.updateUserById(targetUserId, { password: tempPassword })` with a freshly-generated 12-char alphabet (Crockford-style; no 0/O/1/I/l). Redirects to `/admin/users?temp_password=<...>&for_email=<...>` so the admin sees the password once in an amber banner.
- **User self-service:** new section on `/dashboard/profile` ("Change password") with two `<input type="password">` fields. Server action `changePassword` validates the match, calls `supabase.auth.updateUser({ password })`. Session stays alive; new password takes effect on next sign-in.
- `OWNER_ACTIONS.md` updated: Phase 2 (Resend) marked DEFERRED. Phase 2A documents the admin reset path. Phase 2B is the "wire Resend later" note.

**SPEC IMPACT:** None on platform contract — both flows use existing Supabase Auth primitives. The deferred Resend integration only blocks the *self-service* email-based reset; admin-initiated reset is fully functional.

---

## 2026-05-14 · admin mobile polish

**Commit:** to be filled after commit.

**What landed:**
- `/admin/users`: hid the Account ID column below `lg` (`hidden lg:table-cell`) and the Created column below `md`; updated the empty-state `colSpan` from 6 → 4 to match the visible-on-mobile column count.
- `/admin/events`: hid Venue + Slug below `md` and the internal Event ID below `lg`; updated the empty-state `colSpan` from 6 → 3.
- `/admin/receipts`: hid the Issued date below `md` and the Pre-VAT + VAT columns below `lg`. (Stat tiles already use `grid-cols-2 sm:grid-cols-4` and the OR-number / Customer / Gross columns stay visible on mobile.)
- `apps/web/app/admin/layout.tsx`: kept the tab nav scrollable horizontally and added `shrink-0` to each `AdminTab` plus `whitespace-nowrap` on the nav so tabs don't squish/wrap on narrow viewports. Native scrollbar is hidden on WebKit/FF/MS for a cleaner look.

No DB changes. No behavior changes beyond responsive styling. All other admin surfaces (`/admin`, `/admin/payments`, `/admin/vendors`, `/admin/help`, `/admin/settings`) already used card-grid layouts and already responded to viewport width.

**SPEC IMPACT:** None — this is pure responsive styling; no schema, no contract, no copy changes. The admin console is still V1 MVP (Iteration 0023 surface).

---

## 2026-05-13 · PRE-LAUNCH SPRINT COMPLETE — 19 iterations + 2 polish rounds

**Summary commit reference:** see git log on `main` for the per-iteration commits. New consolidated handoff at `HANDOFF.md`.

This session shipped, in order:

| Iteration | Surface | Migration |
|---|---|---|
| 0021 | Couple dashboard rework: 4 themes, Lucide icons, new Home, Guided Planner | `20260513070000_iteration_0021_planner.sql` |
| 0015 | Public marketing landing at `/` (hero + features + roadmap + footer) | — |
| 0010 | Mood Board with venue/couple/role palette families | `20260513080000_iteration_0010_mood_board.sql` |
| 0008 | Seating chart (tables + assignments + drag-place floor plan) | `20260513090000_iteration_0008_seating.sql` |
| 0006 | Vendors couple-side tracker (28-category enum + 6-stage status) | `20260513100000_iteration_0006_vendors.sql` |
| 0007 | Budget & expenses (line items + payments + `.ics` export) | `20260513110000_iteration_0007_budget.sql` |
| 0022 | Vendor sign-up + profile editor (Pattern A RLS) | `20260513120000_iteration_0022_vendor_dashboard.sql` |
| 0019 | Couple↔vendor 1:1 chat with identity masking | `20260513130000_iteration_0019_communications.sql` |
| 0023 | Admin console (Overview · Users · Events · Vendors) | — |
| 0025 | Profile settings (editable info + RA 10173 export + soft-delete) | `20260513140000_iteration_0025_profile_settings.sql` |
| 0034 | Orders + payments + manual reconciliation queue | `20260513150000_iteration_0034_payments.sql` |
| 0028 | In-app notifications with cross-action emits | `20260513160000_iteration_0028_notifications.sql` |
| 0029 | Help Center FAQ + contact form + admin inbox | `20260513170000_iteration_0029_help_center.sql` |
| 0030 | Guided welcome tour (couple + vendor slide carousels) | `20260513180000_iteration_0030_guided_tour.sql` |
| 0031 | Day-of-guest event schedule + live "happening now" widget | `20260513190000_iteration_0031_schedule.sql` |
| 0033 | Public API foundation (api_keys + bearer auth + stubs) | `20260513200000_iteration_0033_api_gateway.sql` |
| 0024 | Save the Date 12-template gallery → orders flow | — |
| 0026 | BIR-compliant auto-issued Official Receipts | `20260513210000_iteration_0026_bir_tax_compliance.sql` + `20260513220000_iteration_0026_drop_or_number.sql` |

Plus 2 polish rounds: empty states, mobile compaction, navigation tightening, header bell, vendor subnav hoist, admin "restore deleted account".

**SPEC IMPACT (consolidated):**

Most of the SPEC IMPACT callouts in earlier per-iteration changelog entries still stand — please walk the spec corpus at `~/Documents/Claude/Projects/Setnayan/04_Iterations/` via Cowork and reconcile each affected file:

- `0006_vendors_management.md` — lock the 28-entry `vendor_category` enum, record the 6-stage flow + flag the payment-milestones / crew-meals deferrals
- `0007_budget_expenses.md` — V1 ships add+delete only (no edit), per-vendor line items are couple-defined (not the spec's "3-line template"), `.ics` is one-shot download (not subscribable feed yet)
- `0008_seating_chart_editor.md` — V1 = list + drag-place; ring auto-fill + publish-QR still deferred
- `0010_mood_board.md` — Reception 3-6, Bride/Groom palettes added, role palettes conditional on guest presence, 20-theme library deferred, Setnayan Guide rule engine deferred
- `0015_main_website.md` — EN-only V1, no Event Palette preview yet, copy is starter draft
- `0019_communications.md` — V1 = 1:1 page-refresh chat with identity masking. Realtime, group, video (Daily.co), file viewers, coordinator-join all deferred. **Identity masking rule locked**: vendors see event.display_name + event_date only — never couple email or personal name
- `0021_couple_dashboard_fully_purchased.md` — record the 4 theme palette RGB triplets (Setnayan Default `#FAF7F2`/`#1A1A1A`/`#C97B4B`, Victorian `#F5EBD9`/`#2E1A1A`/`#8B1E3F`, Classy `#F4F4F2`/`#0F0F0F`/`#A38560`, iOS `#F2F2F7`/`#000000`/`#007AFF`); 9 planner step keys (set_date, pick_venue, build_guests, customize_invite, set_slug, send_invites, book_vendors, finalize_seating, after_event)
- `0022_vendor_dashboard.md` — V1 ships 1 of 6 surfaces (profile editor only). Logo upload, public vendor page at `/v/[slug]`, bookings linkage to couple-side event_vendors, chat identity masking (waits on 0019 ✅ now shipped), settings/payouts all deferred
- `0023_admin_console.md` — V1 ships 3 of 7 surfaces (Users, Events, Vendors). Two-admin approval queue, audit log, system health, settings, reports all deferred. Document the `notFound()` (not `redirect`) pattern for non-leakage of admin URL existence
- `0024_save_the_date.md` — V1 ships gallery + order request flow (manual production via 0034); Remotion render pipeline + LUT grading + customer clip uploads to R2 all deferred. 12 templates shipped, 30 in spec
- `0025_profile_settings.md` — V1 ships Personal info edit + RA 10173 export + soft-delete. Hard delete + face-data revocation (waits on 0012 Papic) + payment methods (waits on 0034) deferred
- `0026_bir_tax_compliance.md` — VAT-inclusive math (12% default), `or_serial` BIGINT from atomic sequence (display string `SR-YYYY-NNNNNN` composed at read-time), one OR per order. Hard-coded `TIN: 000-000-000-000` placeholder in receipt header **must** be replaced before any real receipts go out — see `HANDOFF.md` § Owner action items
- `0028_email_notifications.md` — V1 = in-app only; email delivery via Resend deferred. Schema is ready; a notification-to-email worker is a small follow-on once Resend SMTP is wired
- `0029_help_center.md` — 22 FAQ articles hardcoded in `apps/web/lib/help.ts`; CMS, AI search, multi-language all deferred. Anyone (anon + authenticated) can INSERT a `help_messages` row
- `0030_guided_tour.md` — V1 = 4–6 slide carousel per role (couple + vendor); element-highlighting tour deferred. Restart via Profile
- `0031_day_of_guest.md` — schedule blocks + live widget shipped; message wall + photo wall + live broadcast banner all defer to R2 wiring
- `0033_public_api_foundation.md` — gateway + key management + 2 stub endpoints (`/api/v1/health` public, `/api/v1/me` auth-gated). Scopes, rate limiting, OAuth, webhooks all deferred. **Public contract** — additions to `/me` response shape need SPEC IMPACT review since they become a stability contract
- `0034_payments_and_cart.md` — V1 ships single-order request flow (no cart) + 4-tier fuzzy SQL matcher replaced with simple substring-reference check; BDO/GCash QR images deferred (instructions only)

**Outstanding (genuinely blocked on owner action):**
- `0032_contract_intelligence.md` — LLM API key + R2 upload not yet provisioned
- `0035_observability.md` — Sentry, PostHog, Better Stack accounts not yet provisioned

See `HANDOFF.md` for the full owner action checklist and verification path.

---

## 2026-05-13 · 0023 admin console MVP — overview + users + events + vendors

**Commits:** to be filled in once committed.

**What landed:**
- No schema changes — admin uses the existing `users.is_internal` / `users.is_team_member` flags (set in Sprint 0) plus the service-role client to read across all tables regardless of RLS.
- New `/admin` route tree:
  - **Layout** (`apps/web/app/admin/layout.tsx`) — auth-gates the entire subtree. Allows users where `is_internal=TRUE OR is_team_member=TRUE OR account_type='admin'`. Non-admins get `notFound()` (404) rather than a redirect, so the admin URL doesn't leak its existence. Header shows a badge (🟣 Internal · 🟢 Team Pool · Admin) per the user's flag.
  - **Overview** (`/admin`) — 8-tile stats strip (all users · couples · vendor users · events · vendor profiles · chat threads · 🟣 internal · 🟢 team pool) from service-role `count: 'exact', head: true` queries. Below: 4 navigation cards (Users · Events · Vendors · disabled Approval queue placeholder).
  - **Users** (`/admin/users`) — server-rendered table, latest 200 rows. Search by email/display_name/public_id (single `or(…ilike…)` query). 5-way filter (all / customer / vendor / internal / team pool). Each non-internal row gets an "Add to pool" / "Remove from pool" button that flips `is_team_member` via `requireAdmin()`-guarded server action. Internal accounts (e.g., the owner) show a locked label — they shouldn't be flipped by admins.
  - **Events** (`/admin/events`) — 200-row table sorted by event_date ascending, with a live guest count per event (single secondary query that batches by `IN`), search across display_name/slug/public_id, optional "include archived" toggle.
  - **Vendors** (`/admin/vendors`) — vendor profile cards in a 3-col grid: avatar (logo URL or initials), published-vs-draft pill, tagline, contact_email, location, first three services, public_id. Search across name/slug/email/public_id + 3-way filter (all / published / draft).
- New `requireAdmin()` helper in `apps/web/app/admin/users/actions.ts` — checks the calling user's flags via the regular Supabase client (under RLS) before doing service-role writes.
- Profile page (`/dashboard/profile`) gains an "Admin console ↗" button that only renders for `is_internal || is_team_member || account_type='admin'`. The button is the canonical entry point to `/admin`.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0023_admin_console.md` — record V1 MVP scope (3 of 7 surfaces) and flag deferred sub-scopes:
  - **Approval queue:** spec calls for a **two-admin approval workflow** for sensitive actions (refunds, account deletes, etc.). V1 doesn't define the underlying state machine — needs spec on which actions require two-admin approval and the queue UX (request → approve → execute).
  - **Audit log:** an `audit_log` table that records who did what when. Needed before any "approval queue" can resolve disputes. Schema-design + trigger plumbing is a follow-on.
  - **System health:** Supabase / R2 / Vercel metrics dashboard. Waits on iteration 0035 (observability) which wires Sentry / PostHog / Better Stack.
  - **Settings:** platform-wide configuration (Setnayan brand strings, default theme, feature flags). Currently those live in `brand.config.ts` and env vars; admin-editable settings would need a `settings` table.
  - **Reports:** GMV / vendor activity / payment reconciliation. Waits on iteration 0034 (Payments & Cart) for the underlying data.
- The `requireAdmin()` pattern is intentionally **not** an RLS helper. The admin console reads via the service_role client and bypasses RLS; authorization is enforced at the route layer. Document this in `02_Specifications/RLS_Policy_Pattern.md` — service-role usage outside scripted/server-side flows should be the exception, not the rule. The admin console is a deliberate exception.
- **Non-leakage choice (record explicitly):** the admin route uses `notFound()` for unauthorized users, not `redirect('/dashboard')`. This keeps the existence of `/admin` invisible to the public. Future admin-only routes should follow the same pattern.

**Deferred:**
- Two-admin approval queue (needs state-machine spec)
- Audit log (`audit_log` table + triggers on sensitive tables)
- System health / observability surface (waits on 0035)
- Settings / feature flags surface
- Reports / GMV / vendor performance dashboards
- Bulk operations (mass-archive, mass-delete, etc.) — V1 admin is read-mostly + per-row flag flip
- Impersonation ("view as user X") — a future debug aid

---

## 2026-05-13 · 0019 communications MVP — couple↔vendor 1:1 chat + identity masking

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513130000_iteration_0019_communications.sql`:
  - **New helper** `public.current_vendor_profile_ids()` — `SECURITY DEFINER STABLE` SETOF UUID of the calling user's vendor_profile_ids. Mirrors `current_couple_event_ids()` for vendor-side RLS.
  - **chat_sender_role** enum: `couple` · `vendor` · `coordinator` (third value reserved for the future "coordinator-join" feature).
  - **chat_threads** — `thread_id` PK, `public_id` (`S89H-…`), event FK + vendor_profile FK with **UNIQUE(event_id, vendor_profile_id)** so re-tapping "Start thread" resumes the same conversation. `created_by_user_id` FK to users (SET NULL on delete). Dual-side RLS: either party can read + write.
  - **chat_messages** — `message_id` PK, thread + event + vendor_profile + sender FKs, `sender_role`, body (1–4000 chars), `created_at`. RLS allows SELECT for either party but only INSERT (no UPDATE/DELETE policy ⇒ messages are append-only).
  - **Trigger** `on_chat_message_inserted` bumps `chat_threads.updated_at` to the new message's `created_at` — keeps thread lists ordered by recency without explicit writes from the app.
- New `apps/web/lib/chat.ts` — types + `fetchCoupleThreads` (joins `vendor_profiles` for business_name/logo) + `fetchVendorThreads` (joins `events` for the masked display_name+date) + `fetchThreadById` + `fetchMessages` + `formatChatTimestamp` (same-day vs older).
- New shared server action `apps/web/lib/chat-actions.ts:sendChatMessage` — looks up whether the current user is the couple or the vendor on the thread, tags the message with that role, and inserts. One action serves both `/dashboard/[eventId]/messages/[threadId]` and `/vendor-dashboard/messages/[threadId]`.
- Couple-side surfaces:
  - `/dashboard/[eventId]/messages` — thread list (avatar from vendor logo OR initials fallback) + start-by-vendor-email form. The form upserts on `(event_id, vendor_profile_id)` and redirects to the thread.
  - `/dashboard/[eventId]/messages/[threadId]` — header with vendor name + tagline, message stream (right-aligned terracotta bubbles for the couple's own messages, left-aligned ink bubbles for the vendor's), composer with Send button.
- Vendor-side surfaces (identity masking):
  - `/vendor-dashboard/messages` — thread list showing **only the event's display_name + event_date** — never the couple's email or personal name. Empty state nudges the vendor to fill in their contact_email so couples can find them.
  - `/vendor-dashboard/messages/[threadId]` — mirrored thread detail; sender label shows "You" for vendor messages, the masked event name for couple messages.
  - Small Profile / Messages subnav on both vendor pages.
- New `MessageSquare` tile on the couple Home grid (4×2 layout: Guests · Invitation · Vendors · Budget · **Messages** · Seating · Mood Board · Services).

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0019_communications.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Realtime delivery (Supabase Realtime):** V1 = page refresh on send. The schema is Realtime-ready (chat_messages has a simple insert pattern); a follow-on client component subscribing via `supabase.channel(...)` ships when needed.
  - **Group chat / multi-vendor threads:** V1 is strict 1:1. A follow-on would add a `chat_thread_members` join table.
  - **Video meetings (Daily.co):** spec calls for video. Daily.co integration requires API keys + a room-creation server route + an embed UI. Deferred — needs owner sign-off on Daily.co account.
  - **File attachments + viewers:** spec calls for PDF / image viewers in-thread. Waits on R2 upload UI (also a 0022 follow-on).
  - **Coordinator-join:** spec calls for a coordinator (3rd party) joining a thread. Schema reserves `'coordinator'` in `chat_sender_role` enum; no UI plumbing yet.
- **Identity masking rule (record explicitly):** vendors **MUST NOT** see couples' emails or personal names. They see the event's `display_name` + `event_date` only. The couples deliberately controlled what they put in `events.display_name` — for some couples that's "Maria & Juan", for others it's "Event #12". This is the user choice that V1 respects. Future surfaces (e.g., the BookingsSurface in 0022) should follow the same rule.
- The `current_vendor_profile_ids()` helper joins `current_couple_event_ids()` as a load-bearing canonical helper. Both should be documented in `02_Specifications/RLS_Policy_Pattern.md` § 4.

**Deferred:**
- Supabase Realtime subscription (currently page-refresh after send)
- Group / multi-party threads
- Video meetings (Daily.co)
- File attachments + in-thread viewers
- Coordinator-join
- Read receipts, typing indicators, push notifications
- Search across threads
- Linking from `event_vendors` (couple's tracked vendor row) to a `chat_threads` (still requires email-based lookup)

---

## 2026-05-13 · 0022 vendor dashboard MVP — sign-up + profile editor

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513120000_iteration_0022_vendor_dashboard.sql`:
  - `vendor_profiles` table — one row per vendor user. `vendor_profile_id` PK, `public_id` (`S89B-…` — B for business), `user_id` FK to public.users UNIQUE, business_name + business_slug (case-insensitive UNIQUE partial index), tagline, logo_url, services TEXT[], location_city, website, contact_email/phone, is_published, timestamps. Pattern A RLS (owner-only).
  - **Updated** `handle_new_auth_user()` trigger function: reads `NEW.raw_user_meta_data->>'account_type'`; if set to 'customer' or 'vendor', uses that enum value. Default stays 'customer'. The trigger itself isn't recreated — CREATE OR REPLACE FUNCTION updates the body in place.
  - **New** `handle_new_vendor_user()` trigger on `public.users` AFTER INSERT — when account_type='vendor' lands, auto-create a starter `vendor_profiles` row so the dashboard never opens to a missing record.
- Signup form (`apps/web/app/signup/page.tsx`) gains a Couple / Vendor radio choice at the top of the form (defaults to Couple).
- Signup action (`apps/web/app/signup/actions.ts`) now passes `data: { account_type }` to `supabase.auth.signUp()` so the trigger picks it up from `raw_user_meta_data`.
- Couple dashboard (`/dashboard`) layout reads `account_type` along with theme; if vendor, redirects to `/vendor-dashboard`.
- New `/vendor-dashboard` route tree:
  - Layout (`apps/web/app/vendor-dashboard/layout.tsx`) — auth-gated, redirects non-vendors out, mirrors the dashboard chrome (brand mark, name, sign-out). Theme honors the same `users.theme_preference` setting.
  - Page (`apps/web/app/vendor-dashboard/page.tsx`) — profile editor: completion progress bar with missing-field hint, mandatory-logo warning when no logo URL, all fields (business name + slug + tagline + logo URL + services CSV + city + website + contact email/phone), published checkbox, save button.
  - Action (`apps/web/app/vendor-dashboard/actions.ts`) — `saveVendorProfile`. Validates slug format, splits services on commas (≤ 12 items, each ≤ 48 chars), writes to vendor_profiles.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0022_vendor_dashboard.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Six surfaces:** spec calls for 6 vendor-side surfaces. V1 ships **1** (profile editor). Follow-ons:
    - Portfolio gallery (needs R2 upload UI)
    - Public vendor profile at `/v/[slug]` (needs marketplace surface)
    - Bookings — events where couples have added you to their `event_vendors` (needs link between `event_vendors.vendor_name` and `vendor_profiles.user_id` — currently no FK, vendor name is free-form on couple side)
    - Communications (waits on iteration 0019)
    - Settings · payouts (waits on 0034 payments)
  - **Mandatory logo:** spec calls for required logo. V1 only warns + flags in the completion bar; doesn't block save. When the public vendor surface ships, `is_published=true` should require a `logo_url`.
  - **Chat identity masking:** spec calls for vendors seeing couples as anonymous identities. Belongs in iteration 0019 (communications); no plumbing yet.
  - **Couple ↔ vendor linkage:** spec implies vendors can see events they're working. Currently `event_vendors` (couple-side, iteration 0006) stores `vendor_name TEXT` with no FK to `vendor_profiles`. A follow-on should add `event_vendors.vendor_profile_id UUID NULL` so couples can "tag" a tracked vendor as an existing Setnayan vendor.
- The `account_type` enum stays `('customer', 'vendor', 'admin')`. "customer" remains the codename for couples (Sprint 0 choice).

**Deferred:**
- Logo + portfolio file upload (R2)
- Public vendor profile page (/v/[slug])
- Bookings surface
- Chat with couples (waits on 0019)
- Settings / payouts
- Vendor marketplace / search
- Couple-side "claim this vendor" flow

---

## 2026-05-13 · 0007 budget MVP — line items + payment log + .ics export

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513110000_iteration_0007_budget.sql`:
  - `event_vendor_line_items` — `line_item_id` PK, event/vendor FKs, `label` (1–64 chars), `amount_php` NUMERIC(12,2) ≥ 0, `due_date` DATE nullable, `sort_order`, timestamp.
  - `event_vendor_payments` — `payment_id` PK, event/vendor FKs, optional `line_item_id` FK (SET NULL on delete so a deleted line item doesn't nuke its payment history), `amount_php` > 0, `paid_at` DATE default `CURRENT_DATE`, optional `method`/`reference`/`notes` TEXT.
  - Pattern B RLS on both tables via the canonical `current_couple_event_ids()` helper.
- New `apps/web/lib/budget.ts` — types, `fetchBudgetSnapshot` (joins vendors + line items + payments per event), per-vendor + global totals (budget, paid, remaining, "due in 30 days"), and `renderBudgetIcs` that emits RFC 5545 `VCALENDAR` with CRLF line endings, proper TEXT escaping (`\\` / `\\;` / `\\,` / `\\n`), `DTSTART;VALUE=DATE:` for all-day events, and skips line items that are already fully paid.
- New server actions in `apps/web/app/dashboard/[eventId]/budget/actions.ts`: `addLineItem`, `deleteLineItem`, `logPayment`, `deletePayment`. All validate money / date / label format on the server before the DB write.
- New `/dashboard/[eventId]/budget` page replaces the placeholder. Top: stats strip (4 tiles) and the "Export upcoming dates (.ics)" button. Body: one card per vendor with a per-vendor stats row (budget · paid · remaining), a Line items column with inline add form, a Payments column with inline log form (defaults to today, can attribute to a specific line item or be generic).
- New `GET /api/budget/[eventId]/ics` route handler — authenticated via Supabase cookie; returns `Content-Type: text/calendar` with `attachment` disposition (`setnayan-<event-slug>-budget.ics`). Calendar clients (Google Calendar, Apple Calendar) ingest this directly.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0007_budget_expenses.md` — record V1 MVP scope:
  - **Line items:** spec mentioned "3 line items per vendor (Package · Crew Meal · Transportation)" as the suggested default. V1 lets couples create *any number* of line items per vendor with *any label*; the schema doesn't bake in the 3-line template. The spec doc should be updated to reflect this flexibility, or — if the owner prefers — V1 should be amended to constrain to 3 items.
  - **Calendar feed vs download:** spec calls for ".ics calendar export". V1 ships a **one-shot authenticated download** rather than a subscribable feed. A subscribable feed requires a per-event public token + a public route that bypasses the auth cookie; that's a follow-on (would land alongside the public-API gateway in 0033).
  - **Setnayan platform costs auto-populate:** the spec called for in-app purchases from 0034 (Payments & Cart) to flow into the budget automatically as a "Setnayan" vendor. V1 leaves this manual — couples can create a "Setnayan platform" vendor and log Setnayan transactions there. Auto-population lands when 0034 ships.
- The `current_couple_event_ids()` helper is now load-bearing for **SEVEN** surfaces (event_members, event_journey_steps, event_tables, event_seat_assignments, event_vendors, event_vendor_line_items, event_vendor_payments). Definitively canonical.

**Deferred:**
- Editing line items / payments (V1 supports add + delete only)
- Receipt / proof-of-payment file upload (would land alongside R2 wiring for vendor contracts)
- Multi-currency
- Subscribable .ics URL with per-event token
- Auto-import from iteration 0034 payments
- Charts / visualizations / month-over-month spending

---

## 2026-05-13 · 0006 vendors MVP — couple-side tracker (28 categories, 6-stage readiness)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513100000_iteration_0006_vendors.sql`:
  - `public.vendor_category` enum — **28 canonical PH wedding service categories** straight from the spec (venue, catering, photographer, videographer, florist, cake_maker, host_emcee, band_dj, string_quartet, choir, officiant, planner_coordinator, makeup_artist, hair_stylist, gown_designer, suit_designer, rings, invitations_stationery, transportation, lights_and_sound, led_screens, photobooth, mobile_bar, church_fees, reception_decor, security, gifts_and_giveaways, misc).
  - `public.vendor_status` enum — 6-stage readiness flow: `considering` → `shortlisted` → `contracted` → `deposit_paid` → `delivered` → `complete`.
  - `event_vendors` table — `vendor_id` PK, `public_id` (`S89V-…`), event FK, category, vendor_name, contact_email/phone, status, total_cost_php (NUMERIC 12,2), deposit_paid_php, notes, timestamps. CHECK constraints enforce non-negative money + deposit ≤ total.
  - Pattern B RLS: couples on the event read + write.
- New `apps/web/lib/vendors.ts` — types, label/tone maps, `fetchEventVendors`, `computeVendorStats`, `formatPhp` PHP formatter (no decimals for clean display).
- New server actions: `createVendor`, `updateVendorStatus`, `deleteVendor`.
- New `/dashboard/[eventId]/vendors` page replaces placeholder:
  - **Stats strip** — 4 tiles: Vendors / Total cost / Deposits paid / Remaining. Remaining tile goes terracotta when > 0.
  - **Add a vendor** (collapsed `<details>` block) — full form: name, category, email, phone, total cost, deposit paid, notes.
  - **Status filter chips** — All + 6 status chips with live counts, query-string driven (`?status=contracted`).
  - **Vendor cards** (2-col on lg+) — name + category, status pill, contact links (mailto/tel with Lucide icons), money breakdown (Total / Deposit / Remaining color-tinted), notes block, status updater dropdown + delete.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0006_vendors_management.md` — record V1 MVP scope (couple-side tracker only) and flag deferred sub-scopes:
  - **Payment milestones (3-line spec):** the spec calls for 3 itemized payments per vendor (e.g., deposit, balance, tip). V1 collapses this to `total_cost_php` + `deposit_paid_php`. A follow-on migration would add an `event_vendor_payments` table.
  - **Crew meals:** spec calls for tracking how many staff meals each vendor needs (caterer needs to plate them). Add a `crew_meals` integer column in a follow-on.
  - **Vendor-side profiles:** the vendor's own dashboard (logo, portfolio, chat identity masking) is iteration 0022.
  - **Public vendor catalog/marketplace:** searchable vendor list with reviews — out of V1 scope.
- The 28-entry `vendor_category` list should be **locked** in the spec — once couples have data tied to these enum values, renaming any is a breaking migration. Confirm with owner via Cowork that these match the canonical PH wedding-vendor taxonomy.

**Deferred:**
- Payment milestones (3 line items per vendor)
- Crew meals tracking
- Meeting/contact log per vendor
- Contract upload (R2)
- Communications thread (waits on 0019)

---

## 2026-05-13 · 0008 seating chart MVP — tables + assignments (list-based, not drag-place)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513090000_iteration_0008_seating.sql`:
  - `public.table_type` enum with **13 catalog entries** straight from the spec: `round_8`, `round_10`, `round_12`, `rectangle_6`, `rectangle_8`, `rectangle_10`, `long_12`, `long_16`, `sweetheart_2`, `head_table`, `crescent_8`, `crescent_10`, `custom`.
  - `event_tables` — `table_id` PK, `public_id` (`S89T-…` via generator), `event_id` FK, `table_label`, `table_type`, `capacity` CHECK 1..32, `x_pos`/`y_pos` reserved nullable for the future drag editor, `sort_order`, timestamps. Pattern B RLS: couples on the event read + write.
  - `event_seat_assignments` — `(event_id, guest_id) UNIQUE` so a guest can only be at one table; cascades from both events and guests. Pattern B RLS.
- New helpers in `apps/web/lib/seating.ts` — `TABLE_TYPE_CATALOG` (single source of truth for labels + default capacities), `fetchTables`, `fetchAssignments`, `computeSeatingStats`.
- New server actions in `apps/web/app/dashboard/[eventId]/seating/actions.ts`: `createTable`, `deleteTable`, `assignGuest` (upsert with `onConflict: 'event_id,guest_id'`), `unassignGuest`.
- New page at `/dashboard/[eventId]/seating` replaces the placeholder. Layout:
  - **Stats strip** — 4 tiles (tables / total capacity / assigned / unassigned). Unassigned tile goes terracotta when > 0.
  - **Add table form** — label + 13-option type picker + capacity (1–32), one Add button.
  - **Table cards** (2-col grid on sm+) — each card has label, type, fill counter (`5 / 10`, green at full, rose if overfilled), delete button, assigned-guests list with per-row remove button, and an inline guest picker that only shows when there's capacity left and unassigned guests exist.
  - **Unassigned guests** — chip list (first 60, then +N more) at the bottom.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0008_seating_chart_editor.md` — record V1 MVP scope (list-based editor) and flag three deferred sub-scopes:
  - **Free-placed editor:** drag-place tables on a stage canvas. Schema reserves `x_pos`/`y_pos` columns so this becomes a UI-only follow-on.
  - **Role-tier ring auto-fill:** algorithm that suggests assignments based on role hierarchy (head table = wedding party + parents; ring 1 = principal sponsors; ring 2 = family; etc.). Needs algorithm spec.
  - **QR-on-publish print pack:** publish flow that snapshots assignments and generates a per-table QR + a printable seat chart for the venue. Needs publish-state model (current seating is always "live").
- Pattern B helper `current_couple_event_ids()` is now load-bearing for FIVE surfaces (event_members write, event_journey_steps, role_palette indirectly via events, event_tables, event_seat_assignments). Should be promoted from "fix" to "canonical" in `02_Specifications/RLS_Policy_Pattern.md` § 4 helper list.

**Deferred:**
- Drag-place stage canvas
- Auto-fill ring algorithm
- Publish snapshot + per-table QR + printable seat chart
- Seat-level assignments (current model assigns to table, not seat number — `seat_number` column is reserved nullable)
- Bulk assign (e.g., "seat the whole maid_of_honor cohort at Table 2")

---

## 2026-05-13 · 0010 mood board MVP — per-role palette only

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513080000_iteration_0010_mood_board.sql` adds `events.role_palette` (JSONB, default `'{}'`) and `events.mood_board_updated_at` (timestamptz). The JSONB shape is `{ <role_group>: "#RRGGBB" }` with six allowed keys: `wedding_party`, `principal_sponsors`, `secondary_sponsors`, `bearers_flower_girl`, `officiants`, `other_roles`. App-side validation in `apps/web/lib/mood-board.ts` (`sanitizeRolePalette`) drops unknown keys and bad hex.
- New page at `/dashboard/[eventId]/services/mood-board` (takes precedence over the catch-all `[service]` placeholder for this slug only). Renders six labeled rows, each with a native `<input type="color">` and a swatch preview. Save submits to `saveRolePalette` server action which sanitizes, writes `role_palette` + `mood_board_updated_at`, and revalidates the event layout.
- The Guest List role chips now consume `event.role_palette`: when a palette entry exists for the role's group, the chip renders a 2-px ring-bordered colored dot before the role label. Falls back to the existing Tailwind-tinted chip backgrounds when no palette is set. Both desktop table and mobile card list pass the palette down.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0010_mood_board.md` — record MVP scope (per-role hex palette only) and flag three deferred sub-scopes that need spec input before they can ship:
  - **20-theme curated library:** named themes (e.g., "Cebu Sunrise", "Manila Old World", "Mountain Lodge") and their per-role palettes — needs design + content from owner.
  - **Setnayan Guide rule engine:** cohesion / contrast / temperature / saturation / cultural-defaults scoring algorithm — needs algorithm spec (formulas, thresholds, what gets flagged at what score).
  - **Venue palette extraction:** auto-derive a palette from venue photos via color quantization — needs upload pipeline + heuristics spec.
- The chip dot is a "visual signal" choice, not a "replace the chip tint" choice — kept the existing Tailwind tints so the page doesn't depend on dynamic class generation. Record this trade-off in the spec so a later revision can intentionally swap to dynamic-class chip tints if desired.

**Deferred:**
- Save palettes as named "moods" the couple can swap between (no separate `event_moods` table yet)
- Live preview of palette applied to a sample invitation
- Export palette as a downloadable swatch sheet for vendors

---

## 2026-05-13 · 0015 main website MVP — public landing rebuilt

**Commits:** to be filled in once committed.

**What landed:**
- `/` was a 45-line placeholder; it now renders a full single-page marketing landing:
  - **Top nav** with brand mark, Sign in (text), and Create account (primary button).
  - **Hero** with the `Set na 'yan.` tagline, a longer-form subhead, dual CTAs (Start planning / I already have an account), and a device mock on the right that previews the actual couple-home design (greeting, stage strip, NEXT UP card, mini nav grid). The device mock uses the same Tailwind tokens as the real Home page, so when 0021 themes change the home, the mock changes with it (couples checking the landing while logged in see brand defaults because the redirect catches them first).
  - **Shipping section** — six feature cards covering what's actually live (Guest List, QR invitations, RSVP, 4-theme system, Guided Planner, 6-stage strip + countdown). Lucide-icon lockups.
  - **Roadmap section** — six cards for Vendors / Seating / Budget / Papic / Panood / Photo Delivery, each with a "when" badge (Coming next / 2026 H2). Dashed borders to signal "not shipped yet" without making them look broken.
  - **Closing CTA** — short-form repeat ask with both Sign in and Create account links.
  - **Footer** — brand mark, "Made in the Philippines", quick links.
- Signed-in users still get redirected to `/dashboard` before the marketing layout renders.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0015_main_website.md` — record the V1-shipped MVP scope: English-only single-page landing. Two sub-scopes remain deferred and should stay flagged in the spec:
  - **i18n (EN / TL / CEB):** locale switcher and translated copy not yet implemented. When this lands, the page will need a top-nav locale picker and translation files; the visual structure should stay intact.
  - **Event Palette interactive preview:** the spec's "Event Palette" section (interactive palette previewer for the 4 themes) is replaced with a static device mock in this MVP. The interactive version is a follow-on.
- The shipped feature copy in `apps/web/app/page.tsx` (Hero / Shipping / Roadmap / Closing) is a **starter draft** — owner should refine via Cowork for the luxurious-Filipino-modern voice. Until then, the page is honest about what's live vs. what's coming and gives visitors a clear sign-up path.

**Deferred:**
- Locale infrastructure (EN/TL/CEB) — moved into a follow-on
- Event Palette interactive theme preview — moved into a follow-on
- Pricing page (no charm-pricing matrix locked yet for non-token model)
- Marketing pages beyond `/` (about, features detail, blog) — not in scope yet

---

## 2026-05-13 · 0021 transversal slice — themes, Lucide icons, new Home, Guided Planner

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — 4-theme system:** New CSS-variable theme blocks for Setnayan Default · Victorian · Classy · iOS in `apps/web/app/globals.css`. Tailwind `cream`, `ink`, and `terracotta` (incl. -600/-700) now resolve to `rgb(var(...) / <alpha-value>)`, so every `bg-cream/95`, `text-ink/40`, `border-terracotta` utility re-skins instantly. The dashboard layout reads `users.theme_preference` once per request and wraps its tree in `<div data-theme=…>`. Public invitation site at `/[slug]` stays on Setnayan Default (the theme picker is for the couple's admin chrome, not their guests' invitation).
- **Phase B — Lucide swap:** `lucide-react` added. BottomNav (Users / Briefcase / CalendarDays / Sparkles), Services launcher (Receipt / Palette / Camera / Tv / CloudUpload / Sparkles in tinted lockups), invitation slug status badges (Check / X / AlertTriangle / Loader2), and the guests-page Share/Clear chips now render Lucide strokes instead of emoji.
- **Phase C — New Home:** `/dashboard/[eventId]` was a redirect to `/guests`; it now renders a real home: warm welcome with time-of-day greeting + days-to-go, 6-stage strip (Dreaming → Booking → Inviting → Finalizing → Wedding Day → After) derived from event_date + guest count, NEXT UP card with branching logic (add first guests / set slug / send invites / lock seating / review), 8-tile nav grid (Guest List · Invitation · Vendors · Budget · Schedule · Seating · Services · Profile) with a guest-count counter on the Guest List tile, and a 6-row activity feed of recent guest additions.
- **Phase D — Guided Planner:** New migration `20260513070000_iteration_0021_planner.sql` adds `users.planner_mode` enum (`guided` | `diy`, default `guided`) and `event_journey_steps` table with Pattern B RLS (couple read + write via `current_couple_event_ids()`). New `apps/web/lib/planner.ts` defines 9 steps, derives 5 from existing event/guest state (date set, venue, guests, monogram/palette, slug), keeps 4 manual (send invites, book vendors, finalize seating, thank-yous), and exposes `resolveStepStatuses` + `plannerProgress`. New server action `toggleJourneyStep` upserts/deletes manual completions. New Checklist component on Home shows progress bar + 9 rows with hint text and links. Profile page gains a guided/DIY toggle that hides the checklist for couples who want to roam free.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0021_couple_dashboard_fully_purchased.md` — record the four-theme palette values (RGB triplets) and the 9-step planner key list since they will be referenced by iterations 0006 (Vendors), 0007 (Budget), 0008 (Seating), and 0025 (Profile Settings full surface). Specifically:
  - Theme palettes: Setnayan Default (`#FAF7F2 / #1A1A1A / #C97B4B`), Victorian (`#F5EBD9 / #2E1A1A / #8B1E3F`), Classy (`#F4F4F2 / #0F0F0F / #A38560`), iOS (`#F2F2F7 / #000000 / #007AFF`).
  - Planner step keys: `set_date`, `pick_venue`, `build_guests`, `customize_invite`, `set_slug` (all auto-derived), `send_invites`, `book_vendors`, `finalize_seating`, `after_event` (all manual).
  - Pattern B helper `current_couple_event_ids()` is now load-bearing for two surfaces; document in `02_Specifications/RLS_Policy_Pattern.md` § 5 mapping table as an established helper.

**Deferred (still gated on later iterations):**
- QR Hub, Gallery sub-page, Vendors / Budget / Schedule / Seating real surfaces — placeholder pages remain.
- Activity feed currently only shows guest additions; scan-event + RSVP-response items are a follow-on (data model exists, UI not yet wired).

---

## 2026-05-13 · 0002 deferral close-out — TBA onboarding, 6 widgets, limited +1 lock, real-time slug check

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — +1 TBA onboarding flow:**
  - New `/[slug]/welcome` route that captures a TBA +1's first + last name. Spec § +1 onboarding flow (lines 121–161).
  - Redeem handler detects TBA placeholders (`plus_one_of_guest_id IS NOT NULL && first_name='TBA' && plus_one_name_confirmed_at IS NULL`) and routes to `/welcome` instead of the personal invitation site.
  - Confirmation submit updates `guests.first_name`, `guests.last_name`, `guests.plus_one_name_confirmed_at = NOW()`, then records a scan_events row with `context.entry='plus_one_onboarded'` so the couple's admin can see the onboarding moment distinctly, then redirects to the standard personal invitation site.
  - "This isn't me" link clears the cookie via the existing sign-out flow.
  - `/[slug]` page also gates: if a guest re-arrives with an unconfirmed TBA cookie (clicked away mid-onboarding), they're re-routed to `/welcome`.
- **Phase B — 6 additional widgets** added to the personal invitation site:
  - **Countdown** (client component, ticks every second, auto-hides past the event date) — 4 boxes for D / H / M / S
  - **Venue** card with Google Maps deep-link "Get directions"
  - **Dress Code** with 5-swatch palette + Do/Don't grid using locked copy
  - **Photo Moments** 3-card grid (Bridal Walk · The Kiss · First Entrance) with locked spec copy
  - **Your Photos** placeholder + profile-photo card + "Add more via Shutter" (deferred to Phase 2)
  - **Public vs Registered tier comparison** with Sign-up free CTA
- **Phase C — Limited +1 full lock variant:**
  - When `plus_one_mode='limited'`, the tier comparison widget renders BOTH cards visually disabled (dashed borders, 55% opacity) and replaces the "Sign up free →" CTA with a "Learn more about Setnayan" link to the marketing site.
  - "Your photos" widget hides the "Add more via Shutter" card and replaces it with a "Your photos will be visible in your inviter's gallery" notice.
- **Phase D — Real-time slug availability check:**
  - New `/api/slugs/check` route handler returns `{ status: 'available' | 'taken' | 'current' | 'invalid_format' | 'reserved' }` with 3 suggested alternatives on `taken`.
  - New `SlugField` client component on the invitation admin uses 300ms debounce + `useTransition` for the save action. Visual states: `⋯` checking, `✓` available, `✗` taken, `⚠` invalid format. Suggestion chips populate inline; clicking one fills the field.
  - Save button is disabled until the current value is `available` AND differs from `initialSlug`.

**Build verification:** 6 new routes (`/[slug]/welcome`, `/api/slugs/check`, plus the previously-shipped 4) all compile and serve correctly.

**SPEC IMPACT:** None new this pass. The 2 spec impacts flagged in the previous 0002 entry remain pending Cowork update.

**Still deferred (genuinely blocked or out of V1 scope):**
- Branded QR with monogram-in-center compositing + 25-frame library (complex SVG work; not blocking)
- Per-role palette QR colors (waits on iteration 0010 palette finalization)
- 3-day photo retention enforcement for public guests (no photos yet)
- Post-download conversion screen (no photo download yet)
- Native-app scanning stubs (Phase 2/3 explicitly)
- Apple/Google Wallet pass generation (V1.5)
- Schedule widget (waits on iteration 0004 invitation widgets)

---

## 2026-05-13 · Iteration 0002 — QR Invitation System (MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513050000_iteration_0002_invitation.sql`:**
  - `events.slug` + format CHECK + case-insensitive UNIQUE index; `events.palette_finalized_at`
  - `guests.profile_photo_url` + `profile_photo_set_at` + `profile_photo_segment`
  - `guests.plus_one_name_confirmed_at`, `guests.scan_tracking_opt_out`, `guests.download_completed_at`
  - `scan_events` table with `scan_source` enum; IP anonymized to first 3 octets per RA 10173
  - `slug_change_log` for 90-day SEO redirects
  - RLS: couples read their event's scan_events; guests read their own; service-role writes
- **Phase B — slug auto-generation** in `apps/web/lib/slugs.ts`. Wired into `createWeddingEvent` so every new event gets a unique slug on creation. Reserved-slug pool (admin, api, dashboard, login, etc.) blocked from claim.
- **Phase C — public guest invitation route at `/[slug]?invite=[token]`:**
  - Token validated via admin client (visitor isn't authed). On valid: signs HS256 JWT cookie (60-day expiry covers the 30-day post-event window), records a `scan_events` row, redirects to clean `/[slug]` URL.
  - Personal invitation site MVP: Hero with monogram placeholder · Greeting · QR card · RSVP form · Event details · sign-out
  - Limited +1 sees inline disclosure block (full Limited variant deferred)
  - Invalid token / wrong-event session → public landing with friendly message
- **Phase D — RSVP submission via `submitRsvp` server action** writes through admin client (visitor isn't authed). Sets `rsvp_responded_at` when status is attending or declined. Revalidates `/dashboard/[eventId]/guests` so couple sees changes immediately.
- **Phase E — Couple admin at `/dashboard/[eventId]/invitation`** (replaces 0000's placeholder):
  - Public-landing URL display + slug editor
  - Server-rendered QR thumbnails (qrcode npm, error correction level H, quiet zone 4)
  - Per-guest "Re-issue" button rotates `qr_token` (16 random bytes hex); old printed QRs become invalid immediately
  - Slug changes write to `slug_change_log` for the 90-day SEO redirect window
- **Phase F — Print sheet at `/dashboard/[eventId]/invitation/print`** with A4 `@page` rules + 3-column QR grid; direct-browser-print works.

**New libs:** `lib/slugs.ts`, `lib/qr.ts`, `lib/guest-session.ts` (JWT cookie helpers).
**New env var:** `GUEST_SESSION_SECRET` (32-byte hex). Falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset.
**Backfill:** existing demo event `S89E-17VNTRAQD8` got slug `maria-and-juan` so the public route works against the seeded data.

**Deferred (logged for future polish):**
- Branded QR with monogram-in-center compositing + 25-frame library + simplified variants for QR-center
- Per-role palette QR colors (depends on iteration 0010)
- +1 TBA onboarding screen (column exists; UI deferred)
- Limited +1 invitation site full variant (currently inline banner only)
- 9 of 14 widgets: Countdown, Venue, Schedule, Dress Code, Photo Moments, Your Photos, Public vs Registered tier, Wallet save, Registered RSVP extras
- Real-time slug availability check with 300ms debounce + `/api/slugs/check` endpoint
- 3-day photo retention enforcement for public guests
- Post-download conversion screen
- Native-app scanning stubs (Phase 2/3)
- Apple/Google Wallet passes

**SPEC IMPACT — please update via Cowork:**
1. `0002_qr_invitation_system.md` line 888 (Notes for Claude Code) says "error correction level M"; locked structural rules at line 537 say level H. Implementation uses H. Fix the notes inconsistency.
2. `0002_qr_invitation_system.md` line 263 declares route `setnayan.com/dashboard/qr-codes` (couple admin); the actual implementation follows 0000's event-scoped pattern at `/dashboard/[event-id]/invitation`. Update the route declaration.

---

## 2026-05-13 · Iteration 0001 polish — detail/edit, plus-one UI, custom tags, invited-to blocks, CSV import

**Commits:** to be filled in once committed.

**What landed:**
- **`/dashboard/[eventId]/guests/[guestId]`** detail + edit page surfacing all 27 columns:
  - Identity, Categorization (side / group / role), RSVP & events (RSVP / meal / invited-to / dietary), Contact, Tags & notes, photo consent
  - **Soft delete** via `softDeleteGuest` server action — sets `deleted_at`, RLS-gated SELECT already filters it out
  - List rows + mobile cards now link to the detail page
- **Plus-one toggle** in the add-guest flow:
  - `<details>` progressive disclosure (no client JS — pure server-rendered)
  - Sub-block exposes first/last name (or blank for TBA) + Full/Limited mode radio
  - Server action creates the primary `guests` row, then a SECOND `guests` row with `plus_one_of_guest_id`, `plus_one_mode`, own auto-generated `qr_token` (per spec § Plus-one management)
  - TBA path: blank names persist a row with placeholder `first_name='TBA'` + `last_name='+1'` + display_name `"+ TBA · brought by {primary}"`
- **Custom tags** as comma-separated input on both add + edit forms — max 50 tags, persisted into `guests.custom_tags TEXT[]`
- **Invited-to schedule-block chips** on both add + edit — 5 blocks (ceremony · reception · cocktails · after_party · rehearsal_dinner). Ceremony + reception checked by default. Uses CSS `has-[:checked]` to style without client JS
- **`/dashboard/[eventId]/guests/import`** CSV import:
  - Paste-into-textarea flow (200-row cap)
  - Inline `parseCsv` helper in `lib/csv.ts` (quoted fields, escaped quotes, CRLF/LF/CR, empty cells)
  - Per-row validation against canonical enums; failed rows surface line-numbered errors; valid rows batch-insert in one statement
  - Returns to `/guests?imported=N&skipped=M`
  - Template + accepted-columns inline on the import page

**Deferred (not in this pass):**
- Households UI (the CSV importer stashes the household column into `guests.notes` as a placeholder until households UI ships)
- Address JSONB editor
- File-upload variant of CSV import (paste-only for now)
- Mobile-specific full-screen sheet variants of add/edit (responsive forms work cross-platform)
- Bulk-edit spreadsheet mode
- Resend-invitation action on detail page (depends on iteration 0028 email templates)
- Custom-tag chip input with autocomplete from existing tags (comma-separated input works for now)

**SPEC IMPACT:** None. All choices align with spec § Functional scope.

---

## 2026-05-13 · Hotfix — RLS infinite-recursion in event_members policies

**Commit:** `19242e4` · migration `20260513040000_fix_rls_infinite_recursion.sql`

**Symptom:**
Anyone signed in hitting `/dashboard` (or any page that queried event-scoped tables) got `Application error: a server-side exception has occurred`. Vercel runtime logs showed `Error: Failed to fetch events: infinite recursion detected in policy for relation "event_members"`.

**Root cause:**
Pattern B policies on `event_members`, `events`, `event_join_tokens`, `guests`, and `households` used inline subqueries like `event_id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid() AND member_type = 'couple')`. When the outer query runs against `event_members`, the SELECT policy on `event_members` fires; the policy's USING clause issues that subquery; the subquery against `event_members` re-triggers the SELECT policy on `event_members`; Postgres aborts with the recursion error. This affected every page that read couple-scoped data through the user's JWT.

**Fix:**
Added two new SECURITY DEFINER helpers that bypass RLS for the lookup:
- `public.current_couple_event_ids()` — event_ids where the caller is `member_type='couple'`
- `public.current_user_guest_ids()` — guest_ids attached to caller's event_members rows

Rewrote 10 policies (4 on event_members, 2 on events, 1 on event_join_tokens, 2 on guests, 1 on households) to use the helpers instead of inline subqueries on event_members.

**Why this matters going forward:**
Every future Pattern B policy that needs "events where I'm a couple" must use `current_couple_event_ids()`. Inline `SELECT event_id FROM event_members WHERE ...` subqueries will recurse the same way.

**SPEC IMPACT — please update via Cowork:**
`02_Specifications/RLS_Policy_Pattern.md` currently documents 4 helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). Add the two new ones to that doc — `current_couple_event_ids` and `current_user_guest_ids` — so future iterations know to use them.

---

## 2026-05-13 · Iteration 0001-B — Seed sample guests + Join flow + next-redirect

**Commits:** to be filled in once committed.

**What changed:**
- **Migration `20260513020000_enable_pgcrypto.sql`** — enables pgcrypto in `extensions` schema (was needed for `gen_random_bytes` used by `event_join_tokens.token` and `guests.qr_token` defaults; Sprint 0 missed this).
- **Migration `20260513030000_fix_pgcrypto_qualification.sql`** — schema-qualifies all `gen_random_bytes()` calls (Supabase places pgcrypto in `extensions` schema; SECURITY DEFINER functions don't see it on the default search_path).
- **Seed** — inserted 15 canonical guests from the iteration 0001 fixtures into the owner's first event (Maria & Juan demo wedding). Done via one-off `/tmp/setnayan-seed/seed.mjs` using @supabase/supabase-js with service_role.
- **Join flow** (closes the iteration 0000 deferred work):
  - `/join/[eventId]?token=...` validates the event_join_tokens row via admin client, then asks unauthed visitors to sign in / create account, and shows the 18-role picker to authed visitors who aren't yet event members
  - `joinEventAction` server action: re-validates token, finds-or-creates a `guests` row by email match, inserts the `event_members` row via the user's own JWT (Pattern B's self-insert clause), then redirects to success page
  - `/join/[eventId]/success` confirmation page reachable by any event member, shows event name + role + dashboard CTA
- **`lib/supabase/admin.ts`** — service-role server client for operations that need to read or write data the current user can't see through RLS (e.g., validating an event-join token before the scanner has become an event_member). Strictly server-only.
- **`/login` and `/signup` actions honor `?next=/path`** so the join flow can round-trip through auth without losing the destination. Magic-link `emailRedirectTo` carries the `next` forward through `/auth/callback`. `safeNext()` validates relative-only paths to prevent open-redirect.

**SPEC IMPACT:** None. All choices align with the spec.

---

## 2026-05-13 · Iteration 0001 — Guest List (Phases A–C, MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513010000_iteration_0001_guests.sql`:**
  - Enum `public.guest_role` with all 18 Filipino-wedding roles per spec § Role taxonomy
  - 5 supporting enums: `guest_side`, `guest_group_category`, `meal_preference`, `rsvp_status`, `plus_one_mode`
  - `public.households` table (no public_id surface — internal entity)
  - `public.guests` table with all 27 columns from the spec including `plus_one_*` columns, `photo_consent` (default TRUE per RA 10173), `invited_to_blocks` (default ceremony+reception), `custom_tags`, `qr_token` (auto-generated), `deleted_at` (soft delete)
  - `public_id` on guests follows `S89G-XXXXXXXXXX` canonical format
  - RLS Pattern B on both tables — event-scoped read, couple-write, admin override
  - Bonus policy: a registered guest can read their own row (for iteration 0002's invitation site rendering)
  - Retroactive FK: `event_members.guest_id → guests(guest_id) ON DELETE SET NULL`
- **Phase B — `/dashboard/[eventId]/guests` list view** (replaces the iteration 0000 placeholder):
  - Stats strip with 5 cards: Invited / Attending (emerald) / Pending (amber) / Declined (rose) / Plus-Ones (terracotta) — each card is a clickable filter
  - URL-based filter: `?rsvp=attending|pending|declined|maybe`
  - URL-based search: `?q=...` — fuzzy match on name + display name + email + custom tags
  - Desktop table (≥640px): avatar + name + plus-one hint + role + side pill + RSVP pill + contact
  - Mobile card list (<640px): avatar + name + role + RSVP pill
  - Empty states for both "no guests yet" and "no matches for filters"
  - Side-coded avatars (rose / sky / amber for bride / groom / both)
- **Phase C — `/dashboard/[eventId]/guests/new` add-guest form:**
  - 7-field MVP version: first/last name · side · group · role (all 18 options) · email · mobile · meal · RSVP · photo consent (default true) · notes
  - Server action `createGuest` with full validation against every enum value
  - On success → `revalidatePath` the list + redirect back to `/guests?added=1`
  - Plus-one model, address JSONB, custom tags, invited_to blocks UI — deferred to a follow-up
- `apps/web/lib/guests.ts` helper module — fetch/stats/labels/initials utilities + type unions for all enums

**Deferred from iteration 0001 (out of session scope):**
- Detail drawer (click row → side drawer with edit/delete)
- Plus-one toggle + TBA / Full / Limited modes UI (schema is ready, UI deferred)
- CSV import (200-row max)
- Households UI (create + assign)
- Custom-tag chips input with autocomplete
- Invited-to schedule-block toggles per guest
- Address JSONB editor
- Mobile-specific full-screen add-guest sheet (currently uses the same form)
- Bulk-edit spreadsheet mode

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/`:**

1. **`0001_creating_guest_list.md` line 48** — declares route `setnayan.com/dashboard/guests`. Iteration 0000's locked URL pattern is `setnayan.com/dashboard/[event-id]/guests`. Update the route line to match.
2. **No retired-system references found** in the 0001 spec — good.

---

## 2026-05-13 · Iteration 0000 — App Shell & Navigation (Phases A–D)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema delta migration `20260513000000_iteration_0000_shell_schema.sql`:**
  - `users.phone`, `users.profile_photo_url`, `users.last_login_at`
  - `events.venue_name`, `events.venue_address`
  - `event_members.role` (free text for the 18-role taxonomy from 0001), `event_members.joined_via` enum (`qr_scan` / `invited` / `created_event` / `admin_added`)
  - `event_members.guest_id` + `event_members.vendor_id` nullable forward-compat columns (FKs added by iterations 0001 + 0022 respectively)
  - `public.generate_event_join_token()` + `public.handle_new_event()` trigger — auto-mints a 32-hex token when a new event is inserted
- **Phase B — `/dashboard` event picker:**
  - Auto-jump rule: 0 events → empty welcome state; 1 active event → server redirect; 2+ active events → picker with primary-first sort
  - `apps/web/lib/events.ts` — `fetchUserEvents()` helper + `EventRow` types + date formatting
  - `apps/web/app/dashboard/layout.tsx` — top-level chrome (brand + avatar + sign-out) outside event scope
  - Archived events collapsed under a `<details>` disclosure
- **Phase C — `/dashboard/create-event`:**
  - 6-tile event-type picker per spec § 2.5 — Weddings selectable, the other five visibly disabled with "Coming soon" badge
  - Wedding-only server action `createWeddingEvent` enforces `event_type='wedding'` (V1 lock)
  - Inserts: `events` row → trigger mints `event_join_tokens` row → also inserts `event_members` row with `member_type='couple'` and `joined_via='created_event'`
- **Phase D — inside-event shell `/dashboard/[eventId]/...`:**
  - Authorization check in layout: 404s if signed-in user isn't a `couple` member of the event
  - Sticky top chrome with event pill + back-to-events link + avatar
  - `BottomNav` client component with 4 tabs (Guest List · Vendors · Schedule · In-App Services) — fixed-bottom on mobile, inline on desktop, ≥44pt touch targets
  - Tab→URL mapping handles sub-pages (e.g., `/invitation` + `/seating` still highlight Guest List tab)
  - Placeholder pages for every tab (each names its owning iteration)
  - **Services launcher grid** with 6 cards — **NO wallet card** (per the Cowork update needed below). Cards: Orders (0034) · Mood Board (0010) · Papic (0012) · Panood (0011) · Photo Delivery (0009) · LED Background (0005)
  - `/dashboard/[eventId]/services/[service]` placeholder routes for each of the six
- **`/dashboard/profile`** — minimal V1 surface showing public_id, account_type, is_internal/team flags, locale, theme preference + sign-out. Full surface deferred to iteration 0025.
- **`/` landing page** — signed-in users redirect to `/dashboard`; unauthed see the existing sign-in / create-account CTAs

**Build / lint / typecheck:** all green. 14 routes compile (server-rendered, all dynamic since they read auth cookies). RLS audit query verified clean on the live database.

**Deferred from iteration 0000 (out of session scope):**
- Join flow at `/join/[event-id]?token=...` — needs the 18-role taxonomy from iteration 0001
- Unified Schedule view aggregating across `vendor_meetings`, `VendorLineItem.deadline_date`, and `invitation_widgets` — needs iterations 0006 + 0007 to ship first
- Vendor-side and admin-side role-router destinations — V1 focuses on customer surfaces (per spec § "Vendor accounts are a placeholder in V1")
- Inside-tab sub-pill row for Guest List (guests/invitation/seating) and Vendors (vendors/budget) — will land when 0001/0002/0008/0006/0007 ship real content

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/`:**

1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the token wallet is referenced at multiple points but was RETIRED 2026-05-11. Affected lines:
   - L21: "Wallet" listed as one of the In-App Services launcher tiles
   - L140: "Token wallet pill on the right (\"🪙 75,000\")" in the chrome
   - L197 / L213 / L220 / L387: "Wallet" / "Top up" / "0003 wallet panel"
   - Replace all with the apply-then-pay model from iteration 0034. The chrome no longer carries a wallet pill; the "Orders" entry in the Services launcher replaces the Wallet card.
2. **`0000_app_shell_and_navigation/fixtures.json`** vs **`.md`** — fixtures.json uses `users.primary_event_id` (FK on user) but the .md SQL declares `events.is_primary` (boolean on event). Sprint 0's base migration already shipped `events.is_primary`. Either reconcile fixtures to match (`is_primary` on the event row) or update the spec SQL to match fixtures (move it to users).

---

## 2026-05-12 · Sprint 0 — platform foundation

**Commits:** `394ded8` → `d93e900` (initial scaffold + 4 CI fixes + STATUS.md update).

**What landed:**
- Fresh greenfield Setnayan monorepo (full wipe of prior Tayo scaffold, rebuild from scratch).
- Next.js 15 App Router web app with `output: 'standalone'`, Tailwind locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280), ≥44 pt touch targets, brand palette (cream / ink / terracotta).
- Auth: email/password + magic-link via Supabase SSR — no OAuth popups (works in Tauri/webviews).
- `/health` route, login + signup pages responsive across the 4 canonical viewports.
- Supabase Postgres canonical schema migration `20260512000000_setnayan_base.sql`:
  - `public.generate_public_id(type_letter)` function (Crockford base 32, no I/L/O/U).
  - 5 enums (`account_type`, `event_type`, `member_type`, `locale_code`, `theme_preference`).
  - 4 base tables (`users`, `events`, `event_members`, `event_join_tokens`) with `S89X-` `public_id` defaults.
  - 4 RLS helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`) — `SECURITY DEFINER STABLE`.
  - RLS Pattern A (per-user) on `users`; Pattern B (event-scoped) on the other three.
  - `on_auth_user_created` trigger — auto-provisions `public.users` and flags `iscasasolaii@gmail.com` as `is_internal=TRUE` per § 10a.
- `apps/web/scripts/rls-audit.sql` — the merge-floor verification query per RLS spec § 9.
- PWA: `manifest.json`, service worker (`sw.js`), maskable SVG icons (192 + 512).
- Tauri 2 desktop scaffold (`src-tauri/`): `Cargo.toml`, `tauri.conf.json`, `build.rs`, `src/main.rs` + `lib.rs`, master `icons/icon.svg`. Embedded `shell/index.html` redirects to live Vercel URL — Sprint 0 minimum viable.
- GitHub Actions: `ci.yml` (typecheck + lint on every push/PR), `build-desktop.yml` (macOS + Windows matrix on push to main), `lighthouse.yml` (Lighthouse CI on PRs).
- `packages/shared` — `PUBLIC_ID_PATTERN`, `isValidPublicId`, role/event/member type unions.
- Live services wired:
  - GitHub: `iscasasola/setnayan-platform` (private)
  - Supabase: project `njrupjnvkjkitfctetvi` in Singapore
  - Cloudflare R2: 4 buckets in APAC (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`)
  - Vercel: `https://setnayan-platform-web.vercel.app`, auto-deploy on push to main
- CI fix commits resolved: pnpm version conflict (`pnpm/action-setup` no longer pins explicit version), phantom worktree gitlinks pruned from index, Tauri `frontendDist` pointed at embedded shell, desktop artifact upload glob corrected to include target subdirectory.

**Acceptance criteria:** all 7 provisioning steps + Phase 1A/1B/1C/1D green. Owner signed up (`S89U-KEMMF2ADCK`, `is_internal=TRUE`), PWA installed on one phone, both desktop artifacts (1.3 MB `.dmg` + 1.3 MB `.msi`) downloadable from Actions tab.

**SPEC IMPACT:** None. The scaffold mirrors the spec corpus 1:1. The Tauri prod URL strategy remains a known gap (documented in `STATUS.md`); if/when we pick a sidecar Node strategy vs static export, that's a spec impact and the owner must update `0013_platform_stack_and_sync` via Cowork.
