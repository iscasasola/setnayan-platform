## 2026-09-28 · feat(event-hub): the Dress code scene wears the Mood Board — everyone's colours in general, only yours when you're signed in

Owner, verbatim (2026-09-28), looking at the Maker's Dress code scene: *"we already have a palette and it adjusts real time with the event hub. if in general, show our theme and the palettes of each role. but if there is an account specified to this, show their palette only."*

- **General view** (a stranger on the public link, a guest with no role, and the couple's own Maker canvas): "Our colours" — the Mood Board's main colours — then one tidy row per role the couple dressed on the Mood Board (label, outfit line, and ALL of that role's colours), in the Mood Board's own order, couple first and guests last. The ninang/ninong outfit lines from the dress-code editor sit under Principal Sponsors. Roles with no colours and no outfit are left out.
- **Specific view** (an identified guest whose role has something to say): that role only — call time first, then the outfit, then EVERY colour the role holds (it used to be the first one only).
- **The Maker canvas is general.** The host editing the hub used to be answered for their own row ("You are in the entourage · #FAF7F2"); the dispatcher now withholds the role on the canvas (`guestView` is false only there).
- **The stranger's door** (`public-hideable-widget.tsx`) now passes `event.role_palette`, already selected by `loadEventShell` (admin client — no grant or migration involved).
- **Live:** the scene reads the same `event.role_palette` the page's theme colours are built from, off the same (draft-overlaid, on the canvas) row, through `resolveDisplayPalette` — the palette the Mood Board shows and the 3D room dresses people in.
- **Authored palette merges:** `dress_code_config.palette` joins "Our colours" (Mood Board colours lead; a typed colour with the same hex lends its name; typed extras follow). Nothing authored is dropped.
- **Look:** every chip has a 1px inner outline so a near-white colour is visible; the "you" panel no longer sits on the veil fill.
- New: `resolveAttirePaletteColors` (mood-board.ts — the single-colour resolver now returns its first), `GuestDressCode.hexes`, `lib/dress-code-for-everyone.ts` (general-view builder, `ourColoursWith`, `speaksToThisReader`).
- Tests: `lib/the-dress-code-wears-the-mood-board.test.ts` (18, each sabotaged red once); `each-role-wears-its-own.test.ts` extended; `scene-words-follow-the-ground.test.ts` fixture now carries a Mood Board so the new words are ink-checked.

SPEC IMPACT: `DECISION_LOG.md` (corpus) — new 2026-09-28 row "THE DRESS CODE SCENE WEARS THE MOOD BOARD", quoting the owner and recording general vs specific, the merge rule for the typed palette, and that the Maker canvas is general (corpus commit `f0de915`).
