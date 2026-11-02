## 2026-09-22 · fix(overview): two counts stop sharing one word, and the category count shows its denominator

**The defect, measured on the live Overview:** a couple met two different numbers two inches
apart, both calling themselves "open" — the book group's `N categories still open` and the digest
tile's `N open decisions` — and then a third on Your Team. They are not the same question. The
Overview's category count excludes the plan groups carrying `countsTowardLockable: false` and is
scoped by event type; Your Team's `stillNeedsDecision()` counts groups that are engaged or inside
their action window, minus locked, minus covered. **Both are correct answers to different
questions, so reconciling them would have silently destroyed one of two working measures.** The
defect was the shared word, so the fix is naming, not a resolver merge.

New pure module `apps/web/lib/two-counts-two-names.ts` owns the wording for all three surfaces:
`notBookedLabel(notBooked, lockable)` · `decisionsCountLabel(n)` · `decisionsCountNoun(n)` ·
`needsDecisionLabel(n)`. Both Overview sites now call it instead of spelling a sentence inline
(`grep -n "two-counts-two-names\|notBookedLabel\|decisionsCountNoun" apps/web/app/dashboard/\[eventId\]/_components/event-dashboard.tsx`).
`needsDecisionLabel` is exported and currently unused by the Overview — it is Your Team's name,
placed here so that page imports the wording rather than spelling a fourth variant.

**The denominator is what makes this safe rather than merely different.** "23 categories not
booked" is still ambiguous — 23 of what? `notBookedLabel` renders `23 of 25 categories not
booked`, so the reader can see the set being counted instead of inferring it. It degrades rather
than inventing: a zero total means the event-type scope could not be resolved, so the label drops
the denominator (`4 categories not booked`) instead of printing `of 0`, a fact nobody measured.

⚠ **THE OWNER HAS NOT APPROVED THIS WORDING.** He approved starting the wave; the controller
approved the two names on his behalf. That is exactly why the strings live in one module — if he
wants "still to book" or "waiting on you", it is an edit to four template literals and nothing
else. Flagged, not silently settled.

**Guard — `apps/web/lib/two-counts-two-names.test.ts`, asserting the property, never a phrasing.**
It EXECUTES the resolver across 49 generated labels and asserts none matches `\bopen\b`, printing
the count so a green line carries a number; it proves the detector can fail (`4 open decisions`
→ true, `4 decisions` → false) and that it does not convict innocent copy (`reopened` → false,
word-boundary not substring); and it asserts the two render sites CALL the module rather than
pinning the sentences they render, so a rename stays green. A guard pinned to a literal string is
how the stale ₱499 upsell is still protected by four assertions across two tests — that failure
mode was designed against here.

🔑 **The test caught a defect in the module on its first run.** `notBookedLabel(1, 25)` rendered
**"1 of 25 category not booked"** — the first cut pluralised on the numerator. With a denominator
the noun agrees with the *denominator* ("1 of 25 categories", "1 of 1 category"), because the noun
names the set being drawn from. Nothing about the old wording — `1 category still open`, correct —
could have warned about this: **adding the denominator moved the agreement.** Fixed, and both arms
are now pinned.

**The denominator introduced a risk the bare number did not have, and it lives in another file.**
The two numbers come from different expressions — `remainingTaskCount = countUnlockedCategories(rows,
eventPlanGroups)` in `lib/todays-one-thing.ts`, and `totalLockableCategories =
eventPlanGroups.filter(countsTowardLockable !== false).length` in the dashboard. A bare "23" could
not be wrong about a set it never named; "23 of 25" can. They agree today — `countUnlockedCategories`
applies the same `countsTowardLockable` skip, which its own docblock says is there so "the
denominator matches the event-home lock count" — but nothing held that. It is now executed: with no
vendors nothing is locked, so the numerator must equal the lockable count, checked across three
event-type ladders. **The existing `lockedVendorCount = Math.max(0, total - remaining)` clamp beside
them is the codebase already conceding this mismatch is expressible.** Two defences, because a guard
that fires in CI does not help a couple looking at the screen: `notBookedLabel` now DROPS the
denominator when `total < n` for the same reason it drops it when `total === 0` — no denominator is
better than a wrong one, and "27 of 25" is the one thing it must never say.

**A neighbouring test was asserting about copy the app can no longer produce.**
`lib/digest-sub.test.ts` decides whether a digest row's grey second line earns its place, and its
"every one of these ships today" case hand-typed `'3 categories still open'` / `'1 category still
open'`. Those two sentences stopped shipping in this change. `digestSubWorthShowing` is an
ALLOW-list (a line survives only if it carries a date or a reference code), so the new wording
classifies exactly as the old one did — **executed, not reasoned about**: every arm of
`notBookedLabel` was run through it and every one returned `drop`, with `'Order placed · ref A7K2QX'`
returning `KEEP` in the same probe so a `drop` line means something. The fixtures are now GENERATED
from `notBookedLabel` instead of typed, so the title is true again and a future rewording arrives
there on its own; the two historical strings are kept in a separate case labelled as history. The
file's docblock example was updated to a sentence the app actually produces.

