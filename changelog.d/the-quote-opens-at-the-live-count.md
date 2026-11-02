## 2026-09-09 · feat(vendor-dashboard): the quote builder opens at the live guest count

**Owner decision, 2026-09-09.** [#5363](https://github.com/iscasasola/setnayan-platform/pull/5363)
labelled every guest count with its provenance but deliberately left the quote builder seeded from
`pax_at_inquiry`, flagging that the binding prototype's booked frame shows the field pre-filled at
the LIVE count instead. The owner ruled for the prototype.

**What changed.** `ProposalMaker` now computes `seedPax = livePax ?? requestedPax` and opens its
editable Guests field at that. The inquiry count stays a prop — it is still named, it is simply no
longer the seed.

**🔑 It moves money, so both numbers stay on screen in every state.** A quote opened at 170 when the
couple asked with 150 is a different price:

| state | header reads |
|---|---|
| untouched | `Sized to their plan now · 170 pax · 8h · was 150 at inquiry` |
| edited | `Quoting 160 pax · 8h — their plan says 170 now · was 150 at inquiry [reset]` |

**Reset now means "undo my edits", not "back to the inquiry figure".** `resetToRequest` →
`resetToSeed`, returning the field to what the builder opened at. A reset that jumped to a
*different* number than the one the supplier started from would be a second, silent re-pricing
wearing the clothes of an undo — and `setPax(requestedPax)` is now asserted to have zero occurrences
so nothing can reintroduce it.

`atRequest` → `atSeed` for the same reason: "the request" and "what this opened at" are no longer
the same number, and a boolean named for the wrong one is how the next reader gets it backwards.

**Guards.** `lib/every-guest-count-says-which-count.test.ts` — the assertion that used to pin the
OPPOSITE contract ("the seed is unchanged") now pins this one, including that the field actually
reads `seedPax` (a seed nothing reads is not a seed). 38 tests across the three suites, exit 0.

MUTATION-TESTED — seven mutations, each printing anchor occurrences before/after, **all seven RED**,
suite restores to 13 pass / exit 0: the seed reverting to the inquiry count · the field ignoring the
seed · reset snapping back to the inquiry count · either header branch dropping the inquiry count ·
the at-seed branch stopping naming its figure · the live count stopping reaching the builder.

SPEC IMPACT: None — this is the binding prototype being followed, and the owner's ruling is recorded
in this fragment and in the code comment at the call site.
