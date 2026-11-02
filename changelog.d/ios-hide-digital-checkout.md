## 2026-06-25 · fix(payments): hide in-app digital-SKU checkout in the native shell (App Store 3.1.1)

The iOS/Android Capacitor shell loads the live site, so an in-app reviewer could
reach `InlineCheckoutDrawer` — which on native rendered a `window.open(_system)`
**steering link** to web BDO/GCash checkout. An external purchase link for
Setnayan's own digital SKUs is an App Store Guideline 3.1.1 (and Play Billing)
violation, with no PH anti-steering carve-out.

Fix (one client component, `inline-checkout-drawer.tsx`): on native (`SetnayanApp`
UA, detected post-mount) the trigger is now an inert, price-less, link-less
locked chip — the feature stays visible, but there's no buy mechanism and no
pointer to where to buy. Removed `openWebCheckout()` + the `_system` link.

- **Web / PWA / desktop: byte-identical** — the full in-app BDO/GCash drawer is
  unchanged (gated on the post-mount `isNativeApp` flag, false off-native).
- **Vendor real-world bookings** use a separate surface (`vendor-direct-pay`) and
  are 3.1.1-exempt — untouched.

Deployed mid-review so the live site the reviewer's WebView loads is compliant.

SPEC IMPACT: Implements the v1 "hide in-app digital checkout" posture (full Apple
IAP = v1.1; iOS price = web ÷ 0.85 — DECISION_LOG 2026-06-25). Supersedes the
2026-06-16 route-to-web native branch (that external link was itself the violation).
