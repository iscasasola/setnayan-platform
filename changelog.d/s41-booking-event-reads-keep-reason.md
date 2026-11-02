## 2026-09-19 · fix(booking): a refused read on an event's bookings still degrades, but leaves its reason (S41 · booking 5/5)

`result-dropped-silently` (S26 both-ends baseline, #5625), BOOKING tier, last
batch — 18 sites. Each degrade is deliberate and unchanged (a count of 0, an
empty map, no venue named, a job that sends nothing, `measured:false` /
`failed:true` where the caller already reads it); each REFUSAL now records
`[supabase-error] <file> · <target>` with the error object.

Sites: `chapter-event-participation`, `communities` (samahan messages),
`creator-public`, `daily-email-jobs` + `papic-fullres-drop` (full-res clock),
`event-decisions` ×2 (unread counts), `events` ×2 (confirmed count, reception
anchor), `live-wall`, `nav-registry`, `package-draft-loader`, `std-venues`,
`story-arrangement-store`, `story-cover`, `supplier-night-before-email`,
`venue-room-size`, `wizard-recommendations`.

Pinned by `lib/event-booking-reads-keep-their-reason.test.ts` (6 readers
executed against a refusing and an empty stub; reverting `events.ts` turns its
refusal case red).

With batches 1–5 (#5656 · #5657 · #5658 · #5659 · this) the BOOKING tier's
`result-dropped-silently` lines read 0 under #5625's scanner (80 findings → 0).

SPEC IMPACT: None
