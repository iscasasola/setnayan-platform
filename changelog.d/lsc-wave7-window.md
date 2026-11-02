## 2026-07-25 · feat(live-studio): retire watermark + one-day window with extend + 12h archive guard + coordinator access (wave 7)

**Four owner-locked items from `Live_Studio_Unified_Spec_2026-07-25.md` § 4f**, built on Waves 5
(#3709) and 6 (#3711). Opened as a **DRAFT** PR, no auto-merge. Everything new is dark behind
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` **except** the coordinator RLS fix, which is a pure widening
of an existing policy to a membership the app already accepts (see below).

### ① The full-screen SETNAYAN watermark is RETIRED (§ 4f ①)

Owner 2026-07-25, reversing the 2026-07-21 lock: *"yes we have a free single camera."* A free host
genuinely broadcasts one camera — the live `/pricing` page promises "Single-camera livestream" free
— so a full-screen mark over it makes that promise hollow. **The forced "POWERED BY SETNAYAN" lower
third (Wave 2) is now the sole free-tier branding.**

- `lib/panood-watermark.ts` gains a `retired` input and a terminal `'retired'` reason.
  `decideWatermark` returns `overlay: false` for it before any other branch, and
  `canStartBroadcast` returns `true` — the gate the overlay belonged to goes with it.
- **The module is NOT deleted, and that is deliberate**, not laziness. Two live things import it:
  `lib/entitlements.ts` reads `PANOOD_PAID_SKUS` for Wave 6's grandfather alias
  (`LIVE_STUDIO ← PANOOD_SYSTEM`), and `lib/panood-program-bridge.ts` types its frame on
  `WatermarkReason`. Ripping the module out would have dragged the Cast-buyer grandfather clause
  into a watermark PR.
- **ONE change retires all three render sites**, because they all read the one decision: the legacy
  control room's program monitor, its source thumbnails, and the OBS pop-out (which receives
  `overlay` over the program bridge). Nothing had to be edited in the render tree.
- **Flag-aware, and this is the load-bearing judgment call.** Flag OFF, the legacy Cast room is
  **live and selling `PANOOD_SYSTEM` at ₱2,500 and the overlay is its only paywall** — retiring it
  unconditionally would hand every free host an unwatermarked multi-camera broadcast the moment
  this merged, weeks before the replacement paywall (Wave 5's program-source reduction) is even
  reachable. Same reasoning § 4e gives for not retiring the SKU while the new product is dark. Flag
  ON, Wave 6 already redirects that room away — so this is the **stated decision** standing behind
  what was previously only an accident of routing, and it survives the redirect being changed, the
  legacy code being deleted piecemeal, or a future publisher re-wiring `watermark.overlay`.

### ② The broadcast window — one event-day, extendable, never interrupted (§ 4f ②)

New `apps/web/lib/live-studio-window.ts` (the PURE decision, **zero runtime imports**) +
`live-studio-window-server.ts` (the reads) + `live-studio-window.test.ts` (27 cases). The split is
not cosmetic: the controller's warning strip is a `'use client'` component — it has to tick through
a ceremony to catch the 1-hour and 12-hour crossings a server render cannot see — and an
undivided module would have pulled `lib/entitlements.ts` and its DB queries into the browser
bundle. Same shape as the repo's existing `*-server.ts` modules, and the same import-free posture
that lets client components already import `lib/live-studio-overlays.ts`.

- **₱2,999 = ONE EVENT-DAY of MULTI-CAM broadcasting**, restoring the per-day shape Cast (₱2,500/day)
  and Roam (₱3,500/day) always had and § 4d dropped by omission.
- **🔒 NEVER CUT OFF MID-BROADCAST.** A window that lapses while a stream is running keeps
  multi-cam ON (`expired-broadcasting`). Enforced at the NEXT go-live, never mid-air.
- **The window gates MULTI-CAM, never go-live.** A lapsed host falls back to exactly the free tier —
  one camera, the Powered-by bar, guests still watching. Blocking the Go live button would break a
  published free promise in order to sell an upgrade.
- **Anchored on FIRST GO-LIVE**, not a calendar day: no timezone ambiguity, and buying early costs
  the couple nothing. Reuses the EXISTING write-once, trigger-immutable
  `panood_control_state.first_live_at` (migration 20270829098323) — **no new column**. Wave 5 noted
  the unified go-live path never wrote it; `goLivePanood` now stamps it on success only, and only
  behind the flag.
- **Days come from `orders`**, counted through Wave 6's `SKU_OWNERSHIP_ALIASES` so a grandfathered
  Cast buyer's `PANOOD_SYSTEM` order funds a day as well as conferring the SKU. Window end is a
  "hotel nights" fold: `cursor = max(cursor, boughtAt) + 24h`. The `max()` is what stops a day
  bought after the window lapsed from being **retro-expired** — ₱2,999 for nothing.
- **ONE SOURCE OF TRUTH.** `canPublishMultiCam` now delegates to `resolveBroadcastWindow`, so the
  manifest write gate, the public read gate, the program-output gate and the controller all read
  the same rule. No second gate to disagree with the first.
- **Extension = another ₱2,999 on the EXISTING rail** — the same `InlineCheckoutDrawer` →
  `submitOrderAction` → GCash/BDO QR → `/admin/payments`. No new payment path, no new table, no
  discount ladder (owner: "I just want 1 price").
- **Idempotency by construction.** A day exists only when an order reaches `paid`/`fulfilled`, and
  `orders_insert_status_guard` / `orders_update_status_guard` (migration 20270920010000) forbid a
  non-admin writer from setting either. A replayed submit creates another UNPAID order worth zero
  days. There is no request in the system whose replay adds time.
- **Owned with ZERO day-orders = `unmetered`** (admin comp grant · §10a internal event · founder
  seat · promo free-window · a retired-bundle child). Nothing was sold by the day, so nothing is
  metered by it — a clock on a grant nobody denominated in days would be a limit invented in code.
- **🚨 THE NEVER-INTERRUPT RULE IS BOUNDED, and that bound is the difference between honouring the
  owner lock and shipping free multi-cam.** With `isLive` as the only test, a host could let their
  day expire, press Go live again, and hold unlimited multi-cam for as long as they never pressed
  stop. So the grace protects a broadcast that STARTED INSIDE the window; one started after it
  lapsed is a NEXT go-live and gets none. A missing start timestamp degrades to PROTECTED, never to
  a cutoff. The remaining, owner-chosen limit is stated plainly: a host who starts inside the window
  and never stops keeps multi-cam for that one continuous stream — which is the 2026-07-21 lock
  verbatim, applies to a single stream on a single event, and is pushed against by the 12-hour
  archive cap, since stopping and restarting is what preserves their replay.
- **Copy honesty — two facts, not one.** `owned` (may they broadcast multi-cam now) drives the
  capability; `entitled` (have they bought it at all) drives only the WORDS. A host mid-lapse is
  never shown "Unlock · ₱2,999" for a SKU they already own — they get "Add another day", and the
  withheld-cut sentence changes with them. ⚡ highlight moments stay on `entitled` deliberately, in
  step with the server action: a moment is a timestamp, not multi-cam broadcasting, and blocking a
  paying couple from tidying their own moment list after the wedding would be petty.
- **⚠ The controller's entitlement read moved from the SESSION client to the ADMIN client.** A
  correctness fix, not a shortcut: `orders` RLS is purchaser-scoped, so a coordinator running the
  controller for a couple who paid read "not owned" AND zero broadcast-days under their own
  session — silently downgraded to one camera, mid-wedding. Same posture Wave 5's program pop-out
  already documents for the identical read, behind the same `isLiveStudioSetupHost` gate.

### ③ The 12-hour ARCHIVE guardrail (§ 4f ③ · verified 2026-07-25)

YouTube does **not** cap stream duration — but it **archives only the first 12 hours**, so a longer
stream may leave **no replay at all**. For an unrepeatable wedding feeding the Alaala handover that
is the sharp edge, not being cut off. `decideArchiveGuard` warns from 10 hours with the hours of
recording actually left, and states plainly past 12 that a multi-day celebration should be separate
broadcasts. Measured per-BROADCAST (a restart gets a fresh 12 hours), never per-window. **It has no
"stop" output at all** — there is nothing in the type a caller could read as permission to end a
broadcast.

### ④ The coordinator access regression (§ 4f ④ · found by Wave 6)

A coordinator invited through `event_moderators` reached the unified controller and saw an **EMPTY
CHANNEL GRID** — no error, no forbidden, just no cameras. The legacy Cast room admits that
membership and reads its control plane with the service role; the unified controller reads
`live_studio_roam_zones` with the SESSION client, and that policy keys off `event_members.member_type
IN ('couple','coordinator')`, a row a moderator-invited coordinator often does not have. This
matters because *"a friend or coordinator runs the controller"* IS the no-crew pitch.

Fixed in **RLS, not the read path** (migration `live_studio_moderator_control_access`): reading
zones through the admin client would fix the grid and leave every WRITE broken, since the server
actions use the session client. The policies on all three control-plane tables the controller
touches under the host's own session — `live_studio_roam_zones`, `live_studio_overlay_settings`,
`live_studio_highlights` — gain the canonical, repo-wide moderator branch (`accepted_at IS NOT
NULL AND removed_at IS NULL`).

**It restores parity, it does not widen access:** only people the couple explicitly invited and who
accepted; revocation closes the door on the next query; no guest, no vendor, no anonymous user; and
the legacy control room already grants this exact set full control of the same broadcast.
`orders` stays purchaser-scoped and `panood_camera_operators` (which carries seat-hijack tokens)
keeps its control-room-only RLS — the controller reads both through the service role behind its
host gate, which is also why a coordinator is no longer silently downgraded to one camera
mid-wedding.

New `apps/web/tests/db/live-studio-coordinator-access.db.test.ts` — 12 cases against the REAL
replayed schema, both directions: the moderator reads AND writes all three tables; a stranger, a
GUEST member of this very event, a real accepted moderator of a DIFFERENT event, an un-accepted
invite, a removed moderator and an anonymous session are each denied; revoking a live moderator
shuts them out on the very next query; and couple + legacy `coordinator` are untouched. Two things
worth naming about the test itself:
- It carries a **META test that proves RLS is actually being enforced in the harness.** The replay
  connection is the table OWNER and Postgres does not apply RLS to an owner, so without
  `SET ROLE authenticated` every assertion — including the denial ones — passes vacuously. That is
  exactly what happened first time: three green "the fix works" assertions against a connection
  bypassing RLS entirely.
- It was verified to **fail for the right reason**: neutralising the moderator branch in the
  migration fails precisely the 4 moderator-access tests and leaves all 6 denial tests green.

### Flag-off proof

Every new code path is inside `if (liveStudioRoamEnabled())` or inside a module only reached from
one: the watermark `retired` input defaults to `false`, the `first_live_at` stamp is flag-gated, the
window strip and "Add another day" drawer render on the flag-dark controller, and
`resolveBroadcastWindow` is reached only through `canPublishMultiCam` (whose three callers are all
flag-wrapped) and the flag-dark controller. The RLS migration is the one exception and is additive
(`OR EXISTS …`) — it cannot remove anyone's access.

**SPEC IMPACT:** `Live_Studio_Unified_Spec_2026-07-25.md` § 4f — resolves the § 4c "two contradictory
owner locks" open item (the full-screen watermark loses, flag-aware) and records the shipped window
model (fold-with-max anchoring, multi-cam-only gating, `unmetered` grants) + the coordinator RLS fix.
`DECISION_LOG.md` — a row for the retirement and for "the window gates multi-cam, never go-live".
