## 2026-08-12 · feat(vendors): a vendor can finally ASK us to fix a permanently wrong detail

Owner, 2026-08-12: *"build that button to request."*

**RULE 0: almost nothing here is new.** `requestProfileCorrection`, the
`/admin/corrections` queue that resolves it, the field labels, the RLS policies
and the admin apply/decline paths **all shipped complete** — and the action had
**zero callers**. No screen anywhere rendered a form, so production held **zero
rows**: the queue could never receive anything. This PR is the missing doorway,
not a rebuild.

**A card on My Shop — "Something here is wrong?"**

- The **web address is offered to every vendor at every tier**, because it is
  immutable for *everyone* (database trigger), not merely locked once verified.
  A signup typo is exactly how a wrong address happens, and it happens long
  before verification — so gating this behind the verified lock would have
  withheld it from precisely the vendors who need it.
- The other locked identity details appear only once verified — before that the
  vendor edits them inline, so offering them would be noise.
- A field with a request already waiting shows as *"waiting on Setnayan"*
  instead of inviting the same request again.
- ⛔ **Asking is not changing.** Nothing here writes to the profile; the address
  stays permanent-by-design either way.

**Proven under real RLS against production**, in a transaction that rolled back:
a vendor session inserted a `business_slug` request, read it back, `status='open'`
— so the button is not merely rendered, it is *permitted*. (A missing policy
would have made it silently useless: the writer turns any error into "please try
again shortly".)

🛡 **A reachability guard — and it took THREE attempts to stop being decoration:**

1. *"Does any file call the action?"* — the card satisfied that **by itself**, so
   deleting its mount left the guard green while the doorway was gone.
2. Rewritten to walk the import graph from real route entries — but the
   mutation renamed the symbol and **left the import path**, so the walk still
   reached the file. The mutation, not the guard, was wrong.
3. Then it matched **prose**: `/admin/corrections` carries comments *explaining*
   that nothing can file a request, and those comments contain the symbol — so
   the guard found a "caller" in the very files documenting its absence.

Now: import-graph walk from `page/layout/route` entries, **comments stripped**,
and mutation-proved by deleting the import line and the JSX the way a real
unmount does — one failing test, restored, green.

🔑 **A mutation must look like the regression it simulates.** Renaming a symbol
is not unmounting a component.

SPEC IMPACT: DECISION_LOG.md — the correction queue now has a vendor-side intake.
