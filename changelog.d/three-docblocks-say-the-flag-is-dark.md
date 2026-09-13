## 2026-09-05 · docs(chibi): three docblocks stated a false production fact — the chibi flag is ON

`NEXT_PUBLIC_FIGURE_CHIBI` was set to `"true"` in Vercel Production on 2026-08-31
(verified 2026-09-05 with `vercel env pull`). For five days three files kept
asserting the opposite as standing fact — `lib/venue-avatars.ts` ("the only
state production has ever been in"), `app/[slug]/venue/page.tsx` ("unset
(production today)"), `app/[slug]/avatar/page.tsx` ("production's only state so
far") — while `kit/chibi-figure.tsx` had recorded the flip the day it happened.
A session reading any of the three would have reasoned from a dead feature: no
maker, no `avatar_config` writes, an unchanged room. All false — the maker is
live and guests are writing configs.

- The three docblocks now say what the DEFAULT is, and carry a dated correction
  saying when the production claim became false, so the next reader does not
  re-derive it.
- `lib/a-flag-comment-is-not-a-production-value.test.ts` refuses the sentence
  shape that rots — a comment presenting the flag's production value as fact —
  in the five files that speak about this flag. A dated correction quoting the
  old sentence is allowed; a fresh standing claim is not.

SPEC IMPACT: None.
