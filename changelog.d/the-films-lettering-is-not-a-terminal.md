## 2026-08-25 · fix(guest): the save-the-date film's lettering leaves the terminal face

H-2, owner-approved 2026-08-24 ("lettering YES") after a side-by-side. The film's
small announcements — "Save the Date", "Together with their families", "Mark your
calendars", "The ceremony", "The celebration", "Formal invitation to follow",
"Watch our story", "Until then" — sat in DM Mono directly above the couple's
names and read as terminal type.

🔒 ONLY THE FACE CHANGES. Size, tracking, uppercase and tone are byte-identical.
`text-terracotta` is the gold at 3.37:1; moving the colour would have exceeded
the approval, so it is untouched.

**The brief named one line and the change is four.** `lib/std-themes.ts`
`labelCls` is the DEFAULT; `applyTextTone()` in `save-the-date-film.tsx` REPLACES
it wholesale on any event whose background sets a legibility tone — which is most
of them. Changing only the line the brief named would have been inert on exactly
the events it was for. Measured: `font-mono` in the film 5 → 1, and the 1 that
remains is the protected "Created at Setnayan" watermark.

Sites moved to `font-serif` (which resolves inside `.sn-editorial` to
`--font-editorial-display`, the face the couple's names are already set in):
the shared `labelCls`, both tone overrides, the "Press and hold to pause" pill,
and the "Tap for sound" cue — the last is beyond the brief's list on purpose: it
is the same shape in the same overlay, and leaving it behind would have split one
film across two faces.

⛔ Protected and untouched: the 9px "Created at Setnayan" watermark, the 0.66rem
gild section eyebrows (pinned at 19 across the guest tree).

Guards: the H-2 gate in `the-invitation-is-not-a-receipt.test.ts` is **INVERTED,
not deleted** — it used to hold the change out, it now holds it in, with a floor
of exactly one surviving monospaced site. The DUPLICATE gate in
`the-veil-asks-like-an-invitation.test.ts` is retired to a pointer rather than
inverted as well: two statements of one rule in two files is how they drift.
4 mutations, each measured before → after, all red.

SPEC IMPACT: None — iteration 0024's look choice is unchanged; only the label
typeface moves, under an owner approval already recorded.
