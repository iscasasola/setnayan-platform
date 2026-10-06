## 2026-10-06 · feat(maker): the "Stages | Studio" frame, behind a flag (PR 1 of 6)

The frame of the new Event Hub Maker — plan
`EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 1, prototype
`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`. Owner, verbatim:
*"let us leave the seat plan and build the rest"* · *"studio, will have the same
top nav, but a different approach on the 10 studio pages"* · *"1. tiles · 2. yes
for those 2"* · *"yes add prints as the eleventh tile"* · *"Also the lower third
screen can be resized up to lower half of the screen. Drag the edge to resize"*.

- **The switch** — `lib/maker-stages-studio-flag.ts` `makerStagesStudioEnabled({ internal })`:
  `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED` through `envFlagEnabled`, OR an internal
  viewer (the launch page's existing `viewAsFreeSwitch().offered`). Decided once on the
  launch page; `MakerShell` is handed one boolean. Registered in `env-flag.test.ts`,
  `flag-chokepoint-scan.test.ts` and `.env.example`.
- **Flag ON, phone:** the top nav is ✕ · one `ISegmented` **Stages | Studio** · ↺ · ✓ (n)
  (`maker-bar.ts` `MAKER_TOOLBAR_STAGES_STUDIO`); no Page ▾ / Event Details / 👁 on a phone.
- **The lower third** drags from its top edge between `MAKER_LT_HEIGHT` and half the screen
  (`MAKER_LT_HALF`), a tap toggles, the size is remembered on the device
  (`lib/maker-phone-room.ts` `makerLtClampPx` · `makerLtTapPx` · `makerLtStoredPx`). Its
  two-group menu becomes ONE item ▾ (`PickMenu`): the five stages — or, in Studio › Look,
  the eleven tools.
- **One bottom sheet** (`maker-sheet.tsx` `MakerSheet`) — every `PickMenu` inside the new
  Maker opens into it on a phone (`pick-menu-place.ts` `PickSheetContext`,
  `pickOpensAsSheet`). Elsewhere a list opens exactly where it did.
- **Studio's home** — `lib/studio-tiles.ts` (eleven tiles: Info · Look · Logo · Mood Board &
  Dress Code · Schedule · Love Story · Wedding March · Seat plan · E-Gifts · RSVP · Prints),
  their ✓ / Missing from the SAME `guidedItemDone` / `wordsAndPlansItem` / setup reply-by /
  read counts the Event Details rows use; a fact not read makes no claim. `studio-home.tsx`
  (lazy, `details-lazy.tsx`) draws "Studio · n of 11 ready". A tile opens the SHIPPED Event
  Details item full screen under a slim Tool ▾ row; Look stays in the lower third; Wedding
  March and Seat plan hide the top nav and show ✓ Done; the seat plan is the shipped one,
  unchanged. Tapping Studio again returns to the tiles.
- **Flag OFF:** the shipped Maker — its render measured byte-identical to `origin/main` in
  eight states (React ids included). Desktop unchanged either way.

Guards: `lib/maker-stages-studio-flag.test.ts`, `lib/maker-stages-studio-ships-dark.test.ts`
(sabotage: the launch page's decision hard-coded `true` → red; the helper returning `true` →
red), `lib/studio-tiles.test.ts` (sabotage: Prints dropped → red).

SPEC IMPACT: None — builds the approved plan's PR 1 dark; the deviations are listed in the PR
for the owner (no "Saved" word on the Tool ▾ row; the Settings / Preview rows are not on the
phone's new frame until PR 2 / PR 4).
