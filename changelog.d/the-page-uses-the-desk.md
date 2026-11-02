## 2026-08-18 · fix(event-hub): the event page stops being a narrow ribbon on a desktop

**What a person gets.** On a laptop or a large monitor the event page uses the
desk instead of sitting as a narrow column adrift in cream.

🔴 **IT WAS ONE CLASS, IN ONE FILE.** `invitation-shell.tsx` capped the ENTIRE
guest page at the 48rem plate **at every width**. Moving the navigation twice —
the bar becoming a rail, then the rail hugging the page — never touched it,
**because the navigation was never what was narrow.**

At `xl` the column opens to the **STAGE** (64rem). That is not a new decision:
`_lib/measures.ts` already defines the stage as *"the widest anything may ever
be"*, and the three-widths study names **the desktop shell** as a stage-measure
thing in the same sentence. Vertical padding opens with it, so the extra room is
breathing space rather than a longer scroll.

⚠ **THE STUDY SAYS THE OPPOSITE, AND THE OWNER OVERRODE IT — SAY SO PLAINLY.**
`event_hub_three_widths_2026-08-17.html` § 08 reads *"the page remains one
centered column at its measure"*. The owner looked at the result and asked for
the narrow column fixed. **That is his call to make and it is recorded here so a
future session does not "restore" the study's version thinking it found a
regression.**

🔒 **PROSE DOES NOT WIDEN WITH IT.** Every sentence that carries a reading
measure still sits at ~65 characters, so nothing a guest READS gets a longer
line — the room around the words grew, not the words. The study's own phrase for
this is *"the masthead does not grow — the room around it does"*.

⚠ **THE HONEST RISK, MEASURED AND NOT HIDDEN: 101 left-aligned paragraphs in the
guest tree carry NO measure of their own** (27 do). Most are short mono eyebrows
and labels that cannot suffer from a wider box, but any genuine SENTENCE among
them now has a wider box to fill. I cannot tell which from source and there is no
local build. **This is the one thing in this change that wants a human eye**, and
it is exactly the kind of thing the owner has caught four times today.

⚠ `xl` deliberately — the SAME threshold the desktop rail uses, so there is one
desktop switch and not two. The rail's arithmetic was already computed against a
64rem widest column, so a wider page cannot push it into the content;
`rail-fits.test.ts` asserts that sum and still passes.

🛡 `measures.test.ts` +1 assertion (6 total): the page must open to the stage on
desktop, AND the reading measure must not gain a desktop override — if it ever
does, the words themselves started stretching, which is a different decision.
**Mutation-proved:** the stage removed, i.e. the ribbon restored (3→0 refs)
**1 fail** · restored **6 pass**.

SPEC IMPACT: None — but `event_hub_three_widths_2026-08-17.html` § 08 now
disagrees with the shipped page and should be corrected when next touched.
