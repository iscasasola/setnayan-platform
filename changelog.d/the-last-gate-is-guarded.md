## 2026-09-10 · test(admin): round 6 — the last gate before an irreversible delete is CALLED, not read

`/admin/verification-docs` permanently deletes government IDs from an unversioned
R2 bucket. Round 5 pinned `verification-docs-server.ts` whole and that pin held.
This round takes the same treatment to the three modules it did not reach, after
reproducing six green sabotages first.

**Moved out of the untestable modules (the primary fix):**
- `performVerificationDelete` — the read/judge/delete sequence, including the
  branch that decides whether `r2Delete` runs at all. It sat in a `'use server'`
  module `node:test` cannot load; `if (verdict !== 'ok')` → `if (false)` was
  GREEN at 90/90 with all three of its text guards still passing.
- `verificationDocShelves` — which shelf offers a delete. Both `deletable={true}`
  sabotages on the page were GREEN at 90/90.

**Guarded for real:** a reference read that THROWS now has coverage. The test
named for that property resolved with an error object instead (a refusal, not a
raise), so both swallow-shaped edits were GREEN and clean under `tsc`.

**Pinned:** `actions.ts` whole-body, the technique proven in #5399, for the
bucket choice — `@/lib/r2` is `server-only`, so that one cannot be called.

No behaviour change: the eleven legal stored shapes score exactly as before, and
a genuine orphan is still deletable.

SPEC IMPACT: None.
