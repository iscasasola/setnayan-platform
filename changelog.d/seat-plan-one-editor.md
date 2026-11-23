## 2026-11-23 · chore(spaces): fold the Spaces stack (#7968 → #8057 → #8088) into one PR

The three stacked Spaces PRs ship together as one merge, as Ship and the controller asked. Their own fragments carry the changes: `rooms-seating-piece-a.md`, `seat-plan-floor-redesign.md` and `spaces-13-screens.md`. This PR adds no feature of its own.

- Merge commits only, in order. The only real conflict was the admin supplier page's imports (`verifiedElsewhere` from main plus the Spaces readers); both were kept.
- Every generated baseline takes main's side; Ship regenerates them. `tests/db/ugat-concept.baseline.txt` keeps the stack's reasoned lines.
- Migrations are unchanged from #8088 and ship together: `20271350389612_shop_rooms_and_seating.sql` · `20271356372536_spaces_on_schedule_pools.sql`.
- Server actions: 1251 / 1251.
- Next (owner 23 Nov, "Two PRs"): PR 2 grows PlanMaker until it carries every couple seat-plan feature, then moves the couple's seating editor onto it, so couples and Spaces share one editor.

SPEC IMPACT: None. These are the approved Spaces and seat-plan drawings, already ruled in their own PRs.
