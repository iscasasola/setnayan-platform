## 2026-09-19 · fix(booking): a refused availability / seat / schedule read still degrades, but leaves its reason (S41 · booking 3/5)

`result-dropped-silently` (S26 both-ends baseline, #5625), BOOKING tier — 17
sites on availability, reservation seats, schedule pools and the run of show.
Each degrade is deliberate and unchanged (a seat hold fails CLOSED as
`invalid_input`, availability claims no open days, visibility falls back to
couple-visible, "What's next" drops the source); each REFUSAL now records
`[supabase-error] <file> · <target>` with the error object.

Sites: `vendor-availability` ×5, `slot-seat-reservations` ×5,
`schedule-pools` ×2, `schedule` (visibility), `run-of-show-advance`,
`upcoming-items` ×3 (appointments, schedule blocks, supplier payment items).

Pinned by `lib/schedule-reads-keep-their-reason.test.ts` (7 readers executed
against a refusing and an empty stub; reverting `slot-seat-reservations.ts`
turns its 4 refusal cases red).

SPEC IMPACT: None
