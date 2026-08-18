## 2026-08-18 · fix(couple): the plan comparison marks what is actually different

Second unit of the couple's-screens port, against the approved comparison archetype
(2026-08-04, BINDING) and its own words: *"a tier list that repeats every feature for every tier
is unreadable. This archetype shows the delta, never the repetition."*

**What a person experiences:** comparing saved plans side by side, a category where every plan
picked the same supplier now says **"— same in every plan"**. The eye goes to the rows that
actually differ instead of hunting for them.

✅ **HALF OF THIS ALREADY SHIPPED AND WAS NOT REBUILT.** A **locked** category already collapses
to one full-width line reading *"locked, the same in every plan"*. RULE 0 — the repetition problem
was already solved for the half where the answer cannot vary. This is the candidate half only.

⚖ **IT LABELS, IT DOES NOT HIDE.** Collapsing a candidate row would remove the per-column control
the couple uses to CHANGE that pick, which is the entire point of this half of the grid. The
archetype asks that the delta be **findable**, not that data be removed.

⚖ **Two things the marker deliberately refuses to say:**
- **One column is not "the same as" anything.** With a single saved plan every row would be
  labelled — true by vacuity and meaningless. It needs two or more.
- **Two blanks are not "the same supplier".** Columns that both picked nothing are two absences;
  calling that sameness would tell the couple a decision was made in both plans when none was made
  in either.

🪤 **TWO OF THE THREE MUTATIONS WERE MEANINGLESS ON THEIR FIRST RUN, IN TWO DIFFERENT WAYS.**
- One **never applied** (count 1→1): my pattern spanned a line break that does not exist in the
  source. Its green proved nothing.
- One **applied and stayed green** (count 2→1): the deleted phrase also appears in the explanatory
  comment I had written twenty lines below it, so the guard was reading **my note about the rule
  instead of the rule**. 🔑 **Strip comments before matching** — the same lesson the doors guard
  already carries, re-learned on a guard written the same hour.
Both corrected; all three now land and go red.

⏭ **THE THIRD ARCHETYPE RULE IS NOT DONE AND IS NOT A RESTYLE.** The roster's *"selection lives on
the avatar itself"* means removing the guest list's checkbox column and making the avatar the
toggle — **four selection points across a 1,982-line component**, on the screen a couple opens most.
The prototype's own version is a `<button>` with only an `aria-label`, which does **not** announce
selected state — porting it verbatim would trade a correct native checkbox for an accessibility
regression. It needs a hidden native input behind the approved visual, and a fresh session with the
prototype open. **Deliberately not started at the end of a long one.**

SPEC IMPACT: None.
