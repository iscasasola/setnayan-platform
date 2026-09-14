## 2026-09-14 · fix(invitation): Ninong and Ninang reach the invitation — and the next role cannot go missing

**A live defect, fixed, plus the guard that makes its whole class visible.**

PR #5489 split `principal_sponsor` into `principal_sponsor_ninong` /
`principal_sponsor_ninang`. The invitation's entourage publishes names from an
explicit **allow-list** — closed on purpose, because that section puts guest
names on a page anyone with the link can open — and the allow-list did not learn
the two new values.

So between that merge and this one, a guest set to Ninong or Ninang was **dropped
from the invitation entirely**. `ENTOURAGE_ROLES` is also the query's
`role.in.(…)` filter, so the row was never even read. No error, no gap, the page
rendered perfectly.

🔑 **Nothing was red, and nothing could have been.** Two suites, each internally
consistent: the role split's tests knew nothing about the invitation, and the
invitation's tests knew nothing about the split. And because the 47 legacy
`principal_sponsor` rows were deliberately not backfilled, day one would have
looked correct — it would have surfaced weeks later, to a couple, as *"we changed
her to Ninang and she vanished."*

### The fix

All three values publish under **Principal Sponsors**. The legacy one is kept
because 47 live rows hold it and gender is stored nowhere (`side` is which
family, not who). On the invitation the split halves read **Ninong** and
**Ninang** — the bare word a Filipino guest reads — while the dashboard's picker
keeps its longer "Principal Sponsor (Ninong)" label, where the prefix is what
groups them in a dropdown.

### The guard — `entourage-covers-the-cast.test.ts`

> Every role in the wedding cast **and** the Nikah cast is either **published**,
> or **named in `entourage-unpublished.baseline.txt` with a reason**.

- **Both role sets**, because the Nikah cast is already published and checking
  only the Catholic one would leave the next `wali` to fall through the same door.
- **A baseline line with no reason is a failure**, so the guard cannot be
  silenced without making a decision.
- **Nothing may be both published and baselined** — that is a contradiction, and
  whichever a later reader trusts, they are misled.
- **A vacuity assertion**: the casts and the allow-list must be non-empty. An
  empty list iterates zero times and passes forever, which reads exactly like a
  guard that works.

⚠ Today's baseline records two **owner calls that are not settled**:
`bride_immediate_family` / `groom_immediate_family` are excluded because a
printed invitation names the parents, not siblings and grandparents. Publish them
if the owner wants a Family section.

### Proved, not asserted

- The guard is **RED against the pre-fix allow-list** — the exact state that was
  live — naming both roles and offering the two honest answers. Green with the fix.
- The widened 25-role filter was run against the **production** PostgREST: `200`.
  A malformed operator returns `400` on the same endpoint, so the `200` means the
  filter parses rather than meaning nothing.
- The enum values were confirmed present in prod via `pg_enum` **after**
  `deploy-prod` succeeded — not inferred from the migration file being merged.
  Adding these strings before the migration applied would have failed the query
  and blanked the entire entourage on every live invitation.

SPEC IMPACT: None — #5489 carries the role-split ruling. This publishes it.
