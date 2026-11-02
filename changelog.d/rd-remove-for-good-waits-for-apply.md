## 2026-10-07 · fix(maker): "Remove for good" waits for Apply; a new own scene lands where ＋ was tapped

Owner 2026-10-07: *"remove for good"* (the final fixes' item 6, as its own step).

- **Drafted delete.** In the Maker, "Delete this scene?" on a scene of their own posts the shipped `saveCustomSection` intent=delete with `draft=1` → the draft holds `widgets[custom_n].removed = true` (`lib/hub-draft.ts`). The canvas and the navigator stop drawing it (`overlayHubDraftWidgets` drops the row); Undo brings it back; Apply deletes it with `deleteOwnScene` (`lib/own-scene-delete.ts` — the same counted query as the live delete) and writes nothing else to that row; the Apply sheet says "<scene> · Deleted for good". Its slot stays taken until Apply (the editor counts slots on LIVE rows). Outside the Maker, Remove for good is instant, as before.
- **Placement.** ＋ "Add above / below <part>" → "A scene of your own" now sends the stage's order with the new scene's place marked (`lib/own-scene-place.ts`); `addCustomSection` checks it against the event's own rows and drafts every scene's place on that stage (`stageOrderPatch`, the grip drag's patch) — the new scene lands right above / below the picked scene. Off a fixed part, or an unreadable place → the end, as before.
- No migration, +0 server actions.

SPEC IMPACT: None — implements the owner's 2026-10-07 answer on the "SIX BUILD QUESTIONS / final fixes" item 6.
