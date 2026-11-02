## 2026-07-01 · feat(vendor-shop): vendor-side Locked QR ledger page

A vendor-facing list of the Locked QRs the store has issued — pending (still
claimable), claimed, void — at `/vendor-dashboard/locked-qr`. Reads the vendor's
own rows via the existing vendor-org RLS on `vendor_locked_qr_tokens` (no admin
surface — per owner, these belong on the vendor's account, not a separate admin
page).

Each row shows service, total, downpayment, issued/claimed dates, and a status
badge; pending rows get **Show QR** (re-opens the generator's issued view) +
**Copy link**. Reachable from the Locked generator ("View your issued Locked
QRs →" / "View all issued →").

Standalone page **for now** — it compiles the tokens in one place so the later
dashboard-native integration has a source to pull from.

**Files:** new `app/vendor-dashboard/locked-qr/page.tsx`; edited
`app/vendor-dashboard/invite/page.tsx` (two links to the ledger).

SPEC IMPACT: None (read-only vendor view over the shipped Locked QR data).
