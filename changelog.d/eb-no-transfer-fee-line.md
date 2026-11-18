## 2026-11-16 · fix(pay): drop the unruled "₱10–₱15 transfer fee" line from the pay page

The pay page told couples that sending to BDO from another bank "usually costs you a ₱10–₱15 transfer fee; GCash to GCash is free." No owner ruling sets that figure, and Setnayan neither charges nor controls it. Owner ruling (DECISION_LOG 75a46e3c, 16 Nov 2026): remove it until it is set. The "save the code to your photos" tip stays. This was the only place the claim appeared. New guard `lib/no-unruled-transfer-fee.test.ts` keeps it out in any spelling. Sabotage: putting the sentence back took the occurrence count 0 → 1 and turned the guard red.

SPEC IMPACT: None — copy only, no price, no logic.
