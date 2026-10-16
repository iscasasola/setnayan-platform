## 2026-10-16 · feat(cover-scene): words up top, the RSVP button + "Swipe up" hint, Shimmer on any text, Cover Scene › Edit

Owner-approved 2026-10-16 (DECISION_LOG "APPROVED — THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…", "THE COVER:
WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT", "SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT ·
'CONFIRM ATTENDANCE' IS THE RSVP", "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆"); prototype
`cover_scene_edit_animate_2026-10-16.html` v2 (f484bca7). Part 1 of 2 — the Opening (Style) and the one entrance
(Animate) follow in a stacked PR.

- **Words in the upper part** on all four masthead designs (`COVER_SCENE_UPPER`: from the top under ≈ 7 % padding, never
  centred; The Letter starts at the top too). The foot sits at the bottom of the full-screen cover.
- **The RSVP button** at the foot — a new hero part `rsvp` ("RSVP button" in the Maker, words the couple's, default
  "Confirm attendance", look = Look › Buttons' `.button-primary`, 44 px). For a guest it opens the shipped reply page and
  reads their own state from the Reply card (`lib/cover-rsvp.ts`): "You're coming ✓ · Change", "You can't make it ·
  Change", a shut window as plain words with no frame. A visitor without a key keeps today's first screen — the cover
  and its ONE door ("Get inside", the passcode first) — so the stranger's cover draws no foot. While the cover holds the button, the Welcome's Reply card under the cover is not drawn
  a second time (Me keeps its own).
- **"Swipe up for the event"** under it — the page's own hint (not a part), a gently nodding chevron, still under reduced
  motion. Both are cover lines: hidden behind a closed veil and entering last. The phone's "Exit preview" pill moves off
  the foot to the right edge.
- **Shimmer** — a new Action (Still · Drift · Shimmer ◆ as ONE dropdown, + Band ▾: its own colour lighter · Gold) on every
  text part of every scene; never the logo or the RSVP button. A gradient clipped to the words with a band every 5 s,
  drawn only under `prefers-reduced-motion: no-preference` and off Save-Data (`.sn-save-data`); plain colour otherwise.
  Pro at Apply as the part's own motion, named "Shimmer" in the Apply sheet.
- **Cover Scene › Edit** — the cover's lines, two to a row, each with the house switch; Event title has none ("always", a
  tap says why; `names` lost its `hidden` field). The Logo's switch IS Studio's "Show the logo on Cover and QR"
  (`events.logo_wanted`) and the cover now draws no mark while it is off. A hidden line leaves the cover at once — on the
  Maker's canvas too (no ghost; the joiner, no line of the list, stays ghosted). A line's name picks that word.
- Guards: `app/[slug]/_components/the-cover-has-its-rsvp-button.test.ts`, `lib/shimmer-is-an-action-on-any-text.test.ts`,
  `lib/the-cover-scene-has-its-own-edit.test.ts` (each sabotaged once); older guards re-anchored to the rulings; the
  guest-page goldens regenerated (the foot and the hint are the only change).

SPEC IMPACT: None — implements the 2026-10-16 corpus rows as written (no new decision).
