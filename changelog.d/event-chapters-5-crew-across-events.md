## 2026-11-04 · feat(schedule): event chapters slice 5 — one crew, two events, and the drive between them

Owner's rulings, 4 Nov: a crew is **"Same name, same shop"**, and the drive comes from an **"Admin-set speed"**.

- **The supplier's schedule** (`/vendor-dashboard/clients/[eventId]`, Schedule view) flags a moment when the same crew name of this shop is on another of its booked events the same day and:
  - the times overlap: "Second shooter is also at Mia & Paolo at 3:30 PM. The times overlap."; or
  - the gap is shorter than the drive between the two events' reception pins: "Team A is due at Mia & Paolo at 12:00 PM, 1 h 15 min after this. The drive there is about 2 h 5 min."
  - Said once above the chapters, and on each moment it touches. When the other events couldn't be read it says so ("couldn't be checked"), never drawn as clear.
- **The rule** is `lib/crew-elsewhere.ts` (pure); **the reads** are `lib/crew-elsewhere.server.ts`. The other events come from this shop's own bookings (contracted onward, not archived, same `event_date`); crews are read through the supplier's own session; a Time-TBA chapter's midnight is never a time; a task with no crew name (the whole team) is not matched.
- **Admin › Settings › Average driving speed (km/h)** — migration `20271308471868_a_crew_drives_between_events.sql` adds `platform_settings.drive_speed_kmh` (NULL, 0–150). **No default:** blank means no drive is estimated and only overlaps are flagged. The field locks when the current value couldn't be read, so a save never clears it. Saved by the existing business-identity save (no new server action).
- **Only the supplier sees it** — it names their other client. The guard checks nothing under the host's dashboard or event site imports it.
- **Guard:** `lib/a-crew-is-flagged-across-events.test.ts` (5 tests). Lab: `/dev/supplier-lab?s=schedule&state=clash|clashfail`.

SPEC IMPACT: New owner rulings to record in DECISION_LOG (4 Nov): crew identity across events = the same crew name within one shop; drive time = km between the two reception pins at one admin-set average speed, unset by default. The admin must set the speed before any drive is flagged.
