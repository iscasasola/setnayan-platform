## 2026-08-27 · fix(papic): the Papic control centre is one page, and the three tabs are gone

The couple's Papic studio opened by asking which of three tabs to stand in —
**Photos · Cameras & shots · Set up** — a question about our own filing, put to a
person before anything had been said about their celebration. Owner, on the
screen as it shipped: *"it still has the three tabs"*, alongside three further
complaints about the same page.

The owner-approved drawing `prototypes/papic_control_center_2026-08-25.html` was
partly ported on 2026-08-26 — the four facts, the deleted questions, the upload
sheet, the switch, the quiet setting rows all landed — but its **central move did
not**: replacing the tab bar with the thing itself, *four ways into the library*.
The parts were ported and the shape never was.

**What ships now**, in the drawing's own order: the four facts · exactly ONE next
step (the dates while unset, otherwise the QRs still in the couple's pocket) ·
**four ways in** (crew cameras · guest cameras · your uploads · suppliers), each
reporting what it has contributed and what it is waiting on · the library · the
credits · what is made from the library · what the couple has a say over · the
set-once rows · and the offers **last**.

🔑 **NOTHING WAS LOST WITH THE TABS, AND THAT IS MEASURED, NOT ASSERTED.** All 40
controls the three-room page mounted are still mounted. The new guard's bill is
**derived** from that page — every capitalised JSX tag minus the icons — rather
than hand-written, because a hand-enumerated list is a list of the controls
somebody thought of, which is a shape this repo has already paid for.

⚠ **NO PICKER WAS REDRAWN.** Every control moves behind a row or into a section;
each sheet renders the shipped component untouched. A row is a different DOOR to
the same control, never a second copy of it.

⚠ **The three components that render nothing when there is nothing to decide
still do** (face tagging, guest capture window). They gained a `variant="row"`
that wraps their own body — the absence logic stays inside them, so no row exists
for a choice that cannot be made. A page-side decision would have grown a row
opening onto nothing: a gate with no handle, in new clothes.

⚠ **The Suppliers row is deliberately INERT** — no sheet, no link. The supplier
capture lane is built and switched off behind the outstanding privacy ruling, so
today a booked photographer can only hand over a link to their own gallery. It
stays visible because the gap is real; it gets no door because a door would not
open.

🗑 **`_lib/rooms.ts` and its test are DELETED, not disabled.** Its outcome→room
map existed so a "saved" confirmation would not land in a room nobody was looking
at. With one page every banner is always on screen, so that whole class of bug is
gone rather than guarded. `?tab=` is still accepted and ignored, so old bookmarks
and browser history do not break.

🛡 **Guards:** `nothing-was-lost-with-the-tabs.test.ts` (new — the derived bill,
the four ways in, the inert supplier row, offers last, and the tab strip can
never return); `the-required-act-is-in-the-room.test.ts` → renamed
`the-required-act-is-first.test.ts` and restated against the page that exists
now. **7 mutations, every one measured by occurrence count or line position
before → after, all 7 RED** (delete a control · restore a tab strip · drop a way
in · give Suppliers a door · hoist a buy tile above the library · move the facts
strip below the ways in · ungate the do-this-first card).

🪤 **Three of the existing guards broke on this change and TWO of them were
keyed on the wrong thing** — worth more than the fix. One found the look picker
"missing" because it matched *the first* `SettingRow` on the page rather than the
one labelled *Your Papic look*; **a guard keyed on position answers a question
about position.** One compared against `indexOf("room === '")`, which returns −1
once the rooms are gone, so it would pass or fail for reasons unrelated to its
rule. And my own first replacement **cried wolf**: it flagged any `if (…) {`
around a self-heal, which caught the two that are *supposed* to be data-gated —
narrowed to conditions derived from the URL, which is what "only in the Cameras
room" actually was.

🔢 **Measured against production before building, not after:** all 5 events have
no capture window set, so every couple meets the do-this-first state; and the
credits fact is **correct** (50 free on every celebration, 29 left on the one
with photos) — a suspected defect there was disproved by querying rather than
reading a docblock that said the pool applies only to flat-pass events.

SPEC IMPACT: `WHATS_NEXT_Papic_Uploads_Are_A_Way_In_2026-08-26.md` § 3c —
the register tracked the Papic money side (meter, ladder, upload lane) and
never carried the screen shape itself as an open item, which is part of why it
kept not getting fixed. Row added there and in `DECISION_LOG.md`.
