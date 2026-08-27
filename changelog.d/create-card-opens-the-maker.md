## 2026-08-28 · fix(vendor): "+ Create service card" opens the maker, not a page of links to it

Owner, pressing it in his own Shop: *"when i click create service card. i just bounces to a page
for a link to service card. we want it to directly go to a page to create a service card."*

**What changed for a supplier.** One press now opens the card itself. The kind of service is asked
for ON the card — the first region, above the name — instead of being chosen from a drawer on the
way there. Publish and Save-as-draft both wait until it is answered, and say so.

**What did NOT change.** `/vendor-dashboard/services/new/[category]` is untouched and still serves
the claim flow (`?claim=`), "start from one of your cards" (`?from=`) and every existing deep link;
it passes no options, so that screen has no chooser at all. My Shop's picker drawer stays exactly
where it is — it is also the fallback the new route redirects to when the canvas maker is switched
off, because the 6-step wizard takes its category from the ROUTE and has nowhere to ask for one.

**One maker, not two.** The new route renders the same `<CanvasMaker>` and posts the same
`commitVendorService` with the same field names — the category is state behind the same single
hidden input, so the server cannot tell which door drew the screen. `canvas-field-parity` still
passes untouched.

🔒 The draft button is the one that would have bitten: it has no health gate, and the action parses
the category on both paths and throws on an empty one — an enabled button would have handed the
vendor a raw database sentence for a question the card never asked out loud.

🛡 New guard `app/vendor-dashboard/services/kind-is-a-field-on-the-card.test.ts` — 6 assertions,
**7 mutations, every one printed before → after and every one RED**: posting the prop again ·
unlocking the draft button · publish no longer waiting · the pricing basis drawn for the old prop ·
the bundle list unfiltered (a card offered as bundling itself) · the new door not handing over the
kinds · the old door growing a chooser. The two existing guards were updated rather than deleted:
they now pin the destination KIND ("the press opens the maker") and that the maker route is a real
page rendering the card — *existing is not the same as reachable*, one level up.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.

## 2026-08-28 · fix(vendor): the kind chooser offers what this shop may actually list

Owner, on the same screen: *"looking at our service card creation with so many categories? should
the choices be only for the service we actually cover and not all?"*

**Measured before answering, on his own shop.** The chooser offers 52 category keys (~34 pills
after duplicate labels collapse). SetnaProd is on **Solo — one family of business** — covers
*Pabati* (booths) and *Day-Of Coordinators* (planning), and has zero cards. The save has always
enforced two caps — cards per kind, families per plan — **and enforces them after the card is
authored**, as a redirect carrying an error string. So most of those pills were refusals waiting to
happen, collected after the photo was uploaded and the work was gone.

**What changed.** What the shop already works in leads. Everything else is one tap away under
*Something else I do*. What the plan cannot hold is greyed, **disabled**, and carries the reason
once — not once per pill. Nothing is removed from the list: a shop legitimately grows, and a
chooser that silently dropped kinds would read as *"Setnayan does not do that"*.

**And a shop that covers exactly one kind is asked nothing** — it is pre-filled and still editable.
A question with one answer is not a question.

🔑 **ONE DEFINITION, ASKED TWICE.** `lib/vendor-category-parents.ts` now holds the family rule and
the save imports it — the chooser cannot drift from the refusal. Two copies of a permission rule
always drift and the copy on the screen would have been the optimistic one.

⚠ **FAILS OPEN BY CONSTRUCTION.** An unreadable coverage read means an empty family set, which
offers everything and meets the save's own gate as before. A read failure must never delete a kind
a supplier is entitled to sell — asserted in both directions.

🛡 `lib/vendor-category-parents.test.ts` (8 assertions on the pure rule, cases taken from the live
shop) + 4 more in the maker's guard. **8 mutations, printed before → after, all RED.**

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.

## 2026-08-28 · feat(vendor): a blank card asks two questions, then it is live

Owner: *"i want it to be as simple as possible when they create a service card… so they do not feel
bombarded"*, and on the drawn shape: *"looks better"*.

**What a supplier now does.** A blank card asks the only two things the publish gate has ever
required — **one photo**, then **one sentence** (the Setnayan Exclusive) — one at a time, with their
card visible above painting itself as they answer. Then the pass ends and the whole card is there,
with everything optional as quiet rows beneath it.

**Nothing about the screen's contract changed.** There is no second form, no step validation and no
Back/Continue over pages: the pass only decides which sheet is open. Same single `<form>`, same
`commitVendorService`, same field names, `canvas-field-parity` untouched. "The card is the form"
(owner-locked 2026-07-27) survives — the wall was never the model, it was everything being on at
once.

**The kind is asked only when the shop's own record cannot answer it.** A one-trade shop has it
pre-filled from its coverage and reads *"from your shop · change"* on the card, so its pass is two
questions, not three. An answer that appears by itself and does not say where it came from reads as
the product deciding for them.

⚖ **Continue is never a gate and Skip is on every question.** A first pass a vendor cannot leave is
a wizard wearing a card's clothes; the publish gate stays the only gate.
⚡ **No meter during the pass** — a "Blocked 30/100" over two unanswered questions grades somebody
for not having finished what they just started. The card filling in is the progress.
🪟 **The guided sheet does not veil the card it is painting** (no dark backdrop, shorter panel).
Every later edit is still a modal, because nothing is being built behind it.

