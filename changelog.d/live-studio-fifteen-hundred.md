## 2026-09-02 · feat(pricing): Live Studio is ₱1,500 per event-day

Owner-ruled 2026-09-02, superseding the 2026-08-27 sheet's ₱3,000 for this SKU.
`billing_period` was already `per_day` and is unchanged — `foldWindowEnd` already
stacks purchased days from the first go-live, and buying early still costs nothing
because the window anchors on going live rather than on paying.

**Why not the ₱500/day that was proposed.** Cost was never the objection: a
four-camera eight-hour day relays roughly 17 GB through TURN — about ₱54 at $0.05/GB,
and only past Cloudflare's free 1,000 GB. The objection is that **price is a commitment
device, and preparation is what decides whether the day works.** The BYO path asks the
couple to do real work in advance — activate live streaming on their own channel
(YouTube's own ~24-hour wait), create the broadcast, dry-run it. Someone paying ₱500
for a wedding livestream treats it as low stakes and does none of that, and then the
morning arrives on a date that cannot move. The tick box, the four help articles and
the dry-run instruction only pay off if the buyer engages with them.

It also keeps the planned hosted tier at a credible 2× rather than 6×: at ₱500 a
free-from-Google YouTube channel would have been priced at five times the whole
multi-camera control room.

**Still well under market.** Measured live at ₱62.4/USD: Switcher Studio — the closest
analogue, phones as wireless cameras, multicam switching, stream to your own YouTube —
is $65/mo ≈ ₱4,060; StreamYard Core $44.99/mo ≈ ₱2,810. A couple needing one day
subscribes for a month and cancels, so those are the real comparables. ₱1,500 is about
a third of either, and a tenth of the ₱15,000 a Philippine videographer charges for one
live-feed operator — the comparison couples here actually make.

Also corrected: the catalog row's description ended **"Per event."** while
`billing_period` on the same row said `per_day` and the public `/llms.txt` line has
said "per event-day" all along. One row, two answers to "what am I buying?", and the
customer-facing half was the wrong one. It now matches the column and the machinery.
It deliberately still says nothing about *whose* YouTube channel carries the broadcast —
the BYO-versus-pool ruling is open, and baking either answer into sales copy would
pre-empt a decision that has not been made.

No code changes. Nothing hardcodes the price: `/llms.txt` derives it from the catalog
(`R('LIVE_STUDIO')`), and the only two source mentions of ₱3,000 were prose in test
docblocks — both stripped rather than restated, per the anchor-is-a-string rule, so
they cannot rot again at the next reprice.

⚠ `platform_retail_catalog_v2` is admin-managed and is the only number a customer is
charged. This migration moves that row and then stops mattering — never quote ₱1,500
from the migration or the changelog; read the table.

SPEC IMPACT: `DECISION_LOG.md` — new row superseding the 2026-08-27 LIVE_STUDIO price.
