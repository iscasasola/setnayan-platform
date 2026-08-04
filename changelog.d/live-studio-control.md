## 2026-07-25 · feat(live-studio): one shared single-screen controller + rename live-studio-control

Refined the unified Live Studio (PR #3682) into ONE controller shared by the free
single-camera livestreamer and the paid multi-camera (LIVE_STUDIO) host, per the
owner's 2026-07-25 design. Additive on the #3682 substrate; still DARK behind
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`.

- **Route rename** `live-studio-roam` → `live-studio-control` (git-mv of the detail
  page + the `/setup` controller + its actions). The internal data key
  (`'live-studio-roam'`) and the `LIVE_STUDIO` SKU are UNCHANGED — reviews/stats/
  detail/recommendations still key off the old string, only the URL moved.
  `addOnHref` maps the tile to the new path; `next.config` 307-redirects the old
  path (`:path*`, detail + `/setup`) so bookmarks/deep links never 404.
- **One shared controller.** The `/setup` controller no longer bounces a free
  (un-owned) host to the buy page. Everyone opens the SAME controller: the FREE
  single-camera livestream (YouTube connect + one-tap go-live via the reused,
  already-live `GoLiveCard` + a watch-link save that redirects back to this route)
  is always available; the multi-camera extras (camera strip · add-via-QR · one-tap
  "Cut to Main Stage" · set-default · guest-pick) are ALWAYS VISIBLE but greyed/
  disabled for a free host with an inline "Unlock · ₱2,999" CTA (price from the live
  catalog, never hardcoded) that routes to the LIVE_STUDIO buy. Purchasing unlocks
  them in place. The detail page also surfaces a secondary "Open the controller — go
  live free with one camera" link for non-owners.
- **Server-side backstop.** The five multi-camera control-plane actions (add / delete /
  feature / cut-to-Main-Stage / clear) now require an active LIVE_STUDIO entitlement
  (`requireLiveStudioOwned`) so the UI lock can't be bypassed by replaying a form
  post. The free single-cam actions (go-live, watch-link) stay host-gated only.
- **Single-screen layout.** The core operating loop — live monitor · camera strip
  (cut to Main Stage) · guest-pick · take-off-air — sits on one screen at the top
  (Switcher-grade); go-live + secondary setup (connect / add camera / watch link)
  below.
- **Free tier protected.** Everything new is behind the dark flag; the live free
  single-cam surface (`/studio/panood/setup`) is untouched and keeps working. No
  new migration (reuses `is_main_stage` + the `live_studio_roam_*` tables from
  #3682). YouTube OAuth streaming gate unchanged.
- Tests: new `lib/live-studio-control.test.ts` (5/5) — route rename, data-key
  stability, locked-for-free vs unlocked-for-paid, price-label fallback. Existing
  `live-studio-roam-zones.test.ts` still green.

SPEC IMPACT: None new. Consolidates the Live_Studio_Unified_Spec_2026-07-25.md
model (one product) into a single shared controller; the customer-facing route is
now `/studio/live-studio-control`.
