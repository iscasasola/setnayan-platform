## 2026-11-12 · fix(shop-page): the hero badges are circles, in one spaced row

The public shop page drew Verified, the events milestone, awards and the rating as long pills, inline in a block with
0 px between them — the Verified pill touched the (DEMO ONLY) ⓘ and overlapped the "New to Setnayan" chip. They now
sit in one `flex-wrap gap-2` row and are drawn as the circular image badges (`badgeImageOf` → `ImageBadge`), the same
drawing Discover's shop card wears since #7493. Owner, 12 Nov: "Circles + spacing". Each badge keeps its hover title.
Guard: `app/v/[slug]/the-shop-page-badges-are-circles.test.ts`. The supplier's own Shop › Page fold keeps its pills
(untouched).

SPEC IMPACT: DECISION_LOG row "THE SHOP PAGE'S BADGES ARE CIRCLES TOO"; `SUPPLIER_BADGES_AND_AWARDS_2026-11-03.md`
Drawings line updated (shop page now circles).
