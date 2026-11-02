## 2026-09-19 · fix(schedule): a birthday has no pre-ceremony — the arrival block reads "Arrival"

Every non-wedding run-of-show seed files "Guest arrival" under `pre_ceremony`, and every surface
printed the raw type label — the live public programme at setnayan.com/movie-night read
"PRE-CEREMONY · Guest arrival". New `scheduleBlockLabelFor(type, eventType)` in `lib/schedule.ts`
(weddings and legacy null types byte-identical) is used by the guest-site schedule widget (all four
mounts pass `event.event_type`), the Overview schedule preview, and the host Schedule page's block
cards and type picker. Stored `block_type` is untouched. Guard:
`lib/a-birthday-has-no-pre-ceremony.test.ts`.

SPEC IMPACT: None
