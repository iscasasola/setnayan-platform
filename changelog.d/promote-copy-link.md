## 2026-11-06 · feat(shop): Promote › Your QR codes — Copy link sits beside Share

Owner, 6 Nov: *"Use fable to decide. Find the best location for each. Make the pages live there and not jump to
another menu."* — DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL", row (1): Your QR codes = Which code ▾ ·
Share · **Copy link** · Save · Write to NFC.

- RULE 0: Copy link already existed — a small chip in the `QrActions` strip under every `QrCard`. Delta only: it is
  now a button in the card's own row (Share · Copy link · Download), and the strip is mounted with `hideCopy`, so a
  card never carries two Copy links. The strip keeps Write to NFC.
- One card draws every supplier code, so Shortlist · Check a date · My page (Promote) and Booked · Crew (Customers),
  and the setup screen's shop code, all get it.
- Guard: `lib/supplier-qr-codes.test.ts` pins the order, one Copy link per card, and `hideCopy` on the strip.

SPEC IMPACT: None — implements DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" row (1); no corpus edit.
