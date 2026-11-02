## 2026-08-12 · docs(decks): correct every price in the archived decks — owner "fix them"

Follow-up to #4372/#4373. The owner asked for the two things left open. **One of them
turned out not to be broken** — that is reported below rather than "fixed".

### ✅ The deck prices — genuinely wrong, now corrected

Every figure was **read out of the live catalog** (`platform_retail_catalog_v2` and
`vendor_billing_catalog`, `is_active = true`) and the owner-signed
`VENDOR_TIERS_AND_BENEFITS.md`. Nothing was retyped from memory or from the decks.

| was | now |
|---|---|
| Panood · multi-cam livestream **₱18,000** | **Live Studio ₱2,999 / event** |
| Papic · paparazzi app **₱8,000** flat | **50 free, then ₱50 – ₱5,000** — credits, not a fee |
| Patiktok **₱6,500** | **₱1,500 / day** |
| Pakanta **₱4,500** | **₱2,500** |
| Pro subscription **₱1,999/28d** · Enterprise **₱5,499/28d** | **₱2,500** · **₱8,000**, and **Solo ₱1,000** added (it was missing) |
| Vendor verification **₱1,499 once** ("not ₱299/28d") | **FREE — free during launch** |
| Bidding token packs **₱1,000–₱18,000** | **removed** — the currency was retired 2026-08-07; answering is free on every tier |
| Pailaw · LED background loops **₱6,000** | **removed** — product removed 2026-08-11 |

**Deleted rather than repriced**, because nothing on sale corresponds: *AI Highlight
Reel ₱12,000* · *Photo Delivery ₱3,500* · *Invitation Widgets Pro ₱1,500* · *Document
update ₱499* · *Boosted Ads ₱1,200/wk*. 🔑 **Quoting a price for something we do not
sell is the exact defect this pass exists to remove** — inventing a replacement number
would have repeated it. The README names all five so a real one can be restored.

🚨 **The worst line was not a price.** The vendors deck told vendors they could
*"purchase Setnayan Productions services (Panood, Papic, AI Reel, **Pailaw**, Pakanta)
… and resell them"*. Two of those five are undeliverable. It now names only Live
Studio, Papic, Patiktok and Pakanta. Also corrected: "Panood" (retired as the customer
name 2026-06-29) → Live Studio, in all 8 rendered places.

### ❌ The vendor category — MY EARLIER CLAIM WAS WRONG

I told the owner "vendors can still list Setnayan LED Background as a service".
**They cannot, and could not.** `lib/open-shop-service-tree.ts:69` filters every
`setnayan_*` leaf out of the picker by prefix, `resolvePickedLeaf` re-resolves against
that same filtered tree so a forged POST returns null, and
`tests/db/open-shop-service-tree.db.test.ts` exists solely to pin it — *"the /open-shop
service picker must never offer a first-party Setnayan SKU"*.

Prod agrees: **0 of 2 vendors** use `setnayan_pailaw`, or any first-party leaf.
**No change made.** Reporting a non-problem as fixed is how shipped work gets rebuilt.

🪤 I nearly concluded the opposite twice: first querying `service_categories` (which
holds folders and tiles — the 276 leaves live in `canonical_service_taxonomy`), and
getting an empty result that looked like "it isn't in prod". **Audited through the
wrong catalog, again.**

### 🪤 Traps hit while doing this

- **A non-breaking space** sat between "team" and "accounts" in the Enterprise line, so
  an exact-match replace found 0 hits. The script **validated every substitution before
  writing anything** and aborted with nothing changed — which is why it was caught
  rather than half-applied.
- **My own correction comments then polluted my own greps.** After fixing the prices, a
  `grep -c "5,499"` still returned 1 — from the comment explaining the fix. Every audit
  below strips comments first. Same disease as the removal comment that blinded a CI
  guard yesterday: **counting matches is not reading them.**
- Two rendered slides still headlined **₱1,999** after the price table was fixed — a
  headline and a display figure, invisible to a table-shaped search.

### Verified

Both decks **parsed** (esbuild JSX) and then **actually rendered** — served locally and
inspected in a browser: 320 and 255 visible text nodes, not stuck on "Loading…", zero
occurrences of Pailaw / token / any retired price, and the new rows present on screen
(`Live Studio · livestream`, `₱2,999 / event`, `Papic · guest paparazzi`).

SPEC IMPACT: None — no product decision changes. ⚠ Surfaced, not resolved: the signed
rate card quotes ₱999/₱2,499/₱7,499 where the live vendor catalog says
₱1,000/₱2,500/₱8,000. The DB wins per the source-of-truth order and was used here, but
that divergence predates this work and is the owner's to settle.
