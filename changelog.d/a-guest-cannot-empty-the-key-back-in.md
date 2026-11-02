## 2026-08-24 · fix(guest): a guest can change the couple's recorded email, but not empty it

W2-A item 6 — the one the brief marks *"do it first"*, because it is the one with
real consequences.

The reply card wrote `email`, `mobile` and `display_name` straight over whatever
the couple had typed. Every box on that card is `defaultValue=`, so a browser
that failed to prefill — or a guest who cleared a field to retype it and gave up
— wrote **NULL over the couple's value**. For `email` that is the seat's
identity key: the cross-device sign-in match (`join/[eventId]/actions.ts`,
`lib/event-account-link.ts`) and the person-relink the guests BEFORE-INSERT
trigger uses, so a nulled address quietly re-creates the same relative as a
stranger at the host's next event.

🔒 **OWNER RULED 2026-08-23, asked directly: "No for email, yes for the rest."**
- A guest MAY **change** the address to their own — the couple's typo is theirs
  to correct.
- A guest may NOT **empty** it.
- **`mobile` and `display_name` stay freely clearable**, deliberately.

⚠ **THE TEST IS LOCK-OUT, NOT OWNERSHIP — and over-applying it is itself a
defect.** The argument that a guest controls their own data is a good one and is
exactly why the other two fields stay open. Two tests exist solely to fail if a
later "consistency" pass makes all three conditional.

⛔ **THIS IS DELIBERATELY NOT `.is('email', null)`.** That is the JOIN DOOR's
rule (`lib/event-account-link.ts:47` — *"only fills a NULL email so we never
clobber a different address the couple already recorded"*), which refuses to
**change** an existing value — precisely what the owner permitted. Same column,
opposite question; copying the shape would have shipped a rule nobody asked for.
The instruction to reuse it was followed to the point of reading it, and then
not followed, because it implements a different ruling.

🔑 **AND THE NARRATION HAD TO MOVE WITH THE DATA.** `actions.ts` told the host
*"They removed their email."* — after this change that describes a state the
data can no longer reach. It now reports **added** vs **updated**, and the
change report is computed from what was **stored**, not what was posted, so a
guest saving with the box blank no longer reports a change that did not happen.
The mobile removal line is untouched, because mobile removal is still reachable.

⚠ **NOT HOISTED TO A CONST, AND THAT IS LOAD-BEARING.** The first cut wrote
`const emailPatch = …` + `...emailPatch`, which turns the shipped
`only-the-answer-freezes.test.ts` **RED** — that guard slices the update payload
and requires the literal `email:` inside it and outside the frozen branch. I
widened the guard and mutation-proved the widening, then **reverted it** and
inlined the spread instead: of the two legal options, the one that re-points
somebody else's guard is the riskier, and this change now touches no existing
guard at all. That file is byte-identical to `main`.

🛡 **10 mutations across two rounds, every one measured.** Final shape: the
erasure returning · the removal line returning · the report reverting to the
posted value · the rule over-applied to mobile — all RED.
🪤 **One of those guards was decoration on its first run** and it is the fourth
substring trap of the day: `assert.match(SRC, /mobile:\s*contactMobile,/)` is
satisfied by `...(contactMobile ? { mobile: contactMobile } : {})`, so the exact
over-application it exists to catch passed **GREEN**. Re-anchored line-wise
(`/^\s*mobile: contactMobile,$/m`) and re-measured.

✅ typecheck clean · **test:unit 9659/9659**.

SPEC IMPACT: closes item 6 of `WHATS_NEXT_Guest_Activation_2026-08-22.md`
§ SECTION 2.
