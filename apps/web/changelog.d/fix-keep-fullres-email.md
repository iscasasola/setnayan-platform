## 2026-07-22 · fix(papic): retire "Keep Full-Res" in code — deactivate the SKU row + reframe the drop-warning email

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

Scope guardrails honored: no service_code/tier_code rename, no capture/storage/
metering logic. The one deliberate change beyond copy is the owner-approved SKU
deactivation below (an `is_active` flip). The `HIGH_RES_ARCHIVE` skip-guard at
`runPapicDropWarning` line 391 is left intact — it correctly avoids warning legacy
owners who bought the SKU before retirement.

**SKU deactivated in code (owner-approved 2026-07-22) — the root cause.** The
`HIGH_RES_ARCHIVE` catalog row in `platform_retail_catalog_v2` was still
`is_active=true` (revived by migration `20270723385655`, owner 2026-07-11) — the
2026-07-17 "retired entirely" decision was never landed in code, so the
couple-facing Papic studio card (`app/dashboard/[eventId]/studio/papic/page.tsx`
§453–488) still sold it at ₱999/yr. New migration
`20270908796702_deactivate_retired_keep_full_res_archive_sku.sql` flips it
`is_active=false`, which **auto-hides the studio buy card** (it renders only when
`keepFullResPricePhp` is truthy, gated on `is_active`) and drops the SKU from the
`is_active`-filtered v2 catalog readers. **Legacy buyers keep everything** —
`ownsKeepFullRes` (an active-order check, independent of the catalog flag) still
shows their "active" banner, and the drop sweep still honors their originals by
order ownership, not by catalog `is_active`. Resolves the "ACTIVE in code+DB …
retired call is spec-only, not in code — unresolved" contradiction flagged in
`Pricing.md` line 29.

Verification: `tsc --noEmit` 0 · `next lint` clean · full `lib/**/*.test.ts`
suite green (2595 pass / 0 fail) · migration guard clean (854 migrations) · db
replay 44/44. No email-copy test asserted the old string.

SPEC IMPACT: Resolves the `Pricing.md` line 29 contradiction ("HIGH_RES_ARCHIVE
ACTIVE in code+DB … the 2026-07-17 'RETIRED' call is spec-only, not in code —
unresolved"). This PR lands that retirement in code (catalog row deactivated), so
`Pricing.md § 2.1` / § 00 and `DECISION_LOG.md` should drop the "unresolved /
active in code" caveat for Keep Full-Res. Legacy owners retain access.
