## 2026-09-06 · fix(store-shell): the eight paid surfaces the /studio gate could not see

PR #5186 (2026-09-05) gated the Studio tree and three purchase routes, and its
PR body claimed the only residual risk was free tools embedding the inert
checkout drawer. **That claim was wrong.** An audit against `origin/main` on
2026-09-06 found eight more surfaces showing a peso price for a digital SKU, or
running a paid feature, inside the Capacitor shell.

🔑 **WHY THE FIRST FIX MISSED THEM.** The gate was a path allowlist over
`/studio/*`, and its test only grepped `page.tsx` files for
`InlineCheckoutDrawer`. Paid features whose home is elsewhere, and price-bearing
upsells mounted on otherwise-free pages, were invisible to both. A test that
cannot see the defect class is not coverage.

**The worst one was not introduced by #5186 — it predates it.**
`web-nudge-banner.tsx` rendered ONLY when `isNativeApp()` was true, read
*"Buy on our website for less — up to 33% off"*, and linked to `setnayan.com`
with `target="_blank"`, beside plan cards that multiplied the admin-set price by
`1.5` for native users. That is guideline 3.1.1 external steering, and it also
contradicted DECISION_LOG 2026-06-11, which locked vendor subscription billing
as web-only. Its docblock justified itself with a "post-2024 Apple ruling"
allowing external purchase links — that ruling covers the **United States
storefront only**, and the 2026-06-30 rejection letter says the rest plainly:
*"for storefronts where there are not alternative options … the app must use
in-app purchase."* We ship to the Philippine storefront. The premise never
applied to us. The component is **deleted**, not hidden.

**Two mechanisms, split by what the page is:**

- **Route refused** (`WEB_ONLY_FEATURE_ROUTE` in `lib/store-shell.ts`) when the
  whole page IS the paid thing — `/vendor-dashboard/subscription` and
  `/dashboard/<id>/live` (the Live Venue Photo Wall, which worked in the app
  once bought on the web: guideline 3.1.3(b) verbatim, the exact reasoning App
  Review used).
- **Component withheld** when a free page merely carries an upsell, so the free
  tool stays whole — the Setnayan AI comeback offer on the dashboard home, the
  Animated Monogram upgrade under the free monogram maker, the Event Hub PRO
  offer, the Suite's paid tiles (via `surfaceOk`, mirroring Studio), and the
  Papic guest buy panel on `/papic/guest` and `/papic/seat/[token]` (the guest's
  free camera is untouched).

**Build numbers bumped** — iOS `CURRENT_PROJECT_VERSION` 1 → 2, Android
`versionCode` 1 → 2. Both were still byte-identical to the rejected 1.0 (1), and
App Store Connect refuses a duplicate build number, so the previous `.ipa` could
never have been uploaded at all.

**Web / PWA / desktop: byte-identical.** Every change is behind
`isStoreShellRequest()` / the route gate, which excludes the Tauri desktop UA.

**Tests** — `lib/store-shell.test.ts` grows to 15. The load-bearing one asserts
a SHAPE rather than a filename: any component that both branches on native-ness
and opens an external `setnayan.com` link fails, so the steering pattern cannot
return under a new name. **Sabotage-verified** — a probe file with that shape
turns it red, and removing it turns it green again, because this repo has
shipped inert guards before. Also pinned: the marked-up price cannot come back,
and neither build number may sit at the rejected value.

⚠ **Still open, stated rather than hidden:** free planning tools that embed the
(inert) drawer — Save the Date, Indoor Blueprint, Seating, Mood Board, the
supplier workspace — stay reachable, so content bought on the web still plays in
the app. If App Review presses on 3.1.3(b) again, the lever is one line per page
in `STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS`. The real resolution is Apple IAP,
which the owner scheduled for v1.1 on 2026-06-25.

SPEC IMPACT: None — implements the 2026-09-05 DECISION_LOG row (store shell =
planning + guests + supplier bookings until IAP). That row's scope is unchanged;
this corrects an incomplete execution of it.
