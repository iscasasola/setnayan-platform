## 2026-08-05 · fix(guest-site): a host who paid for the seat pass stops having their guests turned away

**SPEC IMPACT:** None (the guest route now asks the event-type profile, like its
siblings; no schema, no pricing, no SKU change).

`seat/page.tsx` opened with `if (!event || event.event_type !== 'wedding')
notFound();`.

**Nothing on the couple's side gates the seating plan by event type.** A debut, a
birthday or a christening host can build it, publish it, **and buy the Custom QR
seat pass** — and their guests, holding the QR that pass printed, landed on
"this page does not exist". They were sold something their guests could not
open, and neither side had any way to find out why.

🔑 **This is a defect, not a product decision.** If the answer were "seat passes
are wedding-only", the gate would belong on the couple's side, at the point of
sale — not on the guest's 404. The rest of the guest tree already agrees:
find-seat, find-my-table and recap all ask the event-type profile, and a missing
profile row degrades to enabled (`GENERIC_PROFILE`).

Also fixed the copy in the same change. Three guest-facing strings said "this
wedding" outright — harmless while the page 404'd for everything else, reachable
and wrong the moment it opens to a debut. Shipping the 404 fix alone would have
aimed a known-wrong noun at a newly-unlocked audience.

⛔ Untouched, deliberately: the entitlement gate stays ABOVE the token lookups
(its own comment explains that reordering turns the page into a token oracle),
and the guard test pins that order.

🔑 **The sweep found a second route on its first run — and both hits were FALSE
POSITIVES.** `recap/page.tsx` uses the same comparison to pick a NOUN, and the
other hit was the comment explaining this very fix. A check that fires on
correct code teaches people to delete the check, so the detector now strips
comments and matches the GATE shape (a comparison that decides whether the page
exists), not the words.