🛑 **AND THAT FUNCTION IS INERT — IT CHANGES NO PIXEL, ON MAIN OR HERE. NOT CAUSED BY THIS PR,
SURFACED BY IT.** `digestSubWorthShowing` has exactly ONE consumer, `event-dashboard.tsx`, which
imports it on line 22 and never calls it — `grep -rn "digestSubWorthShowing" apps/web --include="*.ts"
--include="*.tsx"` returns the import, the definition, and the test file, and nothing else.
`git show origin/main:apps/web/app/dashboard/\[eventId\]/_components/event-dashboard.tsx | grep -c
digestSubWorthShowing` returns **1** — the same single import — so this predates the branch. The
panel renders `{group.sub}` and `{item.sub}` unconditionally. So the drop described in that module's
docblock does not happen: 23 assertions and a carefully-reasoned trap note (the bare-month rule, the
case-sensitivity rule) are guarding a function nothing runs. **A passing test is not a rendered
pixel** — the same shape as the seven-PR sweep whose lesson was that a log line never changed one.
Left alone deliberately: wiring it would add or remove grey second lines across the whole digest,
which is a visible design change nobody has approved, and is not this slice. Raised for the owner
with the two facts above, not fixed here.

Five watched sabotages, each red, each restored to a verified hash: (1) point the render site
back at the hand-spelled `'open decision' : 'open decisions'` → the call assertion fires;
(2) make the MODULE hand back the banned word → the executed property test fires, printing
`using "open": 6`; (3) restore the regex hack the module's docblock warns about
(`decisionsCountLabel(n).replace(/^\d+\s/, '')`) → the zero case fires, because that hack silently
renders the whole sentence `Nothing waiting` the moment a label starts with a word. That third one
is not hypothetical — it is what this change was first written as, before the zero case was noticed.
(4) drop the `countsTowardLockable` skip from `countUnlockedCategories` in the OTHER file → the
cross-file test fires, printing `numerator-with-no-vendors 34` against `lockable 28`, the exact
"34 of 28" absurdity; re-run AFTER the degrade was added to confirm the fix had not made its own
guard inert, which has happened in this repo before. (5) give the label a date
(`…not booked by 12 Dec`) → `digest-sub`'s drop case fires, proving that fixture really does track
the module rather than a copy of its output. ⚠ Scoped honestly: that sabotage proves the TEST is
wired to the module, **not** that a pixel is protected — the function it tests is inert (above).

Two other things were checked and found already sound, so they are recorded rather than changed: the
first version of the cross-file test looped three event types against an EMPTY scope map, and
`planGroupsForEventType` fails open on a tile with no scope row — so all three printed byte-identical
lines and it was one case run three times. It now pins a real scope row (wedding 34/28, birthday and
corporate 32/26) and asserts the ladders actually differ. And the test asserts that some group really
carries `countsTowardLockable: false` (6 do), because with none the identity would hold trivially.

SPEC IMPACT: None yet — the wording is not owner-approved, so no corpus edit is made. If he
signs off on these two names, the copy belongs in the Overview iteration's `.md`.

---

**MERGE CONTROL — this branch CONFLICTS with #5874, and the conflict is instructive.**
`merge-control.sh` (real trial merges, never a grep) reports one collision:
`rd/overview-counts-are-named` × **#5874** on
`apps/web/app/dashboard/[eventId]/_components/event-dashboard.tsx`. Both are Redesign builds, so
this is a sequencing question, not a cross-session collision. #5874 RESTRUCTURES the focal into the
status/flow columns and **deletes the region this PR edits**, relocating the digest tile further
down the file — where, having branched before this change, it still hand-spells
`{openDecisionCount === 1 ? 'open decision' : 'open decisions'}`.

So resolving the conflict in favour of #5874's structure silently reintroduces the exact wording
this PR removes. **That was executed, not predicted:** the merge was performed in a throwaway
worktree, resolved to #5874's side, and this PR's guard run against the result —
`calls the module: false · hand-spelled remains: 2 · VERDICT: RED`. The guard survives the move and
fails at the new location, which is the whole reason it asserts the CALL rather than the sentence.

**Landing order: THIS ONE FIRST** (controller decision, 2026-09-22, reversing what this paragraph
said when it was first written). The original reading was "#5874 first", which was sound until one
fact changed it: **#5874 is a draft with auto-merge deliberately unarmed, waiting on an owner review
of a layout that cannot be verified without eyes.** That would make a green, owner-independent build
wait on an owner-dependent one. The merge work is identical either way — #5874 restructures this
region regardless, so somebody re-applies `decisionsCountNoun` at the relocated digest tile in either
order — and #5874 will rebase after its review anyway, so the cost lands where it was already going.

Measured before accepting the reversal, rather than inferred from the fact that only one collision
was listed: `git merge-tree --write-tree origin/main rd/overview-counts-are-named` exits **0 with
zero CONFLICT lines**, so this branch lands on `origin/main` alone cleanly.

🔑 **What makes the order reversible at all is that the guard asserts the CALL, not the sentence.**
A guard pinned to the rendered wording would have been satisfied by whichever copy of the digest tile
survived the merge, and would have had to land in a fixed order. This one follows the code through
the relocation and fails at the new site — proven above by executing the merge, not predicting it.
Whoever rebases #5874 will be told by a red test, not by remembering this paragraph.

The `notBookedLabel` call site merges cleanly and needs nothing. `merge-control.sh` also flags a COUPLING
row — #5874 imports `lib/digest-sub.ts`, which this PR touches — but that edit is a single docblock
example line with no runtime effect, and the function is inert in both branches.
