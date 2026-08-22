## 2026-08-21 · feat(story): a moment takes its name from the couple's own run-of-show

"As the Day Unfolded" chapters shipped with `title: null` — a slice of a timeline
can only ever be called "Moment 3". But the couple wrote a run-of-show months
earlier (*Ceremony, 2:00pm*), and a photo taken at 2:14pm IS the ceremony. A
chapter whose lead photo falls inside a scheduled block now carries that block's
name, on the public story page AND as the placeholder in the couple's editor, so
the empty box and the live page cannot say different things.

- `lib/moments-from-the-schedule.ts` — `scheduleWindows` / `labelForCapture`.
- ⚠ The wall-clock trap is the whole reason this is its own file:
  `event_schedule_blocks.start_at` stores the VENUE'S wall clock in a timestamptz
  column (prod holds `14:00+00` for a 2pm Manila ceremony) while `captured_at` is
  a real instant. Compared raw, every afternoon photo files under the morning —
  out by 480 minutes. Block times are lifted with `plannedInstant` first.
- 🔒 `is_public` is part of the query. A block the couple kept off the guest
  schedule must not have its words painted across a public page.
- An open-ended block ends at the next block OR 90 minutes, whichever is sooner —
  otherwise a 2pm ceremony with a 6pm reception is a four-hour "Ceremony" that
  swallows the drive, the portraits and the waiting.
- A block that names nothing, or cannot be placed, is dropped. A photo in the
  gaps keeps no name: an unnamed moment is honest, a wrongly-named one is a lie
  about somebody's wedding.
- The couple's own typed title still wins over the schedule name.
- 8 tests, green under UTC / Asia/Manila / America/New_York / Pacific/Kiritimati;
  6 mutations, each verified to land BY OCCURRENCE COUNT and each red.

SPEC IMPACT: None — no price, SKU or locked decision moves.
