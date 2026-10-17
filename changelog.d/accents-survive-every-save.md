## 2026-10-17 · fix(maker): an accent pick never takes another scene's back out of the draft

Owner, 17 Oct: *"the accents are not saving"*. The accents are ONE map (`style_preferences.scene_accents`) and a pick
saves it WHOLE. A pick is a held save, so no Maker render follows it and the map the page handed down stayed the last
render's; each scene's Accent ▾ is its own row, so the next scene's pick was built on that old map and its save took
the earlier scenes' picks back out of the draft. The draft door (`mergeHubDraft`) was not the cause — it already keeps
every other drafted column and merges `style_preferences` key by key.

Every pick is now noted in the Maker's draft store (`noteAccentPick` / `draftedAccentsOr`, `lib/maker-draft-store.ts`
— the same core the canvases and the ticket style use), and every Accent row reads and builds through it.
Guarded by `apps/web/lib/accents-survive-every-save.test.ts` (an accent on every scene + a Love Story save + ✓ Apply +
reload; two properties of the draft door), with five sabotages seen red.

The Apply sheet also named an accent pick "Guest's ticket · QR look"; it now reads the scenes and "Decorations"
(`hubDraftChangePlace`, `lib/hub-draft-change-lines.ts`), the word the Pro sheet already uses.

Walked in the Maker lab at 375 px (Chromium, light + dark): before — each pick replaced the last in the draft and a
reopened Accent ▾ showed the look's default; after — all four lab scenes' picks stay, through ✓ Apply and a reload.

SPEC IMPACT: None
