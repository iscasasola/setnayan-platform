## 2026-11-21 · fix(3d-booth): the per-event booth buy form is Pro and up — Plus sees "Included in Pro · Upgrade"

- **Why:** a verified Plus shop still met the ₱ per-event 3D booth buy form whenever the `vendor_3d_booth_event`
  price row was active, because the section and `buyBoothBrandingForEvent` floored at `BOOTH_BRANDING_MIN_TIER`
  (Plus). Owner 20 Nov ("the 3D booth … is part of Pro and Up") and specs 66ae2cce (21 Nov: special tools are
  included in Pro and up; Free · Verified · Plus see "Included in Pro · Upgrade", no other way to buy).
- `booth-event-section.tsx`: the floor is `isTierAtLeast(resolveVendorTier(…), PRO_TOOLS_MIN_TIER)` — the effective
  plan, as the Special tools read it. Below Pro the shared 🔒 says `Included in Pro · Upgrade` (plan word from
  `planWord`, never typed).
- `booth-event-actions.ts`: the server refuses below Pro the same way (no new action — 1251/1251).
- `brand-your-booth-at-one-wedding.test.ts`: pins both floors and the words; red when either goes back to Plus.

SPEC IMPACT: None (implements specs 66ae2cce / DECISION_LOG 2026-11-20 "SUPPLIER AI CHATBOT, 3D BOOTH AND PHOTO
CHALLENGE ARE INCLUDED IN PRO AND UP").
