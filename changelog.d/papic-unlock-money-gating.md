## 2026-06-26 · feat(papic): PAPIC_UNLOCK free-Unli allowance + DB bundle mirror + "add-ons require Papic active" (PR9 follow-up)

Completes the three parts left DEFERRED by the "Unlock all of Papic" umbrella
(`changelog.d/papic-umbrella.md` · PR #2269) — each touches live payment/gating
logic, so they were split out for a careful build. Stacked on `papic-umbrella`
(that PR introduces `PAPIC_UNLOCK` + `BUNDLE_CHILD_SKUS.PAPIC_UNLOCK`).

**1 · Unlimited-Unli camera allowance (money logic).** Owning an ACTIVE
`PAPIC_UNLOCK` makes the **Unli** camera tier free + uncapped for the event — Roll
(Ltd) is NOT freed (umbrella covers Unli only).
- Capture-gate bypass: a per-camera Unli seat whose order isn't paid still shoots
  when the event owns PAPIC_UNLOCK (`app/papic/actions.ts` recordSeatCapture +
  `app/api/upload/route.ts` presign). Gated through the new
  `eventUnliFreeViaUnlock()` (`lib/papic-cameras.ts`) — bundle-aware
  `eventSkuActive('PAPIC_UNLOCK')`, **fail-CLOSED** so a hiccup never frees a paid
  camera for a non-owner. Unli's daily quota is already unlimited.
- ₱0 provisioning: `computeCameraQuote()` gains an `unliFree` option (Unli charge →
  ₱0, never trips the Unli cap); `purchasePapicCameras` zeroes the Unli charge for
  umbrella owners and lands a ₱0 **`fulfilled`** comp order when the whole quote is
  free (cameras active immediately, no payment instructions). The picker
  (`camera-picker.tsx`) shows Unli as "free with Unlock all" + a Free total.

**2 · DB `bundles_granting_sku()` mirror.** New migration
`20270303150000_papic_unlock_bundle_granting_sku.sql` re-declares the function with
the GUIDED_PACK/MEDIA_PACK pairs (verbatim) **plus** PAPIC_UNLOCK → its 6 children,
so the DB gate `papic_event_owns_service` (provisioning + RLS) agrees with the
app-side map. Filename deliberately avoids the `_papic_ownership_bundle_aware.sql`
suffix so `lint:entitlement-gates` Guard 2 keeps reading the original for
GUIDED/MEDIA sync (PAPIC_UNLOCK pairs are out of Guard 2's scope by design).

**3 · "Add-ons require Papic active" prerequisite.** New
`eventPapicActive(eventId)` (`lib/papic-seats.ts`) = any non-revoked
`paparazzi_seats` row (paid camera OR free sampler) OR an active Papic-inclusive
SKU/bundle (`PAPIC_UNLOCK` / `PAPIC_SEATS` / `PAPIC_GUEST` — transitively covering
MEDIA_PACK + GUIDED_PACK). **Bundle owners are always Papic-active**, so a
Complete/Essentials/Unlock-all buyer who owns an add-on via the bundle is never
blocked. Each implemented add-on's use + buy now gates on (owns add-on) AND
(Papic active):
- **Kwento** — owner queue + inline buy (`studio/papic/moderation/page.tsx`) and
  the guest submit endpoint (`api/papic/kwento/route.ts`).
- **Photo Wall (LIVE_WALL)** — the couple's control card
  (`_components/live-wall-card.tsx`) renders only when Papic is active (else a
  "set up Papic first" note).
- **Pabati** — the guest recorder page (`pabati/[eventId]/page.tsx`).
- **Thank You / Stories** — no use/buy surface exists yet (nothing to gate).
- **Camera Bridge** — "included with Papic" honest card (no separate buy);
  inherently Papic-gated.

Unit tests: `lib/papic-cameras.test.ts` locks the `unliFree` quote math (Unli → ₱0,
Roll untouched, no cap-trip). Verified: typecheck + next lint + entitlement-gates +
papic-keep + retired clean; `test:unit` green (entitlements 40 + papic-cameras 5).

⚠ OWNER SIGN-OFF (load-bearing): (a) PAPIC_UNLOCK frees **Unli only** (Roll/Ltd
still bill) at ₱0 + uncapped; (b) "Papic active" counts the free sampler and all
Papic-inclusive bundles. Both per the task spec / owner 2026-06-26.

SPEC IMPACT: None new — completes the deferred items already logged under
DECISION_LOG 2026-06-26 (Papic umbrella). The free-Unli allowance + the
"add-ons require Papic active" rule are owner decisions (2026-06-26) flagged for
sign-off above.
