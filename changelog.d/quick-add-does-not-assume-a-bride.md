## 2026-09-17 · fix(guests): no surface asks a sideless event which side somebody is on

The owner opened the quick-add sheet on a Simple Event and was asked for a **SIDE**, with the
picker already set to **Bride**. B3 (#5560) had fixed `/guests/new` the same day — but that is
the *secondary* door, reached via "or use the full form". The empty state leads with
"+ Add your first guest", which opens this sheet. **The primary path still invented a bride.**

🔑 **The fix had been pinned to a FILENAME instead of a PROPERTY**, so it closed one of four
doors and nothing could tell us. Four surfaces render a side control; this closes two more and
records the fourth.

- `quick-add-sheet.tsx` — already resolved the role set for its role list, so the helper dropped
  straight in: the control is absent and the seed is `SIDELESS_SIDE`, not `'bride'`. The grid
  drops 4→3 columns so Role and Group keep their widths.
- `[guestId]/page.tsx` — same gate, role set already in hand.
- `[guestId]/actions.ts` — **the half that is easy to miss.** It required a valid side and
  redirected `?error=missing_side`. Hiding the field without this is a screen that looks right
  and silently refuses to save, which is worse than asking the wrong question. Now routes
  through `resolveSubmittedSide`, and persists the RESOLVED value.
- `chip-editors.tsx` — a client island handed no role set, so gating it means threading the
  answer down from the page. Recorded as a shrinking backlog rather than left silent.

New guard `app/dashboard/no-surface-invents-a-bride.test.ts` is a SWEEP, not a file check: it
enumerates every side-rendering surface and requires each to gate on the shared helper, requires
both write paths to use the resolver, and holds the backlog at one. A fifth surface fails here on
its first commit instead of on a host's screen.

Sabotage, both run: reverting the sheet's seed to `'bride'` → 5 pass / 1 FAIL; restoring the
action's `missing_side` refusal behind a hidden field → 5 pass / 1 FAIL. Restored 6/0.
The three changed files were typechecked in isolation before pushing.

SPEC IMPACT: None. No schema change, no new decision — the same 2026-06-13 role-set rule B3
applied, now applied everywhere it was always meant to reach.
