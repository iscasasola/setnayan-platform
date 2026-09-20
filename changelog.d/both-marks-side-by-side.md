## 2026-09-20 · feat(monogram): your saved logo is shown, its reveal plays, and both marks sit side by side

Three gaps the owner found by using the page.

**"i do not see the logo."** The upload door's preview block was gated on
`decoded` — a file picked in THIS session. So the state a couple is in every
time they come back was the state that displayed nothing: a green banner saying
a mark exists, a dropzone, and no sign of the mark itself. `<SavedMark>` now
renders the saved mark with its piece and colour counts, counted from the same
SVG that is on screen.

**"i cannot see the different monogram animation effects."** The reveal chips
only existed for a freshly decoded file, so the only way to watch an effect was
to upload the logo a second time. The saved mark now gets the same five reveals,
in ONE shared frame that AUTO-PLAYS the selected one — the shape the
Save-the-Date opening picker already uses (`reveal-preview-card.tsx`: tiles
choose, one frame plays). Auto-play is safe here because `StudioRevealPlayer`
honours `prefers-reduced-motion` itself and renders the mark static for anyone
who asked for less motion.

**"why don't i see the comparison of the create your own and upload a logo."**
The chooser showed only the winning mark. With both, it now shows both at size,
badges the live one, and switches in one tap. The switch KEEPS both files: it
stamps `data-mark="off"` on the uploaded SVG (lib/monogram-mark-choice.ts) — the
same mechanism as `data-ink`, and for the same reason, since the read sites do
not agree about which columns they SELECT. Before, the only route back to a
designed mark was "Remove upload", which deleted the uploaded file; that button
survives and now means only what it says.

Guarded: switching keeps every byte of the artwork, "live" has exactly ONE
representation (the absence of a marker, so a mark uploaded before today and one
switched back on today compare equal), re-stamping does not accumulate, a nested
`<svg>` cannot switch the monogram off, an unknown value fails toward SHOWING
the mark, and the two stamps coexist — switching marks must not silently reset
the colour choice.

Also: the chooser promised "Remove it and the one you designed comes straight
back" for ANY uploaded mark, including an event with no designed mark at all,
where removing the upload drops to the generated initials lockup. Caught on the
owner's own event. Now conditional on a designed mark existing.

Refused rather than executed: choosing the designed mark when there isn't one —
that would leave the event with no mark.

SPEC IMPACT: None.

OWNER DECISION PENDING (not actioned here): "it should be one reveal for both
only." The reveal picker currently lives INSIDE the Vector Studio (engine.ts
`#animbox`) for the design door and as chips in the upload door. Consolidating
them into one shared step reverses the 2026-06-23 lock — "improve THIS animate
the reveal … not a separate feature", which retired the standalone
MonogramAnimatePicker. Flagged for sign-off rather than silently undone.
