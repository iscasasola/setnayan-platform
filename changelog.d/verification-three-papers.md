## 2026-11-14 · copy(suppliers): verification asks for three papers — the feature pages and llms.txt

Owner, DECISION_LOG 14 Nov 2026 "VERIFICATION NEEDS THREE PAPERS, NOT FOUR": DTI or SEC · BIR 2303 · Mayor's or
Business Permit. Bank proof is gone. Ahead of the ad campaign:

- `/features/supplier-verified` (EN + TL description, answer, "What papers do I need?") and `/llms.txt` (the Verified
  paragraph and "How are suppliers verified?") now name the three papers.
- NOT here, because #7627 ("three papers, one Submit") already edits them: `/for-suppliers`
  (`supplier-front-page.tsx`, `supplier-front-data.ts` `VERIFIED_PAPERS`), `/for-coordinators` (`page.tsx`), the
  Help article, `lib/feature-pages/plan-b.ts` (Marketplace), and the verification code itself.
- Plan caps on /for-suppliers vs /for-coordinators: measured identical (Free, Verified, all three paid plans and the
  reach ladder, all from `TIER_CAPS`). The pages carry two copies of the helpers, so a new guard
  (`lib/the-two-supplier-pages-say-the-same-caps.test.ts`) fails the day they diverge.
- Guard `lib/verification-asks-three-papers-in-public-copy.test.ts`: no feature page and no llms.txt asks for bank
  proof; the Marketplace page is exempt only until #7627 lands, and the exemption fails once it is no longer needed.

SPEC IMPACT: None — implements the 14 Nov ruling on public copy.
