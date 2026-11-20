## 2026-11-20 · feat(maker): the Event Hub Maker — one toolbar, full screen, a way back

Owner, 20 Nov: *"Yes, build it"* on `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` v17
(DECISION_LOG rows "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED", "MAKER EDIT ROWS RUN BY
IMPORTANCE", "MAKER · WAY BACK + BUILT-IN GUEST PAGES").

- The Maker is full screen; ‹ leaves; ↺ History is ⚙'s first group; "Event name"; E-Gifts has a visible Back.
- Every scene has ONE toolbar: head ‹ · name ▾ · › · ✕, body, foot Edit · Style · Animate ◆ and ⤢ Expand
  (only on Logo, Love Story, Schedule, E-Gifts — the parts with an editor to expand into; never Dress code).
  Background is a row of Style, not a tab. ▶ plays from the Animate tab.
- A tap always SELECTS (no editor rises from the tap); nothing is auto-picked on arrival.
- The way back: ✕, phone Back (closes Expand first, then the toolbar — `useBackCloses`), swipe the toolbar
  down, a tap outside a scene, Esc. With nothing selected the resting bar reads "Tap any scene to edit it"
  with Look and Pages.
- Full screen editors: ✓ Done in the head and ⤡ Minimize; Esc and Back close them.
- 👁 is on the phone's top bar (it replaces holding ▶).
- New Pages sheet (`maker-pages-sheet.tsx`): Whole Event Hub (Look) first, then this stage's pages with
  their scenes (tap goes there and selects), 👁 opens the shipped "What guests see", built-in pages say
  words only.

- **Full screen.** While the Maker is open the app's top bar and bottom nav step away — the app's one
  mechanism, `useChromeAway` (the picked client's) — and the shell follows them as they slide. The bar is
  ‹ · Stage ▾ · ✓ Apply · ⚙ (a desktop keeps its 👁 Preview menu); ‹ goes to the event's Home. Amends 30 Oct's
  "THE APP'S NAV STAYS".
- **↺ History is ⚙'s first group**, with "Undo last change" and "All changes" (the shipped list). The draft bar
  hands it over through `MakerDraftDoor.history`; an unread history is said, never shown as "nothing waiting".
- **One toolbar on every scene: Edit · Style · Animate ◆.** Background is Style's own toggle beside the tabs; ▶ is
  Animate's (and the stage's while nothing is picked); ◆ marks Animate for a couple without the full Event Hub.
- **A tap always selects.** Logo, Love Story, Schedule, Dress code and E-Gifts no longer jump full screen on a tap;
  ⤢ Expand on the toolbar opens the editor of Logo, Love Story, Schedule and E-Gifts. Full screen has its name, ⤡ Minimize and ✓ Done on top; Esc and the
  browser's Back close it too (one close path, one pushed history entry). Fixes E-Gifts' "no way back".
- **The guest E-Gifts page** (`/[slug]/pabuya`) has a labelled 44-px ‹ Back.
- **"Event name"** labels the title's field (it writes `events.display_name`).

Controller review @a25ac75f5 (drawing v17): Dress code has no ⤢ — its door is "Colours and mood board"
("DRESS COLOURS STAY IN MOOD BOARD"); ⚙'s History group reads "History · waiting for ✓ Apply" (empty: "Nothing
waiting · Your changes collect here until ✓ Apply") and sits after the rows that change right away; ◆ is "part of the
full Event Hub", never "Event Pro". Proof re-taken against v17 at 375 px light/dark plus desktop, with a gaps list that
names the part carrying each remaining v17 ruling (`build-sessions/shots-maker-one-toolbar/README.md`).

Not in this PR, named: ⤢ on Wedding March and Memories (no full-screen editor for either in the Maker yet);
👁 on the phone's bar (part 5); the v17 toolbar redraw, Pages, Look, ⚙ regroup and Stage ▾ without Post Event (part 4);
Style/Animate/Edit rows (part 4b); ◆ on every Style choice and the Apply sheet's words (part 6).

Guards re-aimed to the ruling, each citing it; port and root-map baselines regenerated (one deliberate removal: the
↺ anchor on the bar).

SPEC IMPACT: None (the rulings are already in `DECISION_LOG.md`, 20 Nov).
