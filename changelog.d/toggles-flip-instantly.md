## 2026-09-29 · fix(maker): the RSVP switches flip on the tap — no page-wide wait, and a refused save says which switch went back

Owner, on the Event Hub Maker's RSVP page ("The questions" — Ask one question at
a time, Plus-ones, Meal choice, Song request …): *"when a toggle is pressed.
everything loads for around 3 seconds"* … *"when turned off."*

**Root cause.** `MakerRsvpSettings` (`launch/_components/maker-rsvp-ask.tsx`)
set the switch's value INSIDE `start(async () => …)`. React 19 holds every
state update made inside an async transition until the whole action settles, so
the controlled switch snapped back at once and moved only when the server
answered — and every switch, the "Who can RSVP?" pair and the reminder switch
carried `disabled={pending}`, so one tap greyed the whole page for the round
trip. A second tap waited longer still: Next runs server actions and
`router.refresh()` one at a time, so its save queued behind the first tap's
whole-Maker refresh. Nothing about OFF is different in the code (ON and OFF post
the same object through the same path); OFF is what the owner met, because five
of the six questions and the reminders start ON, so the first taps on the page
are all OFFs.

**Fix.** The switch is drawn first, outside the transition, and the draft save
runs behind it through `makerSave` (the #6118 path — one refresh per burst; the
RSVP picture loads the new render behind the one shown, `MakerPageFrame`).
Nothing on the page is disabled while a save runs. Each save posts the latest
whole `rsvp_ask_config`; a render that left before a tap of mine landed does not
re-seed the switches (no flicker back); a refused save puts the switches back to
what the draft holds and says so in words — *"“Meal choice” did not save, so it
is back as it was."* — only for the newest tap (a later tap carries the whole
object and decides).

**Guard.** `lib/every-maker-edit-shows-before-it-saves.test.ts`:
- A · a state write inside the transition that holds the save no longer counts
  as "drawn first" — it was the blind spot that let this pass;
- A · one `WAITS_ON_PURPOSE` reason now excuses ONE handler — the RSVP switches'
  `save` had been riding the reply-by date's `save` excuse (same name, same
  file); the reply-by handler is now `saveReplyBy`;
- D (new) · no Maker switch, radio or checkbox is `disabled` by a save in
  flight (`useTransition` / `useFormStatus` pending), directly or through a
  same-file component prop.
Sabotaged each way (disabled back on the six switches through `<Switch>`, on the
Who-can-RSVP radio directly, on the Reveal's effects through `<FineTune>`, and
the write moved back inside the transition) — each goes red naming the line.

Every other Maker switch was checked and already flips on the tap: Details'
print-set rows (uncontrolled checkboxes, saved by Save), the Reveal's stages and
effects, the Save the Date Film · Photos pick, the logo studio's switches, the
Event Bar switch, and the scene Shown · Hidden eye (`gateWrite`).

SPEC IMPACT: None.
