## 2026-07-16 · feat(admin): Data Privacy control board — in-app approval of privacy-sensitive capabilities

Adds `/admin/data-privacy` — one approval switch per privacy-sensitive capability (RA 10173). The owner/admin flips each control **Active / Off / Blocked** in-app; the flip records who approved it and when (audit trail for the NPC filing). Feature gates read `status='active'` from the board, so activation is an in-app decision — no env flag, no redeploy, no engineer in the loop. This replaces the "engineer holds env flags" model that was blocking pre-launch testing.

- `20270814219429_data_privacy_controls.sql` — `data_privacy_controls` table (control_key PK, status inactive/active/blocked, approved_by/at/note audit, sort_order), admin-only RLS, seeded with 8 controls: vendor Papic capture · per-guest vendor delivery · face detection/biometrics · capture geolocation · cross-event vendor recall · faith/religion graph · dependent & minor profiles · Home/onboarding signal capture.
- `lib/data-privacy-controls.ts` — the code catalog (mirrors the seed) + `fetchDataPrivacyControls` (merges DB over catalog; pre-migration → all inactive) + `isDataPrivacyControlActive(key)` — the **fail-closed**, request-cached gate every privacy feature reads.
- `app/admin/data-privacy/{page,actions}.tsx` — the board (status pill + risk note + approve/off/block + note field) and `setDataPrivacyControl` action (requireAdmin, stamps approved_by/at on activate).
- `lib/vendor-dayof-flags.ts` — the two counsel-gated vendor gates now delegate to the board (`vendor_papic_capture` / `vendor_guest_delivery`); env vars remain a local-dev override. Until a control is Active, those modules stay "Needs setup".
- Nav: "Data Privacy" (ShieldCheck) added to the admin Trust & Safety group beside Account deletions / Profile corrections — the page ships with its doorway.

Gates: tsc 0 · next lint clean.

SPEC IMPACT: logged in `DECISION_LOG.md` (2026-07-16). The board is the RA 10173 accountability record; approving a control activates the capability for testing (no real accounts yet) and stamps the audit trail. Live activation for real data subjects still tracks the DPO/NPC ruling — the board is where that decision is recorded.
