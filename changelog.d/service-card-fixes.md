## 2026-11-16 · fix(supplier): the service card maker — walk step 3's four faults

Fault-fix build on the shipped maker (no redesign). Each fault was reproduced in `/dev/card-maker-lab` at 390 before the fix; cut 3 (2026-11-14) had already covered part of 2–4, so this closes what it left open.

- **1 · What was typed is kept.** Today's "What you offer" step drew the maker inside a `Sheet`, which draws nothing while shut — so ✕, the backdrop, Back, or a tap that missed a field under the Cancel · Create row unmounted the maker, and the next open was a blank card (price, name, what's included all gone). The maker now lives in one holder for the life of the step; the open sheet shows it. Only a made card starts the next one fresh. Within the maker itself a typed price was already kept (measured).
- **2 · The sign-up service is never asked about.** Sign-up stores `vendor_profiles.services` as `[coarse category, picked leaf, …]`. Cut 3 counted only the entries that are live leaves, but a card's kind is asked about through `coverageLeafForKind`, which maps a coarse kind to its tile's leaf. Every entry now goes through that same rule (`signupCoveredLeaves`). Read only.
- **3 · New service opens on the shop's own services.** The dashboard's Add-a-service picker opens with the shop's own services that have no card yet already picked ("Make 1 card"). The whole catalogue stays under them. The maker's "What you offer" sheet leads with the same kinds (now including a coarse-only sign-up).
- **4 · Fields are reachable at 375/390.** Today's New service sheet rises full screen on a phone (2026-11-10 "a form rises full screen"); it opened at half height and the fixed Cancel · Create row left a ~60 px window. The page and the sheet body keep a bottom scroll-padding the height of that row, so a field being typed into stops above it. The phone preview stays one tap away (cut 3); open draft #7860 re-pins it, and these fixes hold either way.
- Re-aimed (claim kept): `lib/supplier-cuts-the-card.test.ts` (1) and `the-maker-sheets-open-on-top.test.ts` (Today host). Lab: `/dev/card-maker-lab?host=add&cards=0`.
- Guards: `lib/the-signup-service-is-never-asked.test.ts` · `lib/the-new-service-picker-opens-on-the-shop.test.ts` · `app/vendor-dashboard/_components/the-today-maker-keeps-what-was-typed.test.ts` · `app/vendor-dashboard/services/the-maker-fields-clear-the-bar.test.ts` — each sabotaged once and seen red.
- Shots: `build-sessions/shots-service-card-fixes/`.

SPEC IMPACT: None.
