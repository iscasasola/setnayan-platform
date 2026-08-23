## 2026-08-24 · feat(card-record): a shop's record is the celebrations it actually recorded

Owner ruling 2026-08-24, verbatim: *"we only count events that they had photos with. this is
to make sure that they record everything"* and *"if they were able to collect photos, that is
registered as a completed event. no photo, no proof the event took place."*

Migration `20271159777838`. Closes the second half of Card Family § 3c, which the previous PR
had left open as an owner call.

**The unit is the EVENT, the photo is the EVIDENCE.** Fifty photographs of one wedding are one
celebration documented. A booking anybody can create in seconds proves nothing; a photograph of
the day is hard to fake — which is why this is simultaneously the count and its own anti-padding
rule, and why a visible number that rises only with real work is the nudge the owner asked for.

**No minimum-N floor, and that is the considered answer.** The two aggregates added to this
reader earlier today carry a K=3 floor twice over, because they describe *other people's*
choices. This describes the shop's *own* work — exactly like `booked_count`, whose own migration
says the count "is NOT suppressed: 'booked 1×' leaks nothing about WHICH event". A floor would
also defeat the stated purpose, hiding the number for a new shop's first two celebrations,
which is precisely when the nudge is supposed to work.

**It honours the table's own surfacing rule.** `hidden_at IS NULL` and **`nsfw_checked = TRUE`**
— the capture route writes `false` and flips it only after the NSFW pass, and a posterless clip
stays unscreened by design. A naive count would have padded a public number with media nothing
had looked at. Plus archived events and `vendor_booking_is_arms_length()`: photographing your
own owner's wedding has not documented a client's.

**It is a SHOP fact and says so.** Captures are keyed on the vendor profile, so every card of a
shop reports the same number — labelled *"· this shop"*, the same restraint the shop rating
beside it already shows. It opens the record section on the shop's **own** card view (where the
nudge lives, including before that card's first booking) and rides along on a couple's view
rather than growing a "record" for a card that has itself done nothing.

### 🛑 What this deliberately does NOT do

It does not touch `event_vendors.completion_status`. That column carries a five-rung machine —
`awaiting_vendor → vendor_marked → confirmed / auto_confirmed / disputed` — and the owner's own
rule of 2026-08-21 is that **`vendor_marked` is a claim, not a release**, with a disputed
completion never releasing. A capture is a supplier's own act, so letting one advance that
machine would hand a shop the power to certify its own job finished, and the booking fee, the
review window and the event-deletion handshake all read it.

The phrase *"registered as a completed event"* is therefore implemented as what it plainly says
on the surface under discussion — which celebrations count toward the shop's documented record
— and **not** as a change to who decides a job is done. A db test pins that a capture moves
neither `completion_status` nor `service_marked_complete_at`. If the ruling was meant as the
second thing as well, that is a separate change with real money attached; nothing here blocks
it and nothing here assumes it.

### Live effect today: none, by arithmetic

Production holds **0** vendor captures across 2 shops, and the capture lane itself is flag-dark
(`VENDOR_PAPIC_CAPTURE_ENABLED`, default off) behind an unresolved DPO question about a supplier
collecting guest photos. This ships the counting rule; it does not open the lane that feeds it.
The count deliberately does not filter on `consent_basis` — whether that lane may run is a
decision about COLLECTION, and a filter here would quietly make the number wrong the day the
ruling lands.

SPEC IMPACT: None.
