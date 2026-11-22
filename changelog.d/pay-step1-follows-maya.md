## 2026-11-22 · fix(pay): with Maya on, step 1's "What happens next" follows the Maya route

Seen live on /pay/SN1E342727: with Maya as the pay stage, step 1 still listed the BDO route ("Scan the code…", "Upload the screenshot…", "…as soon as our team confirms") and the transfer-note line. Step 1 now reads the page's own `mayaOpen`, the same decision that hands the pay panel its Maya stage:
- Maya open: "Pay on Maya's secure page." · "Come straight back for your receipt — nothing to upload." · "It switches on the moment it's paid." There is no transfer-note line.
- Maya closed (off, no keys, busy, or above the ceiling): the BDO words, unchanged.

The copy lives in `lib/pay-next-steps.ts`. Back from Maya, the "checking" page also uses the Maya words. Test: `lib/pay-step-one-follows-maya.test.ts`.

SPEC IMPACT: None.
