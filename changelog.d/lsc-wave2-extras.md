## 2026-07-25 · feat(live-studio): wave 2 — overlays, event QR (free), highlight moments, real guest-pick

The **₱0 broadcast-extras wave** for the unified Live Studio controller, additive on Wave 1
(PR #3690). Everything stays **DARK behind the existing `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`
flag** — no behavior change while it is off. Opened as a **DRAFT** PR (no auto-merge).

- **Ⓜ Monogram overlay** — on/off + **repositionable, default UPPER-RIGHT** (top-right ·
  bottom-right · bottom-left · top-center), persisted. Text is the couple's own
  (`events.monogram_text` → `deriveMonogram`). Part of the `LIVE_STUDIO` unlock.
- **▬ Lower third** — host-editable title + subtitle line, on/off, persisted; text trimmed,
  whitespace-collapsed and length-capped (40 / 80) so the bar cannot overflow a frame. Part of
  the unlock.
- **⬛ Event-QR overlay — FREE (owner-locked)** — on/off + corner, persisted, available to free
  hosts. Reuses the already-shipped `/api/website/qr/[slug]` PNG, so it is the event's real
  scan-to-join code (canonical `/u/` owner-slug resolution + monogram centre included) and no QR
  rendering is re-implemented. Withheld entirely for a slug-less event — no code, no toggle.
- **"POWERED BY SETNAYAN" on FREE streams** — a permanent lower third a free host **cannot
  remove.** It is **derived from the entitlement, never stored as a row**: `resolveOverlays()`
  never consults `lower_third_enabled` on the free branch, so there is no setting to flip and no
  request to replay. The paid unlock **replaces** it with the couple's own bar. Three independent
  backstops: the resolver, `requireLiveStudioOwned` on `setLowerThird`, and the flag.
- **⚡ Highlight moments** — one tap while live saves a timestamped metadata row (offset from
  `went_live_at` + a **snapshot** of the on-air channel in the host's own words, so a later rename
  or delete cannot rewrite history). **No video is read, cut or re-encoded.** Surfaced as a
  post-event list with `h:mm:ss` chapter-shaped offsets. The button renders only when it can do
  something real — paid **and** on air — and the action re-resolves liveness server-side rather
  than trusting a posted flag. Replaces the shipped `markHighlight` stub's "no persistence yet".
- **GUEST-PICK is now a REAL toggle** (owner: "make it optional") — new
  `events.live_studio_guest_pick_enabled`, default **TRUE**. Wave 1 rendered it read-only because
  nothing persisted it. **Enforced server-side BY OMISSION:** off → the public loader reduces the
  manifest to the one channel Channel 1 is carrying (`applyGuestPick`), so the other channels'
  video ids never reach the browser and the picker's existing `length > 1` guard hides itself.
  Hiding buttons while still serialising the ids would only look like enforcement.
- **Where the overlays actually reach air** — they are re-resolved server-side on
  `/panood/program/[eventId]`, the chrome-less pop-out the couple's encoder window-captures, and
  drawn there as DOM layers. That is a **real** compositing point (it is how the existing SETNAYAN
  paywall overlay reaches air), costs **₱0**, and needs no server mixer. Drawn *under* the paywall
  overlay so an extra can never be used to obscure it. The unified controller's own CH 1 monitor
  still has no video pipeline, so the overlays drawn over it are an explicitly-labelled
  **placement rehearsal** using the same shared corner map — never a faked frame.
- **NO FAKE DOORS** — Split/PiP are **not** rendered (they need a mixing point that does not exist;
  phase 2). No viewer counter, no on-air timer.
- **Schema** — migration `20271002100000_live_studio_wave2_extras.sql`:
  `live_studio_overlay_settings` (one row/event) + `live_studio_highlights` + the `events` column.
  RLS enabled at `CREATE TABLE` time with the couple+coordinator+admin policy copied from
  `live_studio_roam_zones`; idempotent throughout. `highlights.created_by` deliberately carries
  **no FK** to `auth.users` — the repo already has an admin-user-delete failure caused by
  `NO ACTION` FKs, and a highlight row must never be the thing that blocks an RA 10173 erasure.
- **Tests** — 26 new overlay tests + 5 guest-pick tests: per-feature free/paid gating, lapsed
  entitlement renders nothing paid, a free host cannot switch off **or** overwrite the branded bar,
  monogram position persistence + junk-value fallback, text caps, ⚡ needs paid+live, offset math,
  and a **schema-drift guard** asserting the TS corner sets against the migration's SQL `CHECK`
  constraints and defaults. `3247/3250` unit tests pass (the 3 failures are pre-existing
  missing-optional-dep suites: `pglite`, `@anthropic-ai/sdk`). `tsc --noEmit` reports **zero**
  errors in touched files; scoped `next lint` clean; `migration:check` + `migration:doctor` clean.

SPEC IMPACT: Resolves the **⚠ OPEN** question in `Live_Studio_Unified_Spec_2026-07-25.md` § 2 —
the **event-QR overlay is FREE**, not paid-only as the prototype showed. Confirms § 2's highlights
split ① (timestamped MOMENTS, ₱0) as the shipped behavior and § 4b's guest-pick toggle as real.
Also records a **CONFLICT for owner sign-off**: `lib/panood-watermark.ts` (owner-locked 2026-07-21,
live on the legacy `panood/broadcast` route) makes the free tier a **full-screen SETNAYAN overlay**
that is deliberately "useless as an actual broadcast", while the 2026-07-25 unified spec says the
free single-cam stream is genuinely free and merely carries a "POWERED BY SETNAYAN" lower third.
Both now render on the same surface. Wave 2 implements the newer lower-third model and does not
touch the older watermark; which one survives is an owner decision.
