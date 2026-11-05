## 2026-11-02 · feat(schedule): Release (Pro) and "Your schedule" on Event Hub › Me (Step 6)

HOLD FOR OWNER OK — guest-facing.

- **Release:** a host or a coordinator with Edit on the Schedule presses it in the Schedule's 🔊 sheet (Home's Release
  door now opens that sheet). Pro only — on Free the button wears ◆ Pro and opens the upgrade, never a release. It records
  `events.schedule_released_at` once (`release_full_schedule`) and writes ONE in-app `schedule_released` notice to each
  guest account on the event. No email.
- **Your schedule on Me:** before Release (and always on Free) the chapters this guest is invited to, plus an Estimated
  call time for a role holder; after Release their own lines and exact call time. Time TBA reads "Time TBA". A guest
  never sees another person's lines.
- Guests hold no live connection: the card renders inside the cached Event Hub copy; Release moves the event's stamp.

SPEC IMPACT: None — builds SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3, §3b, §11b as written.
