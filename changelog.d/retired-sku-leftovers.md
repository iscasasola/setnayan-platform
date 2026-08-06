## 2026-08-06 · fix(live-studio): clear the four references that outlived the Live Studio Cast retirement

PR #4170 retired the dead "Live Studio Cast" product — it deleted
`studio/panood/reviews/**` and turned the Cast App Store page into a redirect —
but four things still pointed at what it removed. Each was verified against
production before being touched, and one of the four turned out to be out of
this PR's reach.

### Fixed

**1 · `lib/routes.ts` — a URL builder for a deleted route.**
`routes.dashboard.addOns.panood.reviews` still built
`/dashboard/<id>/studio/panood/reviews`. That folder is gone; the builder had
zero callers, so it could only ever have handed somebody a 404. Removed.

🔑 **The guard that was supposed to catch this DOES NOT EXIST.** `routes.ts`'s
own docblock promises "the route-integrity guard (`scripts/lint-routes.mjs`)
fails the build if a builder points at a folder that does not exist". Three
files cite that script by name — `routes.ts`, `suite-doorway-guardrails.test.ts`
and a changelog fragment — and `node scripts/lint-routes.mjs` is
`MODULE_NOT_FOUND`. The only thing sweeping `routes.*` against the filesystem is
`suite-doorway-guardrails.test.ts`, and it walks only the builders the Suite page
happens to name, so a builder with **no callers** — which is what a dead one
becomes — was unwatched by construction. Replaced with a real sweep (below).

**2 · `lib/sku-activation.ts` — approval hooks for two retired SKUs, none for
the live one.** `PANOOD_SYSTEM` and `PANOOD_SYSTEM_MOBILE` each provisioned
camera-operator seats on order approval; `LIVE_STUDIO`, the SKU actually on
sale, had no hook. Both removed, and **no replacement added for `LIVE_STUDIO`,
on purpose.** Verified in prod before touching anything:

```
LIVE_STUDIO           ₱2,999  is_active = true
PANOOD_SYSTEM         ₱2,500  is_active = false
PANOOD_SYSTEM_MOBILE  ₱1,500  is_active = false
orders across all four service_keys: 0   (the orders table is empty entirely)
panood_camera_operators rows:       16
```

Sixteen seats against zero orders is the proof: **every seat that exists in
production was minted on render, not on approval.** All three camera surfaces
(`studio/panood/{cameras, cameras/print, broadcast}`) call
`provisionPanoodCamerasAdmin` with the tier they resolve at that moment, before
their first read, precisely so a first visit shows seats instead of an empty
page. The unified controller goes further and mints a seat **per channel** as
the host adds one (`bindChannelCamera`), so pre-provisioning a fixed 8 for a
`LIVE_STUDIO` buyer would create seats no channel is bound to and QR tokens
nobody was handed. The hook changed *when* a seat appeared, never *whether*.

The one reachable caller was checked too: `MEDIA_PACK` lists `PANOOD_SYSTEM` as
a bundle child, so `activateBundleChildren()` used to fan out to it. Bundle
ownership is read off `eventSkuActive` and is untouched here — a `MEDIA_PACK`
buyer still resolves `paid` through `resolvePanoodTier` and still gets the full
8-camera cap on first visit.

⚠ `panoodCameraCapForSku()` is **not** dead and was left alone —
`panoodCameraCapForTier()` still calls it for the render-time cap.

**3 · `scripts/page-masthead-baseline.json` — two exemptions for files that no
longer exist.** The reported one (`studio/panood/reviews/page.tsx`) plus a
second the new guard found on its own: `(account)/setnayan-ai/page.tsx`, whose
whole folder is gone. The masthead ratchet is deliberately non-fatal on stale
lines — it prints "remove them to lock the win in" — so **deleting a page
silently widens the exemption list instead of narrowing it.** Removed both.
Three other lines that ratchet names are live files that genuinely migrated to
`<PageMasthead>`; those wins belong to whoever migrated them and were left.

