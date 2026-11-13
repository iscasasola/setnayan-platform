## 2026-11-13 · fix(maker): Post Event's parts list shows only its own scenes, once (F-W2-44)

Live walk after #7596: the desktop "Parts of this page · 26" on Post Event listed the Cover Scene, Greeting, Digital
pass and Love Story (another stage's pieces) and Memories twice. Post Event is ONE page in the Maker, so every section
drawn on its canvas that no page list claimed was counted as an "added" part of it — the old invitation's sections
too, and the invitation's photos (`w:our_photos`, "Memories") beside the story's own gallery (`p:gallery`, "Memories").

- `makerStageOwnsCanvas` (`lib/maker-part-groups.ts`): on Post Event a part is its own only when it is one of its
  scenes (`p:<scene>`) or the closing (`f:closing`); `makerPartsWithAdded` applies it to the page's own list and to
  added parts. Every other stage is unchanged.
- Test in `lib/maker-part-groups.test.ts` — red with the rule removed.

Follow-up items F-W2-45, 48–54 and the /recap note before the day: in progress on this branch.

SPEC IMPACT: None.
