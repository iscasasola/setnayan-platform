# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · feat(vendor): in-thread voice/video calls become a PAID-vendor capability (Solo+), flag-dark

Owner 2026-07-13: calls with couples should be "a service for the paid." The in-thread 1:1 voice/video call (the "Call" tab + the appointment video/voice join, both free P2P over `lib/call-webrtc.ts`) is now gated to any PAID plan (Solo ₱999+ · Pro · Enterprise · Custom) — Free and legacy Verified do NOT get it. Paying vendors also carry the tiny TURN-relay cost that keeps hard-NAT couples connectable.

- **Capability matrix** (`lib/vendor-tier-caps.ts`): new `calls: boolean` cap on `TierCaps` (false for free/verified, true for solo/pro/enterprise/custom) + `canUseCalls(tier)` helper, alongside the existing `canSee*` hybrid-gate helpers.
- **Single gate helper** (`lib/thread-calls-gate.ts`, `server-only`): `resolveThreadCallsEnabled(vendorProfileId)` — returns `true` when the shared `VENDOR_TIER_FEATURE_GATE` is OFF (today's behaviour, unchanged), else `canUseCalls(vendorTier)`. Reads the tier with the admin client (a read-only capability probe on the thread's own vendor, so a couple-initiated call resolves it regardless of `vendor_profiles` read policies) — NOT an authz bypass; the call insert still rides the caller's RLS.
- **Authoritative server gate** (`app/_actions/thread-call-actions.ts`): `startThreadCall` now refuses when calling isn't unlocked — one chokepoint covering BOTH the Call tab and the appointment join. Role-specific copy (vendor → "upgrade your plan"; couple → "this vendor hasn't enabled in-app calling yet").
- **UI** (`thread-call-launcher.tsx` + `-lazy.tsx`): new `callsEnabled` / `viewerRole` / `upgradeHref` props. When locked, a vendor sees a "🔒 Upgrade your plan to call clients" pill linking to `/vendor-dashboard/subscription`; the couple simply sees no call UI. Wired at all 4 mount sites (couple messages + workspace; vendor messages + clients).
- **Tests** (`lib/vendor-tier-caps.test.ts`, +4): Solo+ true · Free/Verified false · unknown→free→false · every tier declares the cap.

FLAG-DARK: reuses the established `VENDOR_TIER_FEATURE_GATE` switch (same one gating Market Intel / Theft Watch / performance analytics), default OFF, so behaviour is byte-identical until the owner flips it on the day paid vendors exist in prod. Tier boundary is Solo+ ("a service for the paid"); one line in the matrix flips it to Pro+ if desired. No migration/schema/price change.

SPEC IMPACT: Reverses the 2026-07-10 "vendor↔couple call = free P2P" lock — calling is now a paid-tier capability (Solo+). Logged at the bottom of `DECISION_LOG.md` (owner-approved 2026-07-13). The free P2P transport is unchanged; only *access* is gated. Live Studio pricing is untouched (separately already paid).