### Not fixed — and why

**`lib/add-ons-catalog.ts` still draws a second live-streaming tile.** The
report is CORRECT: `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is confirmed **on in
production** (the live `/pricing` page lists "Live Studio ₱2,999", which only
renders when the flag is on), so `ADD_ONS` today carries both the `panood` tile
("Live Studio Cast") and the `live-studio-roam` tile ("Live Studio"), and both
now land on the same page.

Deleting the `panood` entry cannot land in this PR, because it forces edits in
files another stream owns:

- `app/dashboard/[eventId]/alaala/page.tsx` — its "Everyone who couldn't be
  there" stage resolves a chip by catalog key, falling back to
  `chip.label ?? entry?.label ?? chip.key`. With the entry gone a couple would
  read a chip labelled **`panood`** — the raw technical key — on their own
  Alaala page. This file is under `app/dashboard/**` and out of bounds here. It
  is the same leftover already fixed in its two siblings (`launch/page.tsx` and
  `galleries/page.tsx` both moved to `live-studio-roam` on 2026-07-27); Alaala
  was missed.
- `lib/studio-recommendations.ts` — `STUDIO_PEAK_MONTHS.panood` and
  `STUDIO_ROADMAP_ANCHORS.setnayan_capture` both name the key, and two drift
  guards fail the moment it stops being a real catalog key.
- `lib/suite-doorway-guardrails.test.ts` — pins the Suite free layer as an exact
  list containing `panood`.

⚠ **Making the tile flag-conditional instead would be worse than leaving it**:
the flag is off in the test environment, so every guard above would stay green
while the Alaala defect appeared only in production.

✅ Checked and NOT a risk: the free single-camera livestream is not lost by that
deletion whenever it happens. `/studio/live-studio-control` — the surviving
tile's destination — already renders "Open the controller — go live free with
one camera" and "the free single-camera livestream stays free".

### Guards added — `lib/live-studio-retirement-leftovers.test.ts`

All four were watched failing against `origin/main` before the fixes landed.
Each is derived from the filesystem or the import graph, never from a second
hand-typed copy of the same list.

1. Every builder under `routes.dashboard.addOns` resolves to a real App Router
   page on disk (handles `[dynamic]` and `(group)` segments). This is the sweep
   the missing `lint-routes.mjs` was supposed to be.
2. `page-masthead-baseline.json` may not exempt a file that has been deleted.
3. `provisionPanoodCamerasAdmin` may only be called from a render-time surface
   (`page.tsx`), never fanned out from an order approval — swept over all of
   `lib/` and `app/` with comments stripped, so a mention is not a call site.
4. `EXACT_HOOKS` registers no `PANOOD_*` key.

Each has a non-vacuity assertion first (≥20 builders walked, ≥3 provisioning
call sites found, >10 hook keys parsed), so a guard that stops finding anything
fails instead of passing.

⚠ What guard 3 does **not** prove: that a paid Live Studio buyer ends up with
cameras. It proves the approval path no longer provisions them.

### Also found, not touched (not this PR's files)

- `scripts/port-control-baseline.json` still carries a
  `/dashboard/[eventId]/studio/panood/reviews` entry. Harmless — that guard only
  reports *lost destinations*, not routes that stopped existing.
- `lint:port-controls` fails on `origin/main` today over
  `/admin/vendors/[seg]` losing two doorways. Pre-existing and unrelated;
  verified identical on a clean tree.
- `lib/add-on-stats.ts`'s comment claims "prod holds 2 paid `PANOOD_SYSTEM`
  orders on one event" (dated 2026-07-21). The `orders` table is empty — that
  line is stale.

SPEC IMPACT: None. No SKU, price, entitlement or catalog row changes. The two
removed activation hooks fired for SKUs with zero orders, and the seats they
provisioned are still provisioned on render.
