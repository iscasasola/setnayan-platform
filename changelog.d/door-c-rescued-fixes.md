## 2026-11-22 · fix(onboarding): Door C — no "goes live" promise, PC1 Picked row, Later on the invite, PC7 names the service

Rescued from the local 20 Nov line (`rescue/2026-11-22/doors-c`), on top of what shipped as #8031 — the parts main
did not have.

- **PC4:** the page link no longer says "goes live when you open". It says "your card shows here once it's live"
  (`PAGE_LINK_LINE`) — the card is on the page only when the shipped switch says so.
- **PC1:** a "What you do · Coordination · ✓ Picked" row above the one coordination dropdown.
- **PC7 · invite screen:** "Later" beside Done on `/open-shop/invite`. Both go where the first card lands.
- **PC7 · the `/i/<slug>` door** names the inviter's main service ("Lia Events · Coordination"): `readInviter` reads
  `services`, and `serviceLabelOf` gives the admin-managed name. No service read → the name alone.
- Lab: `/dev/open-shop-lab?screen=invite` draws the /i door on a fixture inviter.
- Tests: `lib/supplier-onboarding.test.ts` 13 (new); `the-approved-redesign.test.ts` follows PC1's row.

Not carried from the rescue branch: the PC7 shop card as "rows on white" (main kept the approved drawing's card,
ship-reviewed), the stale round-2 shots, the local regenerate commits.

SPEC IMPACT: None.
