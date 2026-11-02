## 2026-08-24 · feat(card-record): a service card compiles which of its own options couples chose

Card Family stream § 3b — the veteran-card "what couples picked" panel. Migration
`20271159436100`.

**The build note's premise was stale by one day and is corrected here.** It says per-option
picks are "NOT queryable" and prescribes a new table `event_vendor_item_options` written by
`lockPackage`. Measured 2026-08-24: the pricing freeze (#3862, merged 2026-07-28 — the day
before that note was written) already persists every charged option into
`event_vendor_packages.customizations_json -> 'pricing_snapshot' -> 'options'` as
`{item_id, option_id, label, delta_centavos}`. The picks **are** queryable, and from the
FROZEN record a later rename or retirement cannot rewrite. So: **no new table.** A projection
table would have needed a second writer inside `lockPackage` (another session's tree this
wave) and would have been a second copy of a fact the snapshot already holds.

**What was genuinely missing was a LINK.** `vendor_packages` had no service column, so the
one-service package the maker mints for a card's ★ Customization step could not be found from
the card — a gap the code already named twice, in `services/actions.ts` and
`lib/service-customization-draft.ts`, as the reason a vendor cannot re-open a card to edit its
options. `vendor_packages.vendor_service_id` is added, nullable, `ON DELETE SET NULL`, and
stamped at mint.

🔒 **A nullable FK is not a permission.** The FK proves the card exists, never that it is
yours, and `vendor_packages` carries Supabase's default table grants with RLS on top — so a
vendor could have pointed their package at a competitor's card and published their own picks
on that card's record. `trg_vendor_package_service_same_owner` refuses it, on INSERT **and**
UPDATE of either column: a guard attached to one verb is a guard around one door, which this
repo has already shipped once.

**The disclosure floor applies TWICE, both times in SQL.** The sample needs 3+ arm's-length
locked bookings AND every line needs 3+ couples — an option chosen by one couple out of five
is a fact about one identifiable booking sitting beside a ledger that gives its month and
size. Below either floor the line is ABSENT: not rounded, not bucketed, not "fewer than 3",
all of which disclose. The denominator is published only once it has itself cleared the floor,
so the card can say "4 of the last 6" and never "1 of 2".

🔑 **And it found a gate with no handle before shipping one.** `booked_count` counts
`event_vendors` rows carrying the card's `service_id`, and a package lock cascades rows that
carry **no `service_id` at all** — so a card booked only through its own package scores zero
there. FOUR separate places each asked `bookedCount > 0` before rendering the record, and each
would have hidden exactly the cards this feature exists for. They now ask one shared
predicate, `cardRecordHasSomethingToSay`. **That undercount is named, not fixed:** making
`booked_count` see package bookings moves a public trust number ("Booked N× on Setnayan") on a
live card, which is a decision of its own. What ships instead is a refusal to print an untrue
headline — the booked line renders only when the count is real, and the picks carry their own
denominator.

⛔ **Deliberately untouched:** whether a minted package should publish with its service instead
of landing `is_active:false`. That is the OWNER DECISION half of the same handoff note.

**Exposure baseline regenerated** (`supabase/security/exposure-surface.baseline.txt`): exactly
one new capability line, `vendor_packages.vendor_service_id anon=SIU authenticated=SIU`. A new
column on an existing table cannot be narrower than the table — a column-level REVOKE cannot
carve a hole in a table-level grant — so the ownership trigger and the row policies are the
control, not the grant. The same regeneration absorbs 18 narrowings from the Pabati retirement.

SPEC IMPACT: None. No pricing, no SKU, no locked decision. Prod holds 0 packages and 0 locked
bookings, so every card is below the floor and this is visible to nobody today.
