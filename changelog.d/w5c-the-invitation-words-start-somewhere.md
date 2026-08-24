## 2026-08-24 · feat(website editor): the couple's note to their guests starts somewhere

**W5-C · AP-11.** "Special message" was a blank box with a placeholder
describing what a good message would be like. A blank box in front of a whole
guest list is why most couples write nothing and the section never appears on
their site at all.

🔑 **RULE 0 PAID: THE COMPOSER TO FOLLOW ALREADY SHIPS.**
`app/[slug]/_components/editorial/compose.ts` weaves the story page's prose
under one discipline — *"NO LLM call… It NEVER invents facts — every sentence is
gated on a field being present, and if nothing is present it renders less."*
This is that discipline applied one surface earlier, not a second mechanism.
⛔ **Deterministic, and it must never become a language model** (Setnayan AI is
owner-locked deterministic).

⛔ **NOTHING IS SAVED.** The draft is the box's starting text; it becomes the
couple's message only when they press Save, exactly as anything they typed
would. The stored column stays empty until then, so the editor row still
honestly reads **"Not set"**, and the save action is untouched — there is no new
write path and a message the couple never read can never be stored.

⛔ **NEVER OVER THEIR OWN WORDS.** One character of stored text and the draft
returns null. Whitespace is not words.

🕊 **THE LINE THAT MATTERS MOST: A WAKE IS NEVER DRAFTED A CELEBRATION.** The
solemn register (owner 2026-08-17 — a funeral is a TONE across the whole guest
tree) takes its own quiet arm: no "celebrate", no "join us", no anticipation, no
exclamation. **An auto-composer is the likeliest place for that defect to come
back**, so a test bans each of those words on the solemn arm and a second test
asserts the two registers do not share a single sentence.

⚖ **It says only what the event already knows** — names, date, venue, in the
type's own `occasionNoun`. A missing field drops its clause; with nothing
settled it returns null and the box is as blank as before, because a draft
reading "join us at TBD" is worse than the blank box it replaced.

🪤 **The date is parsed as a CALENDAR DAY by regex, never `new Date()`** —
`events.event_date` is a DATE and `new Date('2026-12-12')` is the 11th west of
Greenwich, the defect that once printed the wrong day on 41 screens. A guard
bans the constructor.

🪤 **AND THAT GUARD CRIED WOLF ON ITS FIRST RUN** — the module's own docblock
*explains* the trap and therefore contains the words `new Date('…')`, so a raw
source match flagged the note describing the fix. Comments are stripped first.

**Proof:** 12 tests; **5 mutations, each verified to have LANDED, each RED** —
a wake takes the celebratory arm · the draft overwrites their own words · a
placeholder is printed when nothing is known · the editor stops reading the
register · the draft is offered on top of a stored message. Typecheck exit 0 ·
9859/9859.

**Swept:** the standalone `/website/special-message` route is a redirect into
this one panel, so there is no second door rendering the same box.

SPEC IMPACT: None.
