## 2026-11-11 · feat(event-hub-maker): Studio is gone — its pages open from their scenes; Prints is a row of the ⚙ (Build 6 Lane F)

Owner 10 Nov: *"Studio technically is gone since the pages there will be inside the different scenes it covers."* On
11 Nov he asked why he still saw it. Prototype `prototypes/event_hub_stages_scenes_2026-11-10/` (frames M1–M8, H4).

- **The bar is one stage pill** (`● Invitation ▾` · ↺ · ✓ · ⚙). The Studio half, the Studio pages list, its
  "n of N ready" and the Studio home of cards are removed (`StudioSideSwitch` → `StageSwitch`; `studio-home.tsx` deleted).
  While a scene's editor is open, the same place reads `✕ · <its name>`; ✕ goes back to the scene.
- **A tap on the scene opens its editor:** the cover's ring → the Logo Maker; Dress code → Palette + Dress Code;
  Love Story → its chapters; Schedule and E-Gifts likewise (`makerPartRisesEditor`). The rest of the cover is selected
  and opens the cover's own tools, as before. Editors rise from the tapped scene in 0.7 s (the house `riseFromRect`)
  and ✕ plays the reverse (`lib/maker-editor-rise.ts`, loaded lazily with the pill, never in the Maker's first load).
- **The parts' doors drop "Studio":** "Open in Studio › Logo" → "Open Logo" (`makerSceneDoorWords`). The words
  "Set it in Studio › Palette + Dress Code" → "Set it in Event Hub › Dress code" (help, the seat plan, the dress-code
  fields); "edit it in Studio" → "tap the scene to open its editor".
- **⚙ › Prints:** a row under Your Event Hub opens the shipped Prints page.
- **Old doors land on the new place:** a link that names an item (`?tool=details&item=…` — notifications, Home's cards,
  `/studio/mood-board`) used to land on Studio's home; it now opens that item's editor, and any other link lands on the
  stage (`makerDoorLanding` + `studioTileOfItem`).
- ▶'s label is "Play this scene" (it was already the fifth thumb button).
- Guard: `lib/no-door-leads-to-the-removed-studio.test.ts` (five mutations seen red). The copy sweep now also catches
  any Event Hub "Studio › <page>", "Studio ▾" or "Open in Studio". Two Studio-only test files retired
  (`studio-pages-have-no-title-row`, `studio-menu-ends-with-hub-settings`); their still-true claims moved into the guard.

Not in this PR (listed in the PR body): the ↺ History list (changes how the draft is written and undone, so not
look-only), the Hub's stages carousel (Build 5 Lane G item 6), and the prototype's in-editor thumb rows.

SPEC IMPACT: None in the corpus from this PR — it builds the rulings of DECISION_LOG 2026-11-10 ("EVENT HUB = PURELY
STAGES, BUILT FOR SPEED"; "ALL YES — BUILD 5 OPEN CALLS SETTLED", Lane F part). The corpus `FEATURE_REGISTER.md` row for
Lane F should be updated once the controller ships it (Studio removed; History list still open).
