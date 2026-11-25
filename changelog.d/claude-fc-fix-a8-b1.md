## 2026-11-25 · fix(admin): final check area 8, batch 1: admin guards and house words

Final check, area 8 fixer, batch 1 (lane A only, no screen shape change):

- **A8·G-4** (confirmed live on the staging copy): any signed-in account could get an upload address for the homepage background-video folder. `/api/upload` now asks the same admin question for `homepage-bg/` and `onboarding/` that it already asked for `hub-music/` (`ADMIN_ONLY_UPLOAD_ROOTS` in `lib/upload-prefix-tenancy.ts`).
- **A8·L-1, A8·L-2**: verification-docs (the government-ID shelf), demand, venues/new and more now call `requireAdmin()` themselves; event-deletions swaps its hand-rolled check for the shared gate. A new guard derives every admin page from `app/admin` and fails one that leans on the layout alone.
- **A8·C-3**: approvals and escalations ask for an admin before their service-role read.
- **A8·B-9, B-10, F-22, G-16, I-11**: plan names (Plus · Pro · Ultra, never a code key or "Supplier Ultra"), "copies", Event Hub, and the marketplace in place of "/vendors".
- **A8·P-B-12**: admin landing cards draw every chip their line names (the cap of six hid Hub music and Songs on Catalogue).

Each claim has a guard test; each guard was mutation-checked red, then restored.

SPEC IMPACT: None. Fixes to already-drawn admin pages; no rule, price or plan changes.

**Added (controller ruling 25 Nov): A8·A-1.** Approving a payment whose own row can't be read is refused ("Couldn't
check this payment against previous payments… Nothing was approved"), the same rule as the priors read beside it. It
used to skip the whole duplicate-reference check and approve. Guard: `apps/web/app/admin/payments/an-unread-payment-is-not-approved.test.ts`
(fails when the fix is reverted). The other eight A1 guards are #8332's (checker 8-1).
