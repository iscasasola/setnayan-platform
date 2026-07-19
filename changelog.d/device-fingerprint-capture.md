## 2026-07-12 · feat(anti-fraud): Phase E slice 1 — device-fingerprint capture

First slice of Phase E of fake-inquiry protection (corpus: `Vendor_Fake_Inquiry_Protection_Build_Plan_2026-07-11.md`). The already-merged fraud engine (`user_identity_signals` → `identity_clusters`) and the self-review gate both READ `user_devices.device_hash`, but **nothing writes it** — the device-clustering that catches sock-puppet farms has been dormant. This lights it up.

- **`apps/web/app/_components/device-capture.tsx`** — a deferred, null-rendering client component in the root Providers tree (mirrors `DeferredObservability`). Post-idle, once per browser session, it reads/creates a COARSE first-party device id (random UUID in localStorage) and hands it to a server action. Degrades silently where storage is blocked.
- **`apps/web/lib/device-capture.ts`** (`'use server'`) — `recordDeviceHash` hashes the id SERVER-side (`sha256(salt + id)`, stable salt so a shared browser links accounts; the raw id never reaches the DB) and upserts `user_devices` through the caller's OWN RLS session (the table already has an owner-write policy). Only SECURED (non-anonymous) accounts; best-effort, never throws.
- **`apps/web/lib/device-capture-flag.ts`** — `deviceFingerprintEnabled()` (`NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED`, default OFF). Own module (not inquiry-gate.ts) to avoid a conflict with the in-flight lead-trust-badge PR.
- **`apps/web/app/providers.tsx`** — mounts `<DeviceCapture />`.

No migration (`user_devices` + its owner-write RLS already exist). Deliberately COARSE — a random id, NOT a canvas/font behavioral fingerprint, NO external SDK: privacy-light, catches bulk multi-account-per-browser farms; a determined attacker clearing storage evades it (defense-in-depth with the velocity/hold/report layers).

⚠ **RA 10173 / DPO:** merging is inert (flag OFF), but this introduces a NEW data-collection practice (a pseudonymous per-browser device hash, fraud-prevention purpose). The privacy policy must cover it and the DPO must sign off BEFORE the flag is flipped. Slice 2 (not in this PR): periodic `refresh_identity_clusters()` + inquiry targeting-concentration detection → quarantine (owner decision — silently withholding a real couple's inquiry is the heaviest action in the system).

SPEC IMPACT: None in schema/pricing (flag-gated, no migration). NEW privacy practice gated behind DPO sign-off — flagged for owner. Logged in DECISION_LOG 2026-07-12.
