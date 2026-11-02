## 2026-06-25 · fix(studio): Setnayan AI opened-state — outcome/action first, pitch gated to buyers

Extends the In-App Services Consistency Plan's Tier-4 rule (an opened tool surface
must not re-pitch an owner) to the one surface that was deferred: Setnayan AI.

Before, `studio/setnayan-ai/page.tsx` led with the marketing hero ("Stop guessing
who to hire") + a 3-card "what you get" grid for EVERYONE — including a couple
whose AI is already on. Now the marketing renders only in the BUY state:

- ACTIVE → outcome first ("Your vendor shortlist is ranked") + a primary CTA to
  the actual tool (/vendors). No sell cards.
- OWNS-BUT-OFF → action first ("turn on Assisted planning") + CTA to the planning
  home. No sell cards.
- BUY (non-owner, paywall on) → the only selling state: hero + "what you get" +
  InlineCheckoutDrawer at the live catalog price (formatV2Sku, no hardcode) with
  the pricing-degrade fallback.

Pure render restructure — the state logic (paywall flag, isSetnayanAiActive,
eventOwnsSku, showBuy), gates, and live-price read are unchanged. Adversarially
verified (states correct, buy intact, real tsc 0 new errors).

SPEC IMPACT: none.
