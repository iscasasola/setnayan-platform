## 2026-06-29 · feat(setnayan-ai): per-user subscription buy page (cycle picker) — the visible buy flow

The buyer-facing screen that completes the per-user Setnayan AI subscription flow.
Account-level (eventless) page with a cycle picker; checks out through the shared
drawer in subscription mode. DORMANT behind the per-user flag.

- **`app/dashboard/(account)/setnayan-ai/page.tsx`** (new) — account-level (not
  event-scoped, since the subscription covers ALL the buyer's events). Shows the
  buyer's current window ("active through {date}") + the buy UI. Gated by
  `platform_settings.setnayan_ai_per_user_enabled`: OFF (today) → a "coming soon"
  card (inert); ON (go-live) → the cycle picker. Unit price read from the catalog.
- **`.../setnayan-ai/_components/setnayan-ai-subscribe.tsx`** (new, client) —
  cycle presets (1/3/6/12 × 28-day cycles), live total, and the
  InlineCheckoutDrawer wired eventless (`eventId=''`) with `cycles`. Total is
  display-only; the charge is re-resolved server-side as catalog unit × cycles.
- **`inline-checkout-drawer.tsx`** — added an optional `cycles` prop (passed to
  the checkout as a form field). When omitted, every existing event-scoped SKU
  behaves byte-identically.

End-to-end now wired: page → drawer (cycles) → submitOrderAction (eventless +
unit × cycles, #2427) → activation hook (extends user_ai_subscription, #2413).
typecheck + lint clean; CI production-build gates the merge.

Still INERT: SKU inactive + per-user flag off → the page shows "coming soon" and
the buy UI never renders. Go-live (a later owner step) = flip the SKU active +
flip the flag + reconcile public /pricing + link the page into nav.

SPEC IMPACT: None to live behavior — dormant page behind the off flag; no schema
change. Completes the buy-flow surface for the ₱499/28-day subscription recorded
in DECISION_LOG + the decisions doc.
