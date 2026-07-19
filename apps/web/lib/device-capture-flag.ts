/**
 * Phase E slice 1 — device-fingerprint CAPTURE flag (fake-inquiry protection).
 *
 * When ON, a secured account's browser records a COARSE, first-party device id
 * (hashed server-side) into `user_devices`, lighting up the already-merged
 * identity-cluster machinery (sock-puppet-farm detection) + the dormant
 * self-review "shared device" check — both already READ `user_devices`, nothing
 * writes it today.
 *
 * ⚠ Default OFF, and MUST stay off until DPO sign-off: this begins a NEW
 * data-collection practice (a pseudonymous per-browser device id) that the
 * RA 10173 privacy policy must cover. Deliberately COARSE — a random id in
 * localStorage, NOT a canvas/font behavioral fingerprint and NO external SDK:
 * privacy-light, catches bulk multi-account-per-browser farms; a determined
 * attacker who clears storage evades it (defense-in-depth with the velocity /
 * hold / report layers).
 *
 * Own module (not inquiry-gate.ts) to avoid a merge conflict with the in-flight
 * lead-trust-badge PR. NEXT_PUBLIC_ so client + server read the same flag.
 */
export function deviceFingerprintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED === 'true';
}
