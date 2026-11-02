## 2026-09-22 · the marketplace's first sort key is purchased, and nothing says so

W7 / register SUP-74 (EX-7), which the register marks NEEDS MEASURING. Measured.

The public marketplace sorts `ad_rank → review_count → rating`, and production
defines `ad_rank` as:

```sql
CASE WHEN vaa.tier = 'sponsored' THEN 2
     WHEN vaa.tier = 'boosted'   THEN 1
     ELSE 0 END AS ad_rank
```

— derived from `vendor_active_ads`, i.e. from a supplier having **paid**. So the
FIRST sort key on the public marketplace is purchased position.

🔑 **And the tier is dropped between the sort and the render.** `ad_rank` is
selected to ORDER BY; `ad_tier` is selected nowhere in the read path and reaches
no card. Measured: **zero** occurrences of `ad_tier`/`adTier` in any marketplace
card. A card could not disclose paid placement even if it wanted to — the fact
that would justify the label never arrives. Same shape as everything else found
this session: the measurement exists and does not reach the render.

⚖ **Nothing is undisclosed today** — `vendor_active_ads` holds **0 rows**, both
live shops report `ad_rank = 0`, `ad_tier = null`, `ad_live = false`. That is
precisely why now: the first advertiser will not arrive on a day anybody planned
for, and a disclosure built after the fact is an apology while one built before
is just a label.

**This ships the decision, not the label.** `paid-placement-disclosure.ts` holds
the vocabulary (sponsored → "Sponsored", boosted → "Promoted") and the rule that
silence is the answer ONLY for an unpaid card — labelling an organic result as
paid misleads in the opposite direction and is equally untrue.

⚠ **The visible label is deliberately NOT included.** It ends in a rendered
component this session could not look at, and one unverified visual change had
already shipped tonight. The guard instead pins the OPEN HALF so it cannot be
half-closed: a component that renders a disclosure without any fact to compute it
from fails, because a label that can only ever be absent is worse than no label —
it looks done.

🪤 The guard's first version required `ad_tier` specifically and **convicted two
innocent files**: the journal spotlight surfaces, which label "Sponsored"
correctly from their own `is_sponsored` flag. A different paid-placement system,
already disclosing — which is good evidence the marketplace is the outlier rather
than the rule. The assertion now states the property ("do not render a disclosure
you cannot compute") rather than naming one system's column.

Also measured in W7, and **already built** despite the register saying otherwise:

* **SUP-70 (EX-2)** — "a retired boost can never quietly re-arm a paid top slot".
  `vendor_active_ads` filters `cancelled_at IS NULL AND expires_at > now()`,
  both live-evaluated, and **nothing reads `vendor_ad_subscriptions` directly** —
  one path, no second door.
* **SUP-76 (AD-1)** — report a shop, shipped in #5867.

SPEC IMPACT: None in behaviour. The obligation is now written where a session
will read it before switching paid placement on.
