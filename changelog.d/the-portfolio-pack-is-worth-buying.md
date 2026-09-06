## 2026-09-06 · fix(papic): a ₱500 supplier pack grants 100 credits, not 25

Owner ruling 2026-09-06, raising his own 2026-09-05 figure after the arithmetic
was put in front of him. **The price did not move; what ₱500 buys did.**

A credit is 1 photo, or ⅛ of a ten-second clip. Read from
`platform_retail_catalog_v2`, a COUPLE pays **₱0.70/credit** on the small packs,
and our own `saas_overhead_cost_php` is **₱0.024/credit — flat at every tier**.
At 25 credits a supplier paid **₱20/credit: 29× the couple's price and 833× our
cost**, so ₱500 bought them 25 photos, or **three ten-second clips**. A pack
nobody buys earns nothing, whatever its margin.

At 100 the supplier pays **₱5/credit** — still **7× what a couple pays**, which
is the premium the owner wanted (*"vendors make money from their events, users do
not"*), still a **99.5% margin**, and ₱500 now buys 100 photos or 12 clips.

🔑 **IT ALSO PUTS THE VIDEO THRESHOLD BACK WHERE IT WAS PRICED, WITHOUT MOVING
IT.** "800 credits will allow them to take videos" (2026-08-26) was set against
the retired ₱5/point rate — a **₱4,000** spend. When the rate became 5% of the
booking fee, 800 credits silently became **₱16,000**, or 32 packs: four times
harder, with nobody deciding that. At ₱5/credit it is ₱4,000 again, exactly. **The
threshold was never wrong — the credit under it got four times dearer.** So
`VENDOR_PAPIC_VIDEO_CREDITS` is UNCHANGED at 800, and the third open question
from PR #5201 is answered by fixing the other number.

⚠ **The 5% rebate and the pack no longer imply the same rate, deliberately.**
They once did (₱500 ÷ 25 was also ₱20) and the coincidence read like a design. It
was not: the 5% is a REBATE on money already paid to us, the pack is a PURCHASE
somebody has to choose to make, and only one of them has to be worth buying.
Nobody can arbitrage the gap — a supplier cannot pay extra booking fees to mint
credits. `VENDOR_PAPIC_PHP_PER_CREDIT` (the 5%) and the cap of 1,000 are
untouched.

The `offerPack` boundary test now reads the CONSTANT rather than the literal
`25`, so the next re-price cannot leave a test asserting a boundary the code has
already moved past — which is exactly how the 800 threshold drifted.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-05 "500 pesos for 25 papic credits"
row is superseded by "500 pesos for 100 papic credits" (2026-09-06); the 5% rate,
the 1,000 cap and the 800 video threshold are unchanged.
