## 2026-10-15 · feat(entourage): On the axis · Lines · The march — Two sides withdrawn

Owner 2026-10-15 (DECISION_LOG "TWO SIDES IS DROPPED" + "ENTOURAGE STYLES 4 AND 5 APPROVED";
prototype `entourage_two_columns_2026-10-15_fable.html` styles 4 and 5).

- **On the axis** replaces the old Roll call under the same style id `roll-call` (so the default and every saved
  Roll call pick get it with no data change): every group is two columns at 375, the left cell set right so each pair
  meets at the centre, a single keeps the cell the pairing gave him with the partner cell blank, a role word only
  where the heading can't say it — UNDER the name in small caps — column words once per sided group
  (`EntourageGroup.sideWords`, read-only, from the heading's own words), centred hairline dividers.
- **Lines** (new id `lines`): pairs flush-left in two columns, a hairline between groups, anyone alone centred across
  both columns with their role word.
- **Two sides** (`two-sides`) withdrawn: its renderer is gone; a saved pick resolves to the default.
- The Maker's Style carousel lists the three with their real miniatures (`?style=entourage:<id>`, unchanged path);
  Post Event keeps its own "Roll call" under `roll-call` via a stage-scoped name (`stageNames`, `lib/scene-styles.ts`).
- New guard `lib/the-entourage-second-column-is-the-partner.test.ts` on a stand-in copy of the real cast (no real
  names): every two-cell row is a pair `buildEntourage` made, every solo keeps a blank or is centred. Re-aimed (none
  deleted): `every-scene-style-draws`, `scene-styles-stages`, `fixed-scene-styles`,
  `layouts-are-the-shipped-scene-styles`, `the-heading-says-the-role`, `a-fixed-block-has-its-own-background`.
- The print card (`lib/print-layout.ts`) is unchanged.

SPEC IMPACT: None beyond the owner's own 2026-10-15 DECISION_LOG rows (already in the corpus); builder calls are
recorded in the PR body.
