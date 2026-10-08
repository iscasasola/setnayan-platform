## 2026-10-08 · feat(studio): a style card whose file must load says how much is in, holds only its own strip, and can be stopped

Owner, verbatim (2026-10-08, the template gallery; `INTERACTION_RULES.md` § 9 "Style
card while a file loads"): *"when pressed. show a loading screen 0-100 pie to know how
long til it uploads"* · *"when we are picking and the option is not yet done loading,
nothing can be pressed"* — and his *"yes"* to both of the controller's limits (a pie only
where progress is really measured; only that strip locks). Stacked on
`rd/press-feel-everywhere`. Local commit; nothing pushed.

- **The pie is a MEASURE** (`lib/pick-load.ts`), read off what the pick was already doing —
  0 requests added:
  - a picture (a scene, their photo, the cover, a clip's still): the colour read's own
    `fetch`, read as a stream — bytes so far over the `Content-Length` the server sent;
  - a film: `buffered` over `duration` of the sample screen's own `<video>` — the element
    that plays it (`LoopPicture` tells; the pick hears);
  - an upload: `FileUpload`'s own printed figure, handed up (`onProgress`, optional);
  - **no total, no pie**: no `Content-Length`, a compressed body, a film whose length is
    not known yet → no figure anywhere (the small mark stands in). A plain save shows its
    words ("Applying to your Hub…") and never a percentage.
- **Nothing under a blink**: no veil, pie or tick for a file that arrives inside ~300 ms
  (`BACKGROUND_PICK_QUIET_MS`, the line's own).
- **Only the strip waits**: while a card's file loads, the other cards of THAT strip are
  dimmed (40 %) and cannot be pressed. Source ▾, the rows under the strip, the top bar and
  Exit are untouched. This replaces "a second tap moves the ring" for a LOADING pick; a
  pick that is only being saved still locks nothing (a later pick wins, as before).
- **A tap on the loading card cancels** — "Cancelled — nothing changed". It is true
  because a file is now LOADED FIRST, APPLIED SECOND: a film's draft write waits for the
  film (it used to be sent at the tap), a picture's already waited for its colour read. A
  cancel aborts the picture's fetch / stops waiting for the film, draws the last landed
  background again, and has written nothing.
- **The 8-second stop** (`BACKGROUND_PICK_CANVAS_WAIT_MS`, the existing constant): a file
  still not in after 8 s turns the line into "This is taking longer than it should." with
  **Try again** and **Cancel**. The load is not stopped by the clock — if the file arrives
  meanwhile the pick goes on. An upload is never called stalled (it may take minutes and
  `FileUpload` watches its own silence).
- A film that will never move on this device (reduce motion, a refused play, a film that
  failed) says "ready" at once — its still stands and the pick never waits on it.

Requests: a picture pick — 1 fetch + 1 draft write (unchanged; the fetch is now
abortable). A film pick — 1 draft write (unchanged), sent after the film is playing
instead of at the tap; the film's own bytes are the sample `<video>`'s, as before. A
cancelled pick — 0 writes (was: not possible). No poll, no interval: two one-shot
timeouts (the blink, the 8-second stop).

Guards: `a-loading-pick-is-honest` (6, new) · `a-background-pick-shows-at-once` (2 lines
re-aimed, with the reason) · `the-background-has-one-source` (1 line re-aimed). 25
sabotages seen red.

⚠ Words that are the builder's, not the owner's: "This is taking longer than it should."
and the hint "· tap the card to cancel" (the gallery's own). The owner's are "Loading
files…", "Applying to your Hub…" and "Cancelled — nothing changed".

SPEC IMPACT: None (the rule is already in `INTERACTION_RULES.md` § 9).
