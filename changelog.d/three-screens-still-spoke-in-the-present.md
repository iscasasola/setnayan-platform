## 2026-08-21 · fix(dashboard): three screens still spoke in the present tense the day after

All three read off the owner's **live signed-in dashboard**, the morning after his Movie Night, while auditing what was left after [#4661](https://github.com/iscasasola/setnayan-platform/pull/4661). None of them would have been found by a test, because each is a correct-looking string on a screen nobody had opened in that state.

### The Hosts page asked a movie night who was planning the wedding

`"Who's planning this wedding with you?"` — hardcoded from the days when weddings were the only event type. The page has read `event_type` all along, for the role dropdown; the masthead never asked. Two things wrong in one line: the wrong noun, and the present tense on a celebration that had finished. Now `eventNoun` (weddings byte-identical) and, once it is over, *"Who planned this event with you?"*

### The seat plan said guests were watching, the day after

A red pulsing **"Live — guests are seeing this now"** on the seating chart of an event that ended the night before. The banner gated on `isEventDayActive` — **T-12h .. T+60h, two and a half days.** That window is right for the surfaces guests actually use and wrong for a message *about* them. It now asks the same resolver every other surface asks, so it lets go at 06:00 the morning after with the rest of the product.

### The browser tab said "Setnayan" twice

`Date checklist · Setnayan · Setnayan`. The label table bakes the brand into `pageTitle`, and the root layout's `'%s · Setnayan'` template appends it again. Stripped at the call site rather than in the table, because those strings are pinned by tests as complete titles — and that call site is the only place any of them is ever consumed.

### Verification

- 4 sabotages, each measured by occurrence count (comments stripped — every fix quotes the string it removes), each RED: the hardcoded wedding returns (0 → 1) · Hosts loses the past tense (1 → 0) · the seat banner reverts to `isEventDayActive` (0 → 2) · the brand strip is removed (1 → 0).
- 🪤 **One did not land on its first attempt** (0 → 0 — a curly apostrophe defeated the pattern) and its green meant nothing; re-run through a real matcher it landed and went RED.
- The checklist assertion also checks the **behaviour**, not just the source: `checklistChrome('date').pageTitle` still ends in `· Setnayan`, which is exactly why the strip has to exist.
- Unit suite **9177 pass / 0 fail**. Typecheck, `next lint` and the lint guards clean.

SPEC IMPACT: None — copy and one visibility window.
