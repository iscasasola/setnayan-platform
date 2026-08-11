## 2026-08-11 · fix(papic): dedicated credits are a FLOOR, not a ceiling — the primitive

✅ **WIRED.** All three capture paths now go through the new gate, and the old pair has no
live caller left — only stale comments, which are corrected here too.

### The defect, measured

Owner, 2026-08-11: *"that account with dedicated can still have more if they have used all
their dedicated shots"*.

He was right, and it was a defect I shipped. Measured on a replayed database before writing
any fix — an event holding **1,047 shared credits**, a camera given **3** dedicated:

| | |
|---|---|
| shots 1–3 | spent from the camera's own credits ✅ |
| shot 4 | **REFUSED** — `papic_reserve_camera_points` → `FALSE` |
| the pot | **still 1,047, never asked** — `..._for_seat` → `-1` (stand down) |

Both gates behaved exactly as designed and **the pair was wrong**: the pool stood down on the
camera having *ever* held dedicated credits, not on it having any **left**.

🔑 So *"give this camera 200 shots of its own"* meant *"limit this camera to 200"* — the exact
opposite of the promise. Dedicating is meant to guarantee a floor nobody else can spend, not
build a wall around the camera.

### The rule (owner-decided)

A capture spends the camera's own credits first, as many as it has; the shared pot pays the
remainder. A camera never stops while the event has credits anywhere.

> camera holds 2 · a 10-second video costs 8 → **"spend 2 and take 6"**

The owner chose splitting over the simpler "if it doesn't fit, the pot pays it all", which
would have stranded small remainders on a camera forever.

### Why a new function rather than an edit to the two gates

🔑 **THE SPLIT CANNOT BE DECIDED BY TWO GATES IN SEQUENCE.** The seat gate *mutates*: by the
time the pool gate runs, the camera's usage counter has already moved. Asking the pool gate
"did the camera pay for this, or should you?" is then unanswerable — a camera that spent its
last credit and one that had none to spend are, after the fact, **the same row**. Any answer
it invented would double-charge some captures and let others through free, leaving no trace
either way.

So the decision moves into ONE function, under ONE row lock, in ONE transaction:
`papic_reserve_capture_split` → `(ok, dedicated_spent, pool_spent)`. The refusable leg (the
pot) runs first, so an ordinary refusal spends nothing and needs no rollback.

A NEW NAME, not an extra parameter — an overload makes the PostgREST call ambiguous, which
this schema has been bitten by before.

🔑 **Its inverse ships in the same migration.** `papic_release_capture_split` takes back the
two figures the reserve returned. Releasing the whole cost to either side alone silently moves
credits between the camera and the pot — the camera's guaranteed floor would quietly grow, or
the couple would be handed back credits the camera actually spent.

`papic_capture_points_available` counts **both** balances, for the presign probe: asking the
camera's own bucket alone is what refused an upload URL to a camera with a full pot behind it.

### Verification

`papic-dedicated-is-a-floor.db.test.ts` (9), **mutation-tested four ways** — the camera
overdrawing, the original stand-down-on-total bug, a refusal still eating the camera's
credits, and the release putting everything back on the pot. Every sabotage verified applied;
restore verified byte-identical. The first two even break the migration's own self-check, so a
database would refuse to apply them.

### What the wiring changed

**The record seam** (a paparazzo's camera) and **the guest capture route** now make ONE call
instead of two, and **the presign probe** asks what the camera can spend across BOTH balances
rather than its own bucket alone — that last one was the same defect a seam earlier, refusing
an upload URL to a camera with a full pot behind it.

🔑 **A HAND-WRITTEN UNWIND DISAPPEARED IN EACH OF THEM, and its absence is the point.** Both
seams carried a "if the second ledger refused, release the first" block, and the guest helper
carried eighty lines of it. That code existed because two calls could half-succeed. The split
is all-or-nothing inside one transaction, so the state it cleaned up cannot occur — and a
release left standing would now un-spend a capture that *was* paid for. The guest helper's
test was **inverted** accordingly: it used to REQUIRE the partial unwind, and now fails if one
is present.

⚠ **Two flags became two COUNTS.** `seatBooked`/`poolBooked` could only ever say "release the
whole cost to this side" — meaningless once a capture can be paid from both at once. They are
now the two figures the reserve actually returned.

⚠ **Stale comments corrected, not left standing.** Several docblocks still described the
pool "standing down" for any camera holding dedicated credits — the mechanism that caused
this. A comment that outlives its behaviour is how the last gate on this codebase stayed shut
for seven weeks.

🪤 **A mutation of mine did not apply and briefly read as a passing guard.** A `perl s///`
without `/g` replaced only the first occurrence — in a docblock — leaving the real call intact,
so a "reverted" seam still looked wired. With `/g` the guard fires correctly. Same trap this
repo already documents; verifying the sabotage LANDED is what caught it.

SPEC IMPACT: `DECISION_LOG.md` (2026-08-11 · dedicated credits are a reserve, not a cap;
a capture spends dedicated first and the pot covers the remainder).
