## 2026-09-19 · fix(booking): a refused review / slug / inquiry-outcome read still degrades, but leaves its reason (S41 · booking 4/5)

`result-dropped-silently` (S26 both-ends baseline, #5625), BOOKING tier — 15
sites. Each degrade is deliberate and unchanged (review provenance fails closed
to `false`, a slug check fails closed to `unverified`, outcome rollups read
empty, the self-review probe fails open to the DB trigger); each REFUSAL now
records `[supabase-error] <file> · <target>` with the error object.

Sites: `reviews` ×6 (trusted stats ×2, booked-through-Setnayan, via-vendor-
import, own review, completed events), `slug-availability` ×5,
`inquiry-outcomes` ×3, `self-review-gate`.

Pinned by `lib/review-and-slug-reads-keep-their-reason.test.ts` (7 readers
executed against a refusing and an empty stub; reverting `slug-availability.ts`
turns its 2 refusal cases red).

SPEC IMPACT: None
