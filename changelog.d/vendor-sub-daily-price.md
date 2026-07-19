## 2026-06-20 · feat(vendor): subscription cards show the per-day / per-week unit price

Owner-directed. Under the Pro/Enterprise headline price (₱6,000 / 28 days · ₱10,000 / 28 days), the cards now also show the same price as a small unit — e.g. **≈ ₱214/day · ₱1,500/week** — the "bill monthly, display the small unit" small-number framing.

- **`subscription/_components/subscription-cards.tsx`** — derives `perDay` / `perWeek` from the existing per-card `displayPrice` (28-day block ÷ 28 and ÷ 4; annual ÷ 365 and ÷ 52) and renders one muted line under the headline price. Works for both cycles and for native-app SRP (derives from each card's `displayPrice`).

Pure DISPLAY derivation of the admin-set catalog price — no price value is set or changed, so it doesn't pre-empt the pending holistic pricing pass.

SPEC IMPACT: vendor subscription pricing presentation (iteration 0022). Logged in `DECISION_LOG.md`.
