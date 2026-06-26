## 2026-06-26 · feat(papic): guest personal QR → their Limited camera + gallery

Finishes the "Papic Limited = the guest list" loop (owner 2026-06-26: "the custom
QR of the guests will automatically have their papic camera and gallery"). The
roll cameras provisioned by `syncGuestCameras` already carry the guest's binding
+ a paid gate, but a guest's **personal** QR (`guests.qr_token`) had no path INTO
that camera. This adds the bridge — no duplicated capture UI.

- **`lib/papic-limited.ts`** — `fetchGuestRollSeat()` (a guest's active roll seat:
  tier='roll', guest_id set, revoked_at null) + `resolveGuestCamera()`, the single
  source of truth shared by the new route and the landing CTA. It gates on an
  **active** `papic_limited_snapshots` row (reconciled lazily — `pending_payment`
  → `active` once the apply-then-pay order is paid), returning `none` / `pending`
  ("payment under review") / `ready`. `sync:true` self-heals a late "yes" RSVP by
  provisioning their camera on first scan, within the cost cap.
- **`app/papic/me/[token]/page.tsx`** (new) — the guest-QR bridge/hub. Resolves the
  guest by `qr_token`, resolves their roll camera, and: `ready` → "Open my camera"
  into the **existing** `/papic/seat/[claim_qr_token]` claim→capture surface (the
  seat's own token keys the same pipeline a crew seat uses); `pending` → "payment
  under review", no capture; `none` → "not ready yet". Surfaces the guest's
  personal gallery inline via the day-of `getGuestLiveGallery` read (their tagged,
  clean-screened photos) so one QR opens camera **and** gallery.
- **`app/[slug]/page.tsx`** — when a cookie-bearing guest has a `ready` roll camera,
  a floating **"Your Papic camera"** CTA → `/papic/me/[qr_token]`, stacked above the
  existing "Be a candid camera" (PAPIC_GUEST) CTA when both are active. The
  per-guest gallery already lived here; this adds the camera doorway beside it.

Capture stays double-gated: this page blocks on the snapshot being active+paid, and
`recordSeatCapture` independently re-checks `papicCameraOrderPaid` on every shot.

Verified: `tsc --noEmit` clean · `next lint` (no new warnings) · `next build` green
(`/papic/me/[token]` in the route manifest). Browser-flow + the login-free claim
hop (`NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED`) unverified — needs a prod check with a
paid Limited snapshot.

SPEC IMPACT: 0012 Papic — the guest's personal QR now opens their Limited (roll)
camera + personal gallery (entry route `/papic/me/[qr_token]` + landing CTA). The
spec's "personal QR is the credential" claim is now actually wired. Corpus note in
DECISION_LOG.md.
