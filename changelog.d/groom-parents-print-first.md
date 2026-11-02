## 2026-09-20 · fix(invitation): the groom's parents print before the bride's

The Parents group of the public entourage printed `bride_parents` first because
that is the order `GROUPS[0].roles` listed them in — `buildEntourage` walks
`spec.roles` outermost, so that constant IS the printed order. Owner, seeing it
live on a real invitation: *"parents of the groom should go first."* Swapped.

Fenced by a new case in `apps/web/lib/entourage.test.ts` that asserts the order
of the **built rows** rather than reading the constant back, and whose fixture
feeds the bride's parents first so a build that merely preserves input order
fails rather than passing by luck. Verified by sabotage: reverting the swap
turns that one case red and leaves the other 19 green.

SPEC IMPACT: None — the 2026-09-14 entourage ruling fixed the order of the
GROUPS (parents · principal sponsors · …); it never specified the order of the
two roles inside the Parents group.
