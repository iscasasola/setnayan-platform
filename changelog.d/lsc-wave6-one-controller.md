## 2026-07-25 · feat(live-studio): one controller — legacy Cast room redirects to live-studio-control (flag-aware)

**Consolidation to ONE Live Studio controller** (owner 2026-07-25 ·
`Live_Studio_Unified_Spec_2026-07-25.md` §§ 4b–4d). Two control rooms existed in the tree: the
LEGACY Cast room at `/dashboard/[eventId]/studio/panood/broadcast` (live and **selling** the
`PANOOD_SYSTEM` SKU) and the unified controller at
`/dashboard/[eventId]/studio/live-studio-control/setup` (dark behind
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`). The unified controller becomes the main one; the legacy
room is **retired by redirect, not deleted.** Opened as a **DRAFT** PR (no auto-merge).

**Everything here is flag-conditional.** Flag OFF = today, byte for byte, on every live surface —
the legacy room renders exactly as before (the guard is one `if` as the first statement of the
component; nothing below it moved) and every doorway still resolves to it. Flag ON = the whole
switchover happens **atomically, in-request, with no deploy**.

- **ONE ROUTER, not six ternaries** — `liveStudioControllerHref(eventId)` in
  `apps/web/lib/live-studio-control.ts` is now the only way a doorway names "the control room".
  Its decision is factored out as a pure `liveStudioControllerHrefFor(eventId, unifiedEnabled)` so
  it is exhaustively unit-tested without touching `process.env`; only the thin wrapper reads the
  flag. Repointed **six** doorways through it:
  - `app/dashboard/[eventId]/studio/panood/page.tsx` — the Cast tile's owned→launch CTA (also
    feeds `resolveAddOnState`)
  - `app/dashboard/[eventId]/studio/panood/setup/page.tsx` — "Open the control room"
  - `app/dashboard/[eventId]/studio/panood/cameras/page.tsx` — "Back to the control room"
  - `app/dashboard/[eventId]/launch/page.tsx` — the day-of **"Go live"** button (pressed once, at
    the wedding — the doorway that must never be the stale one)
  - `app/dashboard/[eventId]/galleries/page.tsx` — "Watch the recording"
  - the legacy route itself, via the redirect below
- **LEGACY ROUTE REDIRECTS (flag ON)** —
  `studio/panood/broadcast` → `studio/live-studio-control/setup`, as the first statement in the
  page component, before auth and before any query. This catches what repointing links cannot:
  bookmarks, browser history, an old email, a QR printed last month, a hand-typed URL.
  `redirect()` (307), **not** `permanentRedirect()` — a 308 cached in a host's browser would
  survive a rollback of the flag.
- **⭐ ENTITLEMENT CONTINUITY — existing Cast buyers are NOT stranded.** The unified controller
  resolves every paid decision (multi-cam publish, paid overlays, highlight moments) from
  `LIVE_STUDIO`. Flipping the flag would therefore have silently downgraded every couple who
  **already paid for Cast** to the free rehearsal tier — for a day that cannot be redone. Closed
  with an ownership **alias**, the existing mechanism (same shape as
  `LIVE_BACKGROUND ← ANIMATED_MONOGRAM`): `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO` now reuses
  `PANOOD_PAID_SKUS` (`PANOOD_SYSTEM` + the legacy `PANOOD_SYSTEM_MOBILE`) — the same canonical
  pair `resolvePanoodTier()` reads for the legacy room's own paid gate, so "who paid for Cast" and
  "who keeps it after the consolidation" cannot drift apart.
  - **No migration, no backfill** — ownership still IS `orders.status`, read one extra way, so it
    covers past AND in-flight Cast orders and reverses cleanly on a rollback.
  - **Refund-aware** (inherits the status filter) and **one-directional** (a `LIVE_STUDIO` buyer
    does not own `PANOOD_SYSTEM`).
  - **Inert while the flag is off:** every reader of `LIVE_STUDIO` ownership already sits behind
    the flag (the controller `notFound()`s, its actions redirect, `/panood/program` reads it only
    inside the flag branch, the public loader's roam block is flag-wrapped, and the `LIVE_STUDIO`
    tile is only appended to `ADD_ONS` behind the flag).
  - **Known edge, documented not closed:** aliasing resolves at the order-query level, while the
    bundle pass keys off the canonical code, so a holder of the retired `MEDIA_PACK` bundle owns
    Cast but not `LIVE_STUDIO`. Same pre-existing shape as `EDITORIAL_PRO ← COUPLE_WEBSITE_PRO`;
    both bundles were retired 2026-06-29, and the remedy for any such event is an admin comp grant.
- **DELIBERATELY NOT IN THIS PR** — (a) the `PANOOD_SYSTEM` SKU is **not** retired: that needs a
  migration, which auto-applies on merge and would kill live Cast sales while the new product is
  still dark (same reasoning as PR #3682); (b) the legacy control-room code is **not** deleted — it
  must keep working while the flag is off, and deletion is a later cleanup once the flag is on and
  verified.
- **Route registry** — added the missing `routes.dashboard.addOns.liveStudioControl.{index,control}`
  builders and annotated `…panood.broadcast` as the legacy room, with both pointing readers at
  `liveStudioControllerHref()` rather than either literal path.

**Tests** — 5 new router invariants in `lib/live-studio-control.test.ts` (flag off → legacy room ·
flag on → unified controller · only the exact string `'true'` flips it · the two rooms are never
the same URL, so the redirect cannot loop · the resolved href is always a real route under the
event and never the buy page) + 4 grandfather invariants in `lib/entitlements.test.ts` (a paid
Cast order confers `LIVE_STUDIO` on either device tier · a refunded one confers nothing · the
grant is one-directional · the alias query asks for all three codes). Unit suite 3310/3313
(3 pre-existing failures are missing optional deps in the local install, unrelated).
`lint:entitlement-gates`, `lint:changelog-dir`, `lint:masthead` and ESLint clean; typecheck clean
on every touched file.

**Dead-link attack** — full-repo sweep for `panood/broadcast`: every remaining occurrence is a
comment, a changelog fragment, a filesystem import path, the legacy room's own `revalidatePath`,
the masthead-lint allowlist, or the helper/tests. **Zero links** to the legacy route survive
outside the router. Emails, help/editorial content, `middleware.ts`, the PWA manifest, the service
worker, the customer sidebar/bottom-nav, and the e2e specs contain no reference to it. No
`router.push` to it anywhere. Stale "built at /studio/panood/broadcast" pointer comments updated.

**Owner actions at cutover** (both intentionally left to the owner): retire the `PANOOD_SYSTEM`
catalog row so `/studio/panood` stops selling the superseded Cast SKU, and resolve the
contradictory free-tier branding locks flagged in the spec (§ 4c — `lib/panood-watermark.ts`'s
full-screen overlay vs. the new "POWERED BY SETNAYAN" lower third both draw today).

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4b/§ 4d — the unified controller is now
THE controller: the legacy Cast control room redirects into it and all six doorways route through
one flag-aware helper. Adds the grandfather clause the spec's "RETIRE `PANOOD_SYSTEM`" line (§ 3)
did not specify: existing Cast buyers keep multi-cam via an ownership alias, no migration. The SKU
retirement itself remains an owner cutover step.
