## 2026-10-02 · feat(maker): tap any text to type — on every scene, not only the hero

Area B of the two-week audit: tap-to-type reached only the hero (`typeablePart`); every
other scene's words were typed in an inspector box. Now a tap on a scene's words puts the
caret IN them on the canvas, and what is typed goes into the hub DRAFT (live for guests
only at Apply), through the type bar's one held write path:

- **Special message** — the message (`events.special_message`), note and letter styles.
- **Reminders** — the reminders (`events.what_to_bring`), note style.
- **A scene of their own** (plain and template scenes) — its heading and its words
  (`config_json.custom`), wherever the scene draws them whole.

The Maker tells each loading canvas which words each field draws (`typeHere`); the canvas
marks the one part whose words are exactly those (`data-el-field`) and says back what it
found. Words a style splits (the quote, the list), an empty scene, a message changed
"just here", and a Letter's shared message are not marked — those keep their box. Where the
caret reaches, the box steps aside (one place per setting): the Special message / Reminders
Content box becomes a one-line pointer, and the own-scene form keeps only what the page does
not draw yet (first words, or "Add a heading") and always drafts in the Maker (a field it
leaves out is kept as drafted by `saveCustomSection`). The bar: no Wording ▾ (no existing
line to offer — none invented), no Format ▾ (words, not a date), Style ▾ opens the part's
own sheet, Hide is the part's own show/hide on its scene's canvas. Several-line words keep
their lines (Enter is a new line); a heading's Enter is Done.

Guard: `app/[slug]/_components/tap-to-type-every-scene.test.ts` renders the real widgets,
stamps and marks them the way the canvas does, taps them, and writes the draft; sabotaged
(the mark not set; Enter ending a message) it goes red.

SPEC IMPACT: None
