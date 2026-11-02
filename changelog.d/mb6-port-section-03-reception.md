## 2026-09-03 · feat(mood-board): the reception room knows its own venue

`lib/reception-scene.ts` gains venue-type awareness (`venueZoneApplies`,
`venueSceneFamily`) keyed off `events.venue_setting` (the SAME 7-value
`VenueSetting` enum `lib/venue-settings.ts` already exports — not a new
vocabulary). `renderVenueSvg` re-shapes its scenery for `beach`/`destination`
(sky + shoreline) and `garden` (hedge + lawn), and — the load-bearing part —
GATES a zone the venue genuinely lacks: a beach or destination reception draws
no ceiling and no walls; a garden reception draws no walls but keeps its
ceiling (string lights between trees are a real garden treatment). Gating is
physical-absence-only, never a taste call: hall / restaurant / heritage /
outdoor_tent lose nothing.

The gate reaches every surface that describes the room, not just the drawing:
- the Seat Plan lab's Reception Designer (`reception-design-editor.tsx`) now
  reads `events.venue_setting` (threaded `page.tsx → SeatingLab3D → Hud →
  ReceptionDesignEditor`), shows it READ-ONLY above the drawing, disables a
  gated zone's rail chip with "not at this venue" instead of hiding it, and
  falls back off a stranded `activePart` when the venue changes;
- `buildPrompt` (the AI stylist brief) skips a gated zone's phrases even when
  a stale selection is still sitting in storage from before the venue changed;
- `moodboard-make-it-real.ts` (04, "Make it real") gains `eligiblePartsForVenue`
  — applied in `make-it-real.tsx` BEFORE `gridParts`, so a gated room part can
  never become a tile, a suggestion, or a chooser entry — and
  `briefZoneLines`/`briefWholeLookZoneLines` take an optional venue and return
  `[]` for a gated zone, independently of the `eligibleParts` filter (defense
  in depth, proven by sabotage — see `moodboard-make-it-real.test.ts`);
- the Mood Board's read-only "Your reception design" summary (page.tsx) drops
  a gated zone from its list entirely, instead of printing "Not set" next to
  a zone the couple could never have designed.

Reception's venue also moves READ-ONLY into 02's "Venue" group
(`palette-editor.tsx`'s `PaletteFamily`, new `note` prop) — a pointer to
Details, never a second place to change it, mirroring the one-directional
"majors edit at 00 only" rule the Venue group's Ceremony/Reception colour
cards already follow.

**Two items on the MB6 brief were NOT built, and are flagged rather than
silently resolved:**
- **"Drag-to-reorder the majors"** — traced to the prototype's section 00
  ("Your theme") 5-colour majors editor (`lib/mood-board.ts`'s
  `hasChosenMajors` docblock: "the couple's five majors — the reception
  palette"), which has no dedicated editor on `main` yet (it exists only in
  the still-unmerged `claude/mb5-port-section-02-palette` branch's
  `majors-editor.tsx`) and is unrelated to `RECEPTION_PARTS`/section 03. Built
  in the wrong session's files, it would either duplicate MB5's in-flight work
  or collide with it. Left for whichever session owns the majors editor.
- **Concept PDF / print PDF / vendor mood-board page** (`concept-pdf/route.ts`,
  `moodboard-printable.ts`, `vendor-dashboard/.../mood-board/page.tsx`) still
  call `renderVenueSvg`/list every `RECEPTION_PARTS` zone without a venue —
  those exports are handed to suppliers and are arguably a MORE load-bearing
  "render brief" than 04's simulated tiles, but threading `venue_setting`
  through them needed its own query + prop-plumbing pass that the brief's
  explicit scope ("excluded from 04's render briefs") didn't cover. Follow-up.

Verification: `pnpm exec tsc --noEmit` (0 errors) · `node
scripts/lint-port-no-lost-controls.mjs` (414 routes / no lost controls) ·
`reception-scene.test.ts` (36/36, new venue tests included) ·
`moodboard-make-it-real.test.ts` (30/30, two sabotage cycles run and reverted
— disabling `eligiblePartsForVenue`'s filter and disabling its call site at
`gridParts` each independently turned a different test red) ·
`moodboard-theme-generator.test.ts`'s full 2,500-row sweep still round-trips
`sanitizeReceptionDesign` cleanly (untouched by this change — gating lives in
the render/brief layer, never the sanitizer) · the `selAll()[0] === sel()`
invariant test is unmodified and still green.

SPEC IMPACT: None — no schema change, no new locked decision. `VenueSetting`
and its 7-value vocabulary are unchanged (`lib/venue-settings.ts`, from an
earlier session); this PR only makes the reception room and its downstream
briefs finally READ that existing fact honestly.
