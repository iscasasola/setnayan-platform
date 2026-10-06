## 2026-10-07 · feat(maker): Stages — the stage ▾ with its pages, Style | Text | Animate, ▶, swipe, typing on the page (behind the Stages | Studio switch)

PR 2 of `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` (Depends on #6386). Everything new is behind
`makerStagesStudioEnabled` (off for couples, on for internal accounts) and on a phone; with the switch off the
shipped Maker renders as before.

- **The stage ▾** (`stage-item-menu.tsx`, PR 1's one bottom sheet): the five stages; a stage of several pages
  expands in place to the guest bar's own pages with its icons, "Here" on the page on screen. The RSVP stage
  lists its three screens. The guest's tab bar is drawn at the foot of the page preview; a tap changes page.
- **The part map** (`lib/maker-parts.ts`, the prototype's `ELS`/`TABS` on the shipped canvas keys): each
  part's ONE source — `info:<field>` (typed on the page, the same draft value as Studio › Info) ·
  `studio:<tool>` · `supplier:date|venue` · `tool` — its layouts (the SHIPPED per-scene styles, never the
  invented five families; the Camera keeps its own three), and `my` on the four per-guest parts.
- **The panel** (`stage-tools.tsx`, lazy): `[stage ▾] · [Style | Text | Animate] · ▶`, the page's parts as
  tiles while nothing is picked, rising to half the screen when a part is tapped (on the page or its tile —
  one selection, the canvas's own message). Swipe = next / previous part, on into the next page.
  **Style** = the scene's styles as a carousel (`sceneStyleOptions`) + Background + Arrange, with ONE quiet
  row "Edit the <tool> ›" / "Change the date in Suppliers ›" / "Edit in Studio › Info ›".
  **Text** = Font · Colour · Size only (`PartTextTab threeControls` — Weight, B/I/U, line and letter spacing
  are retired behind the switch). **Animate** = Build in · Action · Build out (the shipped Comes in · During
  · Goes out). ▶ plays the part, or the whole stage scene by scene; one tap stops it.
- **Typing on the page**: a plain-text part's words are typed right there with the panel away (the shipped
  floating type bar), saved to the draft, published at ✓ Apply.

Shipped bugs fixed (plan §3 "FOLDED IN"), for every couple:
- **▶ Play / Preview replays the motion the couple chose** — the canvas ran one generic fade for every pick
  while the scene's own arrival stayed bound to the scroll; now the scene's own keyframe and each part's
  own Build in replay on time (`scene-replay.ts`, `globals.css` "PLAY REPLAYS THE CHOSEN MOTION").
- The scene Animate's pill rows (How it moves · Timing · Parts · Into the next scene · Speed) are dropdowns —
  "Cinematic" no longer clips.
- The RSVP form's three styles are reachable (its row now has a Style, and the reply page draws the pick);
  the Dress code's palette look sits under its Style too.

Guards: `lib/maker-parts.test.ts`, `lib/layouts-are-the-shipped-scene-styles.test.ts`,
`lib/the-typing-door-is-the-info-door.test.ts`, `lib/the-stage-panel-fits-a-phone.test.ts`,
`app/[slug]/_components/play-replays-the-chosen-motion.test.ts`; `lib/maker-stages-studio-ships-dark.test.ts`
now also holds the Stages panel's one door.

SPEC IMPACT: None (builds the approved plan and DECISION_LOG 2026-10-06 rows as written; no decision changed).