🛡 5 more assertions in the maker's guard — the pass asks the gate and nothing else · it cannot leak
onto the `[category]` door or a copied card · every question can be left · the card stays visible
and ungraded · a pre-filled kind explains itself. **6 mutations, printed before → after, all RED**
(a third question added · the pass leaking · skip removed · the veil returning · the meter returning
· the pre-fill going silent).

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.

## 2026-08-28 · feat(vendor): a half-finished service card is kept, and offered back

Owner, on the open question: *"add it"*.

The maker saves in ONE submit by design, so a lost signal, a phone call or a closed tab took the
photo, the sentence and the price with it and **said nothing**. *Save as draft* existed, but it is a
button somebody has to know to press before the thing they are afraid of happens.

**What was typed is now held in the vendor's own browser** and offered back on return —
*"You left a card here 20 minutes ago. Nothing was published — it is only on this device."* with
**Pick up where I left off** and **Start a fresh card**.

🔑 **IN THEIR BROWSER, NOT IN OUR DATABASE, AND THAT IS THE DESIGN.** A server-side autosave would
mint a real card row per abandoned attempt — junk in the shop's own list, in the caps that count
cards per kind, and in every read that counts what a shop offers. Nothing becomes a card until they
press Publish or Save as draft, exactly as before.

⚖ **Offered, never restored behind their back.** Work reappearing unasked is its own kind of
alarming, and they may simply want a fresh card. An unanswered offer also **suspends the first
pass**, so a question never opens on top of it.

**Not kept, deliberately:** the file picker itself (a chosen file is not a value — but the picker has
already uploaded the object and written its key into a hidden field, so a restored card still carries
its photo) · rows a vendor added by hand, which do not exist on a fresh mount and would half-restore
into the wrong row · anything older than a week · anything from another shop on the same browser.

🔒 **Every touch of storage is wrapped.** `localStorage` throws outright in private windows and with
site data blocked; a maker that white-screens because a convenience could not write is far worse than
one that quietly does not keep. Saving clears the keep; a card started FROM another card never offers
one.

🔑 **Restoring needs both halves:** the card's own fields are React state (a DOM assignment would be
overwritten on the next render) and everything inside the shipped editors is uncontrolled (state does
nothing) — so those get their value on the node plus a dispatched `input`, which is what makes the
card SHOW what came back.

🛡 `lib/canvas-draft-keep.test.ts` — 10 assertions, weighted to the REFUSALS (old shape · past its
week · blank card · every malformed shape · oversized) — plus 5 in the maker's guard. **9 mutations,
printed before → after, all RED.**

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.

## 2026-08-28 · feat(vendor): the card explains itself once, paints itself, and sits beside the question

Owner: *"build it"* — the three presentation pieces the prototype drew and the first build left out.

**Explained once, ever.** A shop's very FIRST card opens with one screen saying what a card is —
the photo sells it · the price can wait · the Exclusive is why they book here. It carries no field.
A supplier making their fourth card never sees it; explaining again is the bombardment in a politer
costume.

**The card paints itself.** The cover settles in, the price line and what-couples-get land as they
change, the Exclusive lights up, and the card pulses once the moment it could go live. During the
first pass there is no meter and no score, so this IS the progress.

🔑 **REMOUNTED, NOT CLASS-TOGGLED.** A CSS animation that has already run does not replay because
its class is set again — each node is keyed on its own value, which is the whole mechanism. A static
`className` here animates once and then never again, and looks correct in review.
⚠ **The ready-pulse is on a WRAPPER, not the card**: keying the card itself would remount the name
field mid-typing.
🔒 All three keyframes carry a from-state (opacity 0 / scale) that must never be the resting state,
so the `prefers-reduced-motion` freeze is asserted, not assumed — without it a supplier who asked for
no motion gets a card stuck invisible.

**On a laptop the question sits beside the card**, not over it: the guided panel becomes a right-hand
column at `lg`. An ordinary edit is still a bottom sheet, because nothing is being built behind it.

⚖ **AN EXISTING GUARD FIRED AND WAS WIDENED RATHER THAN WEAKENED.** `canvas-sheet-confirm` pinned
*"exactly one sheet may hide the confirm"* (owner 2026-07-28: *"pop ups must have update button"*).
The rule is about a sheet you can only leave by the ×; the guided sheets give Continue / Done plus a
skip. It now asserts the real rule — **a sheet may hide the confirm only when it carries a real
control of its own** — and still names the only two that may hide it unconditionally.
🪤 **AND ITS OWN TAG REGEX WAS WRONG AND FAILED SILENTLY:** `<CanvasSheet[\s\S]*?>` stops at the
first `>` in the tag — the ARROW in `onClose={() => …}` — so every sheet with an inline handler was
cut short and its `confirmLabel` was never read. Caught by the assertion disagreeing with the file,
not by review.

🛡 5 more assertions · **8 mutations, printed before → after, all RED** (explainer shown to everyone ·
price painted with a static class · cover not settling · pulse moved onto the card · desktop column
removed · reduced-motion guard dropped · a guided sheet with neither confirm nor footer · an ordinary
sheet hiding its confirm always).

Measured: `TSC_EXIT=0` · `ERRORS=0` · `# tests 1387 # pass 1387 # fail 0`.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 row.
