/**
 * lib/panood-camera-seats-pure.ts — the camera-seat vocabulary with no database
 * in the module graph: the flags, the caps, the row/view SHAPES, the claim-token
 * mint and the index arithmetic.
 *
 * Split out of lib/panood-camera-seats.ts, which resolves the Panood tier
 * through `eventSkuActive` and so reaches the service-role client. Three things
 * need this half without wanting that one:
 *
 *   • `control-room.tsx` ('use client') reads `panoodStreamingEnabled()`;
 *   • `live-studio-channel-cameras.ts` mints and links tokens — and IT is what
 *     `panood-camera-publish.tsx` ('use client') imports, so the whole
 *     channel-cameras → guest-pick branch came along for the ride;
 *   • the unit tests, which want the arithmetic without a Supabase client.
 *
 * 🔑 THE TOKEN MINT IS WEB-STANDARD ON PURPOSE. `crypto.getRandomValues` +
 * `btoa` — not `node:crypto` — so this module stays loadable in every runtime
 * that imports it, browser included. Do not "modernise" it to a node import.
 *
 * Server callers keep importing from `@/lib/panood-camera-seats`, which
 * re-exports everything here.
 */

import { envFlagEnabled } from '@/lib/env-flag';

export const PANOOD_CAMERA_CLAIM_PATH = '/panood/cam';

/**
 * Login-free camera-operator claim flag (owner-gated). A SIBLING of
 * papicSeatAnonEnabled() — same native-anon-session machinery, flips
 * independently so login-free Panood camera join can go live on its own clock.
 *
 * When ON, an operator claims a camera WITHOUT signing in: claimPanoodCamera
 * mints a Supabase NATIVE anonymous session (a real auth.uid()) on the claim
 * POST, so the authenticated-only panood_claim_camera() RPC and every
 * claimer-keyed row keep working unchanged. The operator's whole experience
 * becomes scan QR → one "Join as Camera N" tap → local preview. (The tap can't
 * be zero — claim happens on a POST, never on the GET page load, so a chat-app
 * link-preview bot can't silently claim the camera.)
 *
 * Default OFF. Going live needs the SAME three owner actions Papic login-free
 * needs (they share the native-anon-session machinery):
 *   1. Enable `enable_anonymous_sign_ins` in the Supabase Auth dashboard.
 *   2. Apply the null-email-tolerant auth-user trigger migration (20270205204166).
 *   …then set NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED=true.
 *
 * NEXT_PUBLIC_ so the claim page (server component) and the claim action read the
 * SAME flag — one source of truth.
 */
export function panoodCameraAnonEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED);
}

/**
 * The Add-camera tile's caption, tied to `panoodCameraAnonEnabled()` so it can
 * never promise a login-free join that /panood/cam/[token] won't honor: that
 * page shows the real "scan QR → tap → camera" CTA only when the flag is ON,
 * and a sign-in wall when it's OFF. Takes the resolved flag rather than reading
 * it itself so callers can't drift onto a second, independent read of the env
 * var.
 */
export function cameraJoinCaption(anonEnabled: boolean): string {
  return anonEnabled ? 'scan QR · no login' : 'scan QR · needs Setnayan sign-in';
}

/**
 * Real-media streaming flag (owner-gated · default OFF), independent of the
 * login-free claim flag above. When ON, the camera-operator publish view opens a
 * WebRTC peer connection to the controller (lib/panood-webrtc.ts) and the control
 * room's PROGRAM monitor renders the on-air camera's live feed. When OFF (the prod
 * default until a real-event test passes — the couple's-unrepeatable-day gate),
 * the publish view stays local-preview-only and the control room shows the
 * placeholder; nothing peer-to-peer happens. NEXT_PUBLIC_ so the publish page and
 * the control room read ONE source of truth. Media is P2P + STUN-only (no TURN,
 * owner-locked); nothing is recorded or stored.
 */
export function panoodStreamingEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_PANOOD_STREAMING_ENABLED);
}

/**
 * How many camera-operator seats a paid Live Studio order provisions, by tier
 * (owner-locked 2026-07-08 · Live_Studio_Repackaging_2026-07-08.md):
 *   PANOOD_SYSTEM        (Desktop · ₱2,499/day) → 8 cameras
 *   PANOOD_SYSTEM_MOBILE (Mobile  · ₱1,299/day) → 3 cameras
 * Any other code → 0: the FREE single-cam livestream broadcasts the couple's OWN
 * device → YouTube and provisions no operator seats.
 *
 * This count IS the hard camera cap — the panood_claim_camera() RPC only binds an
 * operator to an EXISTING camera, so provisioning exactly `cap` seats is what
 * enforces the per-tier ceiling (there's no per-camera fee; the cap is purely the
 * tier limit + anti-abuse). Enforced at order-approval provisioning in
 * lib/sku-activation.ts.
 */
export const PANOOD_TIER_CAMERA_CAP: Readonly<Record<string, number>> = Object.freeze({
  PANOOD_SYSTEM: 8,
  PANOOD_SYSTEM_MOBILE: 3,
});

