## 2026-07-12 · docs(privacy): device-fingerprint fraud-prevention notice (RA 10173)

Adds the required RA 10173 disclosure for the device-fingerprint capture (fake-inquiry protection Phase E) to the public privacy policy, so the practice is disclosed BEFORE capture is enabled. New `<Section title="Device identifier (fraud prevention)">` in `apps/web/app/privacy/page.tsx`: hashed first-party device id, fraud-only, not behavioral/biometric, no third-party tracking, legitimate-interest basis (§12), pseudonymous, in the data export, deleted on account deletion. Mirrors `Device_Fingerprint_Data_Use_DPO_Review_2026-07-12.md`. This closes the "notice must be live before enabling `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED`" prerequisite (DPO sign-off still owner-side).

SPEC IMPACT: None (public legal copy; no schema/behavior change).
