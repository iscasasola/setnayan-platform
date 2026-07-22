## 2026-07-22 · fix(papic): drop-warning email no longer sells the retired "Keep Full-Res" SKU

The Papic full-res drop-warning email (`runPapicDropWarning` in
`lib/daily-email-jobs.ts`, sent to couples ~14 days before a photo's hosted
full-resolution original is dropped) advertised a paid **"Keep Full-Res
₱999/year"** upgrade. That SKU was **RETIRED ENTIRELY by the owner on 2026-07-17
— there is no paid full-res hosting product anymore** (corpus `Pricing.md § 2.1`
row + memory `project_setnayan_papic_gbb_pricing`). The stale bullet was a live
fake-door on a compliance-adjacent retention notice.

What changed:

- **Removed the "Or add Keep Full-Res … (₱999/year)" bullet** from the email
  body. No price, no paid upgrade, no "Keep Full-Res" product name.
- **Reframed around the current (free) retention model:** the compressed gallery
  is kept online **forever, free**; before the drop the couple can (a) **download
  their originals** — a single photo, the whole event as a ZIP, or a full account
  export — or (b) **connect Google Drive** so every original is saved to their own
  account automatically at full resolution, free. After the window only the
  compressed gallery remains (kept forever). Copy only; the send-timing ("about
  two weeks") is unchanged and still code-accurate (`WARN_LEAD_DAYS = 14`).

Scope guardrails honored: no service_code/tier_code rename, no `is_active`/status
flip, no migration, no capture/storage/metering logic. The `HIGH_RES_ARCHIVE`
skip-guard at `runPapicDropWarning` line 391 is left intact — it correctly avoids
warning legacy owners who bought the SKU before retirement.

Verification: `tsc --noEmit` 0 · `next lint` clean · full `lib/**/*.test.ts`
suite green (2595 pass / 0 fail). No email-copy test asserted the old string.

SPEC IMPACT: None — copy fix reconciling a retired SKU on a live user-facing
surface; the new copy points at the current retention model (free forever
compressed gallery + Drive handover + download window; no paid full-res SKU) per
`Pricing.md § 2.1` line 254.

⚠ Owner-gated follow-ups (NOT in this copy PR — flagged for a separate change):
the `HIGH_RES_ARCHIVE` catalog row in `platform_retail_catalog_v2` is still
`is_active=true` (revived by migration `20270723385655`, owner 2026-07-11) — the
2026-07-17 "retired entirely" decision was never landed in code. While that row
is active, the couple-facing **Papic studio purchasable card**
(`app/dashboard/[eventId]/studio/papic/page.tsx` §453–488) still sells it at
₱999/yr. Deactivating that catalog row (owner-gated migration) auto-hides the
studio card and keeps the app consistent with this email.
