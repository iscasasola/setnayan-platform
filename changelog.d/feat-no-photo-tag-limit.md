## 2026-08-06 · feat(papic): no per-photo tag limit — and the screens finally match the decision

**Owner, 2026-08-06:** *"no tag limit. we can tag as many."* Supersedes the
20-tag lock of 2026-07-23, which itself superseded a 10-tag lock of 2026-06-17.

### The bug this exposes is worse than the limit itself

The two capture screens **hardcoded 10** — while the database had allowed **20
since 2026-07-23**. So a paparazzo was stopped at *half* the real limit and told
*"This photo already has 10 tags — that's the max."* **The owner's own decision
never reached the screen.** The database was updated, three server functions were
updated, and two `const TAG_CAP = 10` lines were not.

Both numbers are now gone.

### What changed

**Screens** (`papic-guest-capture.tsx`, `papic-seat-capture.tsx`) — every counter
and ceiling removed. `12/10` becomes `12 tagged`; *"This photo has all 10 tags"*
is gone; the table-scan notice no longer claims a limit was hit. The
`cap_reached` and `truncated` branches are **kept but re-worded**, because an
older server can still return them and silence would be worse than friendly copy.

**Server** — `enforce_photo_tag_cap()`, `papic_tag_capture()` and
`papic_tag_guest_capture()` no longer refuse on count.

### ⚠ Why a ceiling still exists in code, at 100,000

It is **not a product rule** and no real photo can approach it — a crowded
wedding shot has tens of faces, not tens of thousands. It exists solely so a
runaway writer (a retry storm, a loop bug, a hostile client replaying a table
scan) cannot append unbounded rows to one photo's tag list. Deleting the trigger
outright would leave `photo_tags` with no backstop of any kind.

**If the owner wants that too, say so and the trigger goes.** But the honest
guard against abuse is a rate limit on the RPC, not a per-photo count — those are
different mechanisms and only one of them was ever doing this job.

### Verification

`tsc --noEmit` exit 0 · all 15 lint scripts pass · migration timestamp guard
passes (1,054 migrations, unique + allocator-sourced) · zero `TAG_CAP`
references remain in either screen.

SPEC IMPACT: **Applied.** This reverses a locked decision at the owner's explicit
instruction. `10_Papic_Feature_Specification.md` and the `DECISION_LOG` both
record "Max 20 LIVE tags per photo" and now need the 2026-08-06 row.
