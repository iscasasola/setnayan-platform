## 2026-08-18 · fix(event-hub): "Mateo Turns Seven Are Married" — the story page stops marrying everybody

**What the owner saw**, on his own test event's After preview:

> # Mateo Turns Seven Are Married
> *Mateo Turns Seven (TEST) are married — amid a joyful crowd of everyone they
> love, at last at Kidzoona SM North.*

🔑 **NO WORD-COUNT COULD HAVE FOUND IT, AND FOUR OF MINE DIDN'T.** That sentence
exists in no source file. It is **assembled at runtime** from a template
(`` `${first} Are Married` ``) and a display name. Every scan I ran looked for
wedding words sitting beside event words in the SOURCE; this one only becomes
wrong when a real event name is substituted in. **A defect can be COMPOSED
rather than written, and a grep can only find what was written.**

**The whole recap was composed from wedding sentences** — the headline, the deck,
four closing lines, the fallback lede, and an `After N years together` prefix
that counts a couple's history. `EditorialData` did not carry the event type at
all; the composer had no way to know.

**Fixed:** the type is carried through, and every one of those sentences has a
non-wedding twin. A wedding announces a marriage; **every other event announces
ITSELF** — the display name already IS the occasion ("Mateo Turns Seven"), so it
stands alone rather than being pressed into a wedding sentence. The verb becomes
*celebrated*, which carries a birthday, a graduation and a reunion without
pretending any of them is a wedding. `After N years together` stays on weddings.

🔒 **A wedding is byte-identical, asserted** — headline, deck and verb all
pinned. A null or legacy event type reads as a wedding, the same fallback as
every other guest-tree surface, so nothing in production moves.

🛡 `recap-voice.test.ts` — 6 assertions **against the OUTPUT, not the template**,
because the template was never the thing that was wrong. It pins the exact
string that reached a real screen. **Mutation-proved:** the headline ungated
**3 fail** · the deck verb ungated **1 fail** · the closing verb ungated
**1 fail** · a non-wedding read as a wedding **4 fail** · restored **6 pass**.

🪤 **AND THE GUARD READ NOTHING ON ITS FIRST RUN.** It examined
`c.paragraphs` — a field that does not exist; it is `leadParagraphs` — and
`?? []` turned the typo into "nothing to check", so the body of the story was
never examined and ungating the closing verb stayed **GREEN**. **A `??` on a
misspelt field is a guard that reads nothing and reports success.** Fourth guard
of that exact shape in one session.

⚙ Also: `s13-is-finished.test.ts` correctly flagged the composer's new
event-type comparison and it is now on the bill with its reason — the guard
doing its job on the same day it was written.

⚠ **NOT OBSERVED** — the recap needs a published story, which no production
event has. Test-proved. The owner's screenshot is the evidence it was real.

SPEC IMPACT: None.

---

## Addendum — §5's THREE VOICES were specced in June and never built

The owner asked where the editorial redesign was — the round-up video, the
columns, the clickable sponsored vendors. **RULE 0 paid: all three ship.**
`Editorial_Experience_Spec_2026-06-18.md` §5–§7 is the design, and the page
renders **28 sections**, including a real embedded film, three vendor sections
where Pro/Enterprise/Custom get a logo, a tier badge and a link to their shop
(free suppliers get a plain credit — exactly as §3 specifies), and the columns
wall. **Nothing needed redesigning; it looks like nothing because no production
event has a published story.**

**But one part of §5 genuinely was NOT built, and this builds it.** The spec
asks for three distinct voices — *parents* at the highest weight, large type and
centred; *best man / maid of honour* named with a role badge; *guests* in the
masonry. Measured: **every column rendered identically**, and the only role
words anywhere in the editorial tree were inside SAMPLE PROSE.

**The data was there the whole time.** `guest_columns.guest_id` joins straight to
`guests.role`, and that enum already carries `bride_parents`, `groom_parents`,
`maid_of_honor`, `best_man`, `principal_sponsor` and 27 more. **The reader
simply never selected it** — one column on a query that was already running.

🔒 **A ROLE IS AS IDENTIFYING AS A NAME, AND IS GATED THE SAME WAY.** There is
exactly ONE maid of honour: printing that badge over an unnamed column would
name her to everybody at the wedding. So the role rides the SAME consent as the
byline (`author_named_publicly`, DPO ruling 2026-08-06) and is stripped **at the
reader**, so an unconsented role never reaches a component that could render it.

⚖ Deliberately NOT every role in the enum — a ring bearer with a badge is
clutter. The spec asks for distinction where it means something.

🛡 `voices.test.ts` — 9 assertions, including that the consent gate lives at the
reader and that a badge only ever prints beside a name. **Mutation-proved:** the
role escaping the byline consent — the privacy one — **1 fail** · parents
flattened back into the masonry **2 fail** · a badge printing the raw database
value **1 fail** · the ordering dropped **1 fail** · restored **9 pass**.

⚙ `s13-is-finished.test.ts` flagged the new badges ("Parents of the bride") and
they are now on the bill: **BUCKET 1** — the ROLES are wedding-only, a birthday's
guests carry `guest`, so the badge never renders there. Neutralising them would
invent a role nobody holds.
