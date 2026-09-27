## 2026-09-27 · feat(maker): a scene's words are edited from the scene

Owner, writing his own invitation in the Event Hub Maker: *"i cannot write a message"* · *"this is the
editor, so we can edit here"* · *"needs to show on the scene editor"*.

- **Tap the words, write the words.** Tapping the Special message's text on the canvas (or the empty
  "write your message" placeholder, or its navigator tile) opens that scene's **Content** with the text
  box focused and the cursor at the end — no longer the font sheet. Same for a Letter scene built on the
  message and for **What to bring** (`lib/maker-scene-words.ts`). The words' font · colour · size stay one
  tap away ("Font, colour & size" under the box, and the Format tab).
- **What is typed is on the canvas as it is typed** — a new bridge message (`words`,
  `editor-bridge.tsx` `previewSceneWords`) writes it into the scene's real look; an empty scene shows it
  in the same widget guests get (`MakerEmptyScene` `look`), and the "only you see this" line stays until
  saved. The box's AP-11 starting point shows on the canvas the moment the box opens. Nothing is saved by
  typing; Save puts it in the draft, and guests see it after Apply.
- **Details is the source; a scene edit asks "everywhere or just here"** (brought forward from the paused
  `rd/maker-everywhere-or-just-here`): "Change it everywhere (updates Details)" or "Just this scene"
  (stored in the scene's `config_json.canvas.details`, shown with "Edited here · ↺ Use Details"). Guest
  renders, the Letter scene and the navigator read the one rule, `sceneBoundText`
  (`lib/details-bound.ts`). First-visit tour `customer_details_bound_v1`.
- **The navigator tile shows a scene's own version** of the message, and the tiles read the draft
  (they read the live message before).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-27 "THE MAKER IS THE EDITOR: WORDS ARE EDITED WHERE
THEY ARE SEEN" and 2026-09-25 "DETAILS IS THE SOURCE; A SCENE EDIT ASKS 'EVERYWHERE OR JUST HERE'" as
recorded. Typing directly inside the canvas (contenteditable) stays the target, not built here.
