# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(drive): schema foundation for a 2nd Google Drive per event (`drive_overflow`)

First, fully-additive slice of "up to 2 Google Drives per event" (owner 2026-07-11). When the couple's primary Drive fills mid-event, they connect a **second Drive they own** for the overflow, so full-res always has somewhere to land.

- **Migration `20270720727938`** — widens the `provider` CHECK on `oauth_grants` + `oauth_state` to allow `'drive_overflow'`. Design: rather than touch the `UNIQUE(event_id, provider)` key + every existing `provider='drive'` reader, the 2nd Drive is an **additive provider value** — slot 1 = `'drive'` (unchanged, every reader works verbatim; **zero blast radius**), slot 2 = `'drive_overflow'` (a new row, invisible to those readers). The unique key already permits one of each → 2 Drives per event.
- **Name-agnostic + idempotent** — drops the provider CHECK by pg_constraint lookup (not by assumed name) then re-adds the widened one. **Verified against prod** in a rolled-back transaction: the swap executes cleanly and preserves all four existing values (`youtube`, `drive`, `tiktok`, `drive_photo_delivery`) — the last of which the photo-delivery `oauth_state` flow writes, so dropping it would have broken that flow (caught by checking the live constraint, not the original migration).

**Scope — this is the schema foundation only.** The functional overflow (a drive-slot dimension on `drive_copy_folders` so Drive #2 gets its own folder namespace, quota-exceeded fallback in `runDriveCopyBatch`, the connect-2nd-Drive OAuth flow, and the UI) is a deeply-coupled follow-up that handles couples' irreplaceable originals and needs two real connected Drives to verify end-to-end — deliberately not rushed into this migration.

**SAFETY INVARIANT (owner-locked):** both Drives are the couple's OWN real Google accounts, each OAuth-consented, narrow `drive.file` scope; Setnayan never creates accounts. Public rollout is gated on the owner-side Google OAuth app verification.

SPEC IMPACT: None new — `Pricing.md § 2.1` core-invariant block + DECISION_LOG 2026-07-11 already carry the 2-Drive rule + guardrails.
