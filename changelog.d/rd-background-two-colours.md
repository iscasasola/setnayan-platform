## 2026-10-08 · feat(studio): Background › Colour is two circles — a blend runs from the first colour to the second (amendment PR 1)

Owner, verbatim (2026-10-08, DECISION_LOG "LOOK › BACKGROUND, AMENDED"):
*"When color is picked: Color Picker can be 2. so it can become ombre to do
dawn/diagonal/glow for the 2 colors · Just place 2 circle palette like moodboard
where they pick the color there"*. Contract:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A / § 3 / § 8 PR 1, prototype
frames A01–A03. Stacked on `rd/look-sample-screen`.

- **Storage — a format extension, no migration.** `events.site_bg_color` reads
  `ombre:<effect>:<hex>` exactly as before, and now also
  `ombre:<effect>:<hex>:<hex>` (≤ 30 chars). `parseOmbre` accepts three or four
  segments and nothing else; `encodeOmbre` writes the fourth only when a second
  colour is set; a malformed fourth drops the whole value (never half-read).
  Every stored one-colour value reads, draws and re-encodes byte for byte.
- **The blend.** With two colours they ARE the ramp's anchors, in the order set
  — the same nine OKLCH steps, the same legibility measurement over every colour
  of it (the veil is raised when the words need it). Dawn runs the first colour
  above to the second below; Diagonal from the lit corner; Glow from the centre.
- **The panel.** The Colour row is two circles like the Mood Board's (a 44-px
  target around a 28-px colour): the page colour → a ringed "+", or the second
  colour with a ✕ that takes it off in one tap. Both open the ONE colour sheet;
  the second's also carries "Remove the second colour". The four cards redraw
  as the blend of the two.
- **Plain is one colour.** With two, the Plain card is drawn faint, "· one
  colour", and a tap writes nothing — it says "Plain uses one colour — remove the
  second first". A second colour added on Plain lands on Diagonal.
- A pick is ONE draft write and no render: the sample screen wears it at the tap.
- The shipped Maker's one-colour field keeps a second colour set in the Studio
  (it posts it back with any blend).

Guards: `lib/ombre.test.ts` (+4 tests: the column, the ramp, the CSS, AA over
360 theme × pair × blend cases), `the-background-has-one-source` (11),
`the-guest-page-paints-the-ombre` (5)(6), and the sample = guest sweep now holds
two-colour blends. 19 sabotages seen red.

SPEC IMPACT: None beyond the contract above.
