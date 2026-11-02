# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · chore(pricing): Papic capture caps → Ltd ₱9,000 / Unli ₱15,000

Owner raised the per-tier CAPTURE caps again (from the ₱5,999 / ₱11,999 set earlier the same day). Unli ₱15,000 binds at 150 cams; Ltd ₱9,000 at 300.

- **Migration `20270722620648`** — `events.papic_ltd_cap_php` default 5999→9000, `papic_unli_cap_php` default 11999→15000; UPDATEs rows still on the prior policy value (preserving any admin-custom cap). Validated against live prod in a rolled-back tx.
- Code fallbacks: `PAPIC_LTD_CAP_FALLBACK_PHP` 5999→9000, `PAPIC_UNLI_CAP_FALLBACK_PHP` 11999→15000 (papic-cameras.ts); studio-page display fallbacks likewise.

⚠ **Two things surfaced for owner sign-off (not silently applied):** ① ₱15,000 Unli = ~2.4× competitor Once — the multiple both Papic councils flagged as breaking the "fair, not premium-everywhere" promise (owner-accepted for margin). ② The caps now EQUAL the "Unlock all" bundle (₱15,000/₱9,000), so that bundle — capture + Photo Wall + Camera Bridge — is now a ~₱3,000 discount vs à-la-carte rather than the at-list convenience bundle it was designed as; the `PAPIC_UNLOCK` package price is left unchanged pending the owner's reconcile call.

SPEC IMPACT: Applied — `Pricing.md § 2.1` (banner + Ltd/Unli rows + unlock-all reconcile flag + governor + § 00 summary) · DECISION_LOG 2026-07-11.
