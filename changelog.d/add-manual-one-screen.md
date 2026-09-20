## 2026-09-20 · feat(add-manual): the payment plan, the services search, and a sheet that moves

Owner, refining the one-screen "Add manually" popup:
*"services covered initially places it to the category you manually added then
add more to search more service that might be included on their package."* ·
*"Payment Plan Must set date for until the payment is fully paid. just like on
our quote maker."* · *"make sure it is fully animated as well."*

**The payment plan is real instalments, not a note.** `buildCouplePaymentPlan`
turns the couple's typed rows into `event_vendor_payment_plan.instances_json` —
the same table `finalizeVendor` freezes a marketplace booking's plan into, and
the one `paymentScheduleSource` already renders. Dates come from
`computePlanInstances`, the quote maker's own resolver, so `on_lock` /
`before_event` mean exactly what they mean there and nothing re-derives a date.
Relative anchors over calendar dates, per the owner, so a plan self-corrects
when a wedding date moves.

Two rules carry the feature, and both are sabotage-verified: **a plan must add
up to the price** (±₱1, because three rows of "a third" can never be exact) and
**every payment needs a day**. A short plan would let the couple pay the last
instalment and read the booking as settled while part of it was never
scheduled; an undated one is the untracked plan the owner asked us not to
build. `before_event` with no event date is refused with the fix named.

**Services covered is seeded then searched.** The earlier pass rendered 30+
plan groups as toggle chips — a paragraph of pills to hunt through for the two
that apply. Now the booking's own category is present, locked and un-togglable
(it is a fact, not a choice, and is deliberately not persisted — `bucketForVendor`
reads `covers_plan_groups[0]` as the money bucket), and anything else is a
search away.

**The sheet moves.** The Add-a-contact modal had no entrance at all. It now
reuses the maker's own motion — `sn-canvas-rise`, 280ms — rather than inventing
a second vocabulary, with fields staggered behind it.
🔴 `backwards`, never `both`: `both` holds the transform after the run, which
makes the element a containing block for every `position: fixed` descendant —
measured on production 2026-09-18, that put a coach-mark 341px below the fold.
`the-add-manual-sheet-is-animated.test.ts` fails CI on `both`, on a missing
fill mode, and on a motion class defined but not worn.

**Two guards caught this work and both were right.** The roster guard refused
the plan action until its price came through `agreedTotalNow` rather than the
raw column. And `the-payment-note-is-inert.test.ts` refused a single file that
wrote both the inert method note and the real plan — indistinguishable, to a
file-level check, from one piping the other. The fix was to SPLIT them
(`payment-plan-actions.ts`), restoring the guard's meaning instead of widening
it; the two genuinely have different blast radii. That guard also convicted its
own documentation twice, so it now strips comments before scanning — a rule
that punishes writing it down teaches people not to write it down.

SPEC IMPACT: `DECISION_LOG.md` — (h) the couple's payment plan for a
self-added supplier is real instalments in `event_vendor_payment_plan`, with
quote-maker anchors, that must sum to the agreed total and carry a due date
each; (i) services-covered is seeded with the booking's own category (locked,
not persisted) and extended by search.

## 2026-09-20 · feat(add-manual): the eight fields land on one sheet

Owner: *"how about we keep it simple? Vendor Name · Contact Person · Contact
Number · Address Pin · Services Covered · Inclusions · Price · Payment Plan"*

**Four of those eight used to live on two other tabs**, and that scattering is
how this whole thread started: the owner was standing on a Quote tab that
rendered nothing while services, inclusions, price and the plan sat one tab
away. They are now on the sheet, held by
`the-add-manual-sheet-carries-all-eight.test.ts` — which asserts the MOUNT, not
the import, because a component nobody renders is invisible to the couple and
to a grep.

**Address Pin, not address.** `AddressPinField` wires three shipped parts
together: `BranchPinMap` (the dependency-free Grab-style crosshair a vendor
already uses to place a branch), `geocodeAddressWithCity` (the Nominatim proxy
that owns the PH filter and the rate courtesy), and the address rule. New
`address_latitude` / `address_longitude` on `event_manual_vendors`, NUMERIC like
`events.venue_latitude`, with a both-or-neither CHECK — half a coordinate is
not a location. The pin stays optional even where the address is required: a
wrong pin routes guests somewhere real and incorrect, which is worse than none.

**One save, not five.** `addManualSupplier` runs the sequence server-side,
composing `createManualVendor` → `attachManualVendorToCategory` →
`updateVendorCosts` → `updateHostServiceDetails` → `saveSelfAddedPaymentPlan`
rather than re-implementing any of them. Five sequential calls from the browser
could half-succeed and leave a supplier who exists, is attached, has no price
and no plan — beside a success screen. Past the attach, the supplier EXISTS and
nothing may report failure: a couple told "failed" adds them again and gets a
duplicate. Later failures surface as a warning naming what to finish, and the
payment plan's own refusal ("your payments add up to ₱60,000 of ₱80,000") is
passed through verbatim, because it is the only sentence that says what to fix.

**The post-save price input is gone.** The sheet now owns `total_cost_php`, so
keeping the panel's input would have been a second writer of one column — the
defect this repo keeps re-finding. Guarded: exactly one `total_cost_php` field
in the file.

**A guard caught a stale count**, correctly: `vendors/actions.ts` went from 11
to 13 reads of `total_cost_php`. Both new ones WRITE the couple's typed price
through the canonical writer rather than displaying a stored total, so the
roster count was updated rather than the reads rerouted.

SPEC IMPACT: `DECISION_LOG.md` — (j) the Add-manually sheet carries all eight
fields on one screen and saves through one action; the pin is optional even
where the address is required.

## 2026-09-20 · chore(guards): `crew_meal_covered` now has a reader elsewhere — its baseline line is deleted

`handles-have-gates.db.test.ts` failed the branch, correctly, and the fix is
the one it asked for: delete the line.

That guard records switch columns read **only by the surface that writes
them** — a control that promises an effect and delivers none, the shape found
when `users.planner_mode` turned out to hide a checklist that rendered
unconditionally anyway. `event_vendors.crew_meal_covered` was on that list as
*"written and read on the couple's vendors surface"*.

It is no longer true: the claim seed (`lib/couple-card-to-canvas.ts` and its
fetch half) reads it to carry "the event feeds this crew" onto the supplier's
first card. The switch now has a consumer somewhere else, which is exactly the
state the baseline exists to track the absence of — so the declaration goes,
rather than being edited to stay green.

## 2026-09-20 · fix(csp): name the OSM tile host in the report-only policy

The address pin renders OpenStreetMap raster **tiles as `<img>`** (BranchPinMap,
no Leaflet), so it needs `img-src`. The 2026-08-08 note beside it is about a
different map and a different directive — that one was an `<iframe>` embed
rendering a grey box on shop pages, fixed with `frame-src`.

🔑 **The pin is not broken today, which is why this is easy to miss.** The
ENFORCING header declares only `frame-ancestors` and `frame-src`; images are
unrestricted, so the tiles load. The list this adds to is the REPORT-ONLY
policy — the dress rehearsal for enforcement. Left as it was, every pin drop
files a violation report, and the day anyone promotes that policy the map goes
blank with nothing in the diff to explain why.

Found by checking rather than assuming: the tiles were verified against the
actual header value, not against the fact that the vendor-side map works.
