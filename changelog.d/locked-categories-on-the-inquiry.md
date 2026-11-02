## 2026-09-08 · feat(vendor): an inquiring supplier sees which categories are already locked

Owner, verbatim: *"so if they have lock specific vendors as well for that event,
we can share what categories is already locked."*

The customer rail's summary now carries an **Already locked** chip row — the
display labels of every category the couple has locked on this event.

🔑 **THIS RESOLVES A TWO-MONTH-OLD OPEN DECISION, AGAINST ITS OWN
RECOMMENDATION.** `Vendor_Proposal_Maker_2026-07-10.md` § "Open decisions
(owner)" reads: *"Privacy default … (mood board + locked vendors: booked-only vs.
visible at inquiry). Recommendation: booked-only for mood board + locked
vendors."* Never ruled on, so the code followed the recommendation for two
months. Struck through and marked RESOLVED in the corpus.

⚠ **CATEGORIES ONLY. VENDOR NAMES STAY BOOKED-ONLY.** `vendor_roster` in
`get_vendor_event_brief` — `{vendor_name, category}` for every other locked
supplier — remains BOOKED STAGE ONLY by construction (owner ruling 2026-09-07
item ①). *"Venue and Catering are taken"* tells a supplier the couple is
committing real money and which slots remain. *"Venue is taken by <rival>"*
names a competitor to someone who has not committed to anything and can still
walk away. The builder has no name parameter and the page's select is guarded.

**No migration, no RPC change.** The thread page already read `event_vendors`
with an admin client for the locked COUNT; `category` rides along on that same
query, so the chips cost no extra round trip.

🪤 **`booked_categories` IS NOT THE COUPLE'S LOCKED PLAN, and the name says it
is.** Measured in the RPC: at the inquiry/requested rung that key is populated
from `v_inquiry_categories` — the CALLER'S OWN `event_vendors` rows, with **no
status filter at all**. Reusing it would have shipped a supplier their own
categories relabelled as the couple's. Left alone rather than repurposed.

Reused, not reinvented: `CONFIRMED_VENDOR_STATUSES` (three modules already keep
private copies — not a fourth) · `displayServiceLabel`, whose docblock is *"NEVER
PRINT A DATABASE KEY AT A COUPLE"* — `event_vendors.category` is the
`vendor_category` ENUM and would otherwise render `band_dj`.

📌 **Flagged, not fixed:** the Customer Card's file-local `CATEGORY_LABELS`
diverges from the exported `VENDOR_CATEGORY_LABEL` (`cake_maker` → "Cake" vs
"Cake maker"), so two supplier screens can print two words for one category.
Pre-existing; spawned as its own task.

SPEC IMPACT: applied — `DECISION_LOG.md` row, and the 2026-07-10 open decision
marked RESOLVED in place.
