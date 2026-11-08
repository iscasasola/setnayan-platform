## 2026-11-06 · feat(guests-see): "The day's program" — the Schedule row says who decides what guests see of the day

Item 3 of the event-menu reorganisation finish (`EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 12's 💡 row; owner
2026-10-28 *"coordinator and couple only"*). Rule 0 first: the write rule itself was ALREADY shipped (2026-10-29,
`mayShowToGuests` in `schedule/actions.ts`, the emcee picks, guarded in `booked-is-the-team.test.ts` 6) — not rebuilt.

- Home's ONE "What guests see" table: the Schedule scene's row is now **The day's program**, with the note "Only you
  and your coordinator choose which moments guests see. Payments and meetings never show." Renamed in place — never a
  second row for the same part (the 2026-10-27 row: *"no second mechanism"*). The note reaches Home's part switches and
  the Maker's sheet through the table's existing `note`.
- Guard `lib/the-days-program-is-the-hosts-call.test.ts`: (1) one row, its words; (2) EVERY writer of
  `event_schedule_blocks` that can set `is_public` to anything but `false` is listed with its host gate — a new one
  fails until gated; (3) no supplier file writes it; (4) no guest page reads a payment or meeting source. Each sabotaged red.
- `/dev/home-lab?view=guests-see` draws the real switches over the real table (fixture rows, no database) for the shots.

⚠ Not closed here (needs a migration): `event_schedule_blocks_moderator_write` lets a delegate with schedule "edit"
write `is_public` directly in the database; the rule is the app's.

SPEC IMPACT: `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 12 — the "The day's program" row marked BUILT (draft PR);
no decision changed.
