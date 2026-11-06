## 2026-11-04 · feat(schedule): event chapters slice 4 — ingress and egress are backstage; a guard that guests never see them

Owner-approved 4 Nov 2026 (approved prototype "Event chapters — 4 Nov 2026", frames 2 and 8: *"Ingress and egress are back-end plans: when suppliers set up and pack up. They never show on the Event Hub. Only the chapter and its front-of-house moments do."*).

- **One rule, in a leaf module**: `lib/chapter-section.ts` now holds `momentSection` (moved from `lib/schedule-chapters.ts`, which re-exports it) plus `isBackstage` / `withoutBackstage` — a moment before its chapter starts or at/after it ends is backstage, whatever its eye says. A leaf, so the Event Hub's client bundle reads the rule without the chapters module.
- **Every guest reader drops backstage**: Event Hub › Me (`yourSchedule`), the invitation's programme (`guestScheduleByChapter`), the Event Hub's schedule (`ScheduleWidget`, on both its by-chapter and plain paths) and the host's View as a guest (`guestDay`). The Me card's read (`YOUR_SCHEDULE_BLOCK_FIELDS`) no longer asks for a chapter's setup or pack-up.
- **The host and coordinator see it open**: a chapter's Ingress · Event · Egress are all open (a tap folds one); Ingress and Egress carry "Backstage · guests don't see this ⓘ", one line per supplier, with a closed eye.
- **The supplier sees it marked**: a moment of theirs in a chapter's Ingress or Egress reads "Ingress · Backstage · guests don't see this".
- **Guard**: `lib/a-guest-never-sees-backstage.test.ts` runs each guest reader on a chapter holding a PUBLIC moment in its Ingress, Event and Egress and keeps only the Event one; scans every file under `app/[slug]` and the guest libs for setup/pack-up reads and the backstage words. Proven by sabotage: removing the Me card's filter turns it red.

SPEC IMPACT: None — builds the approved 4 Nov prototype. Flagged: a guest's OWN task line in a backstage stretch (e.g. a bridesmaid's early call) still shows on their own Me card — it is their call time, not the backstage plan; say if it should go too.