export function panoodCameraCapForSku(serviceCode: string): number {
  return PANOOD_TIER_CAMERA_CAP[serviceCode] ?? 0;
}

/**
 * Cameras on the FREE rig-verification tier (council-locked 2026-07-21).
 *
 * The free tier is fully functional but every video surface carries the SETNAYAN overlay: the
 * couple pairs cameras, checks multiview and framing, and proves the rig works BEFORE paying.
 *
 * Three, not eight. `free 3 overlaid → Mobile 3 clean → Desktop 8 clean` is the only ladder in
 * which the ₱1,500 Mobile tier is not a paid DOWNGRADE on the one axis the couple has just
 * personally counted. The residual cost is real and accepted: a couple planning six cameras
 * cannot rehearse all six, which is what `grantedCap` below exists to relieve.
 */
export const PANOOD_FREE_CAMERA_COUNT = 3;

/**
 * Resolved entitlement for an event.
 *
 * ONE PRICE (owner-locked 2026-07-21): ₱2,500/day unlocks everything. There is no longer a
 * Mobile-vs-Desktop entitlement split — that row was never purchasable (the only buy surface
 * posts `PANOOD_SYSTEM`) and had zero orders, ever.
 *
 * The device distinction survives where it belongs: as a LAYOUT decision taken from the
 * operator's hardware (lib/panood-console-layout.ts), never from what they paid. A phone operator
 * and a laptop operator buy the same thing and each get the console their device can run.
 */
export type PanoodTier = 'free' | 'paid';

/**
 * Camera cap by RESOLVED TIER — the render-time resolver.
 *
 * `panoodCameraCapForSku` above stays as-is for the order-activation hooks, which call it with
 * hardcoded SKU literals. This one answers "how many cameras does this event get right now",
 * which is a different question the moment a free tier exists.
 *
 * `grantedCap` is the admin top-up (council mitigation for the 3-camera free cap). It can only
 * ever RAISE the count and is itself capped at 8 — the transport's ceiling — so a bad admin
 * value cannot provision an unbounded number of seats.
 */
export function panoodCameraCapForTier(tier: PanoodTier, grantedCap?: number | null): number {
  const base =
    tier === 'paid' ? panoodCameraCapForSku('PANOOD_SYSTEM') : PANOOD_FREE_CAMERA_COUNT;
  // A grant can only ever RAISE the count, and never past the transport's own 8-camera ceiling.
  return Math.max(base, Math.min(grantedCap ?? 0, panoodCameraCapForSku('PANOOD_SYSTEM')));
}

/**
 * Camera-operator seat statuses (mirror the table CHECK constraint):
 *   open     — provisioned, not yet claimed
 *   live     — claimed operator is streaming (recent heartbeat)
 *   offline  — claimed but no recent heartbeat
 *   revoked  — couple revoked the claim; a fresh token must be reissued
 */
export const PANOOD_CAMERA_STATUSES = ['open', 'live', 'offline', 'revoked'] as const;
export type PanoodCameraStatus = (typeof PANOOD_CAMERA_STATUSES)[number];

/**
 * Read shape of a public.panood_camera_operators row. `id` is the bigserial PK,
 * surfaced as a string (Supabase returns bigint as number/string depending on
 * driver config) for stable client keys.
 */
export type PanoodCameraRow = {
  id: number;
  event_id: string;
  camera_index: number;
  label: string | null;
  claim_qr_token: string;
  claimer_user_id: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
  status: PanoodCameraStatus;
  revoked_at: string | null;
};

/**
 * A short, URL-safe claim token. panood_camera_operators.claim_qr_token is the
 * value the per-camera claim link / QR carries; it must be unguessable and
 * unique. 24 bytes of crypto-random base64url (≈ 32 chars) is plenty of entropy
 * and stays well inside a single QR module budget. Reuses the Papic seat-token
 * approach byte-for-byte (generateSeatClaimToken).
 */
export function generateCameraClaimToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa → base64, then make it URL-safe and strip padding.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build the public claim URL for a camera token. The operator opens this on
 * their phone; the route validates the token, signs them in (login-free in a
 * later PR), and binds the camera to their session.
 */
export function panoodCameraClaimUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}${PANOOD_CAMERA_CLAIM_PATH}/${encodeURIComponent(token)}`;
}

/**
 * The public-facing shape of a camera the operator has CLAIMED — only the
 * non-secret fields the publish view needs. Never carries claim_qr_token.
 */
export type ClaimedCameraView = {
  camera_index: number;
  label: string | null;
  event_id: string;
  status: PanoodCameraStatus;
};

/**
 * Compute the dense set of missing camera indexes in 1..count given the indexes
 * that already exist. Pure logic, exported so the provisioning path and its unit
 * test share one source of truth. Indexes <1 or >count in the existing set are
 * ignored (they can't collide with a 1..count top-up).
 */
export function missingCameraIndexes(existing: Iterable<number>, count: number): number[] {
  const have = new Set<number>();
  for (const n of existing) have.add(n);
  const missing: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}
