## 2026-08-18 · fix(event-hub): the celebrant stops being told they arranged the venue

**Owner ruling 2026-08-18: KEEP ALL FIVE WORDS** — `couple` · `host` ·
`organizer` · `celebrant` · `graduate`. I had recommended collapsing to two; he
kept five and he is right: *"Your greeting is on its way to the celebrant"* is
warmer and more accurate than "to the host", and a gift really is for the
celebrant. **No vocabulary was changed — the five were already what the database
held, so his decision is the state that exists.**

🔑 **BUT TWO OF THE FIVE NAME THE HONOURED PERSON, NOT THE ORGANISER**, and the
page has six sentences about ADMIN work. **At a seven-year-old's birthday the
celebrant IS the seven-year-old**, so *"The celebrant is still arranging the
venue layout"* names the wrong person entirely. A graduate is rarely the one
doing the seating chart either.

**So the six admin sentences drop the person when the word names the honoree,
and keep naming them when it does not:**

| | celebrant / graduate | couple / host / organizer |
|---|---|---|
| seats | "Seats will be assigned closer to the day." | "The host will assign seats closer to the day." |
| programme | "The program hasn't been published yet." | "The host hasn't published the program yet." |
| venue | "The venue layout is still being arranged." | "The host is still arranging the venue layout." |
| seating | "Once the seating is posted…" | "Once the host seats you…" |

🔒 **A WEDDING IS UNAFFECTED, AND THAT IS NOT A COINCIDENCE.** The couple both
run the event and are honoured by it — which is precisely why `couple` works
where `celebrant` does not. Asserted, not assumed.

**Every other sentence still names them in all five cases** — greetings, gifts,
whose guest list, whose gallery — because there the honoured person IS the right
person. The split is deliberately narrow.

⚙ **Also changed, in DATA not code (owner: "this Corporate Event is private"):**
the `corporate` type's event word `event` → `corporate event`, so its lock screen
reads *"This corporate event's page is private"* instead of the generic
*"This event's page is private"*. Applied to the live table; no deploy needed.

🛡 `event-words.test.ts` +6 assertions (13 total): the three organiser words are
never treated as honorees · celebrant and graduate always are · an unrecognised
word added later defaults to ORGANISER (the safe direction — naming a real
organiser reads fine, naming a child who arranged nothing does not) · the six
sentences render correctly for both kinds · and the honoree-appropriate
sentences still name them. **Mutation-proved, counts printed:** honoree list
emptied (landed) **2 fail** · `couple` wrongly added to it, which would change a
wedding (landed) **2 fail** · restored **13 pass**.

⚠ **NOT OBSERVED** — no birthday or graduation exists in production, so none of
this can be seen working. Test-proved only.

SPEC IMPACT: None.
