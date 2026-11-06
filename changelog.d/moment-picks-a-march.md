## 2026-11-02 · feat(schedule): "This is a march" on a moment — it picks which march (+ New march)

Owner 2026-11-01: *"When we say this is a march. It picks which march. So in march we can create a march similar to schedule"* · *"And pick guests to add to the march."* (DECISION_LOG "A MOMENT PICKS WHICH MARCH"; plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3).

- **Migration `20271301571290_a_moment_picks_a_march`**: `event_schedule_blocks.march_key` — NULL (not a march) · `'entourage'` (the event's Wedding March) · an own march's key (`march_groups`, the 29 Oct custom March groups). Moments only (CHECK). A trigger refuses a march of another event or one that is gone (SECURITY DEFINER, so a coordinator with Edit on the Schedule can link a march they cannot read); deleting a march clears its moments' links and never deletes a moment. No unique index: two moments may use one march.
- **Moment sheet** (`moment-sheets.tsx`, on #7159): a **This is a march** house dropdown (ChosenRow → PickMenu) — Not a march · Wedding March · each own march · + New march. + New march asks its name and makes it with the writer Guests › March already uses (`addMarchGroup`), then links it; its guests are picked in Guests › March. Not a march writes only the moment's row. A failed read of the marches is said on the row and never turns a linked moment into "Not a march".
- Writes go through the Schedule's own update door (`moment_op` `march_set` / `march_new`, `moment-march-step.ts`) — no new server action.
- Lab: `/dev/chapters-lab?moment=1` (the run-of-show moment is "Grand Entrance") · `&marchfail=1`.
- Guards: `app/dashboard/[eventId]/schedule/a-moment-picks-a-march.test.ts` · `tests/db/a-moment-picks-a-march.db.test.ts`. Exposure baseline + Ugat screens map regenerated.

SPEC IMPACT: `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 marches paragraph — marked built (moment side). Guests › March arranging marches "one by one, like schedule lines" is the existing own-groups maker, unchanged.
