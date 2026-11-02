## 2026-08-16 · fix(create): Debut and Christening were hidden from every account, forever

Owner, looking at the live create screen: *"i don't see the important events that need to be planned?"*

**Two were missing from the grid: Debut and Christening** — the two biggest Filipino life events after a wedding — folded behind the *"show all event types"* text link at the bottom of the page. On **every** account. Always.

**🔴 THE RULE WAS SOUND AND COULD NEVER SAY YES.** `hiddenMeasuredTypes` folds a measured type away when nobody in the household concerns it: a debut needs someone near their 18th, a christening needs a newborn. It reads the People layer — which is `dependentPeopleEnabled()`-gated and holds **ZERO rows in production**. So the question is asked of an empty table and answered *"no"* forever.

🔑 **AN EMPTY LIST IS NOT AN ANSWER — IT IS THE ABSENCE OF ONE.** `[].some(...)` is `false`, so every measured type read as *"concerns nobody"*. Meanwhile `people == null` (the flag-off path, four lines above) already fails **open**. The two states mean the same thing — *we know nothing about this household* — and disagreed. They now agree.

**Measured, not argued** (running the shipped functions):

```
nobody on file   → []                        (was ['debut','christening'])
flag off (null)  → []                        unchanged
an infant        → ['debut']                 christening still offered
one adult        → ['debut','christening']   the measurement is intact
```

⚠ **This narrows what hides and can never hide MORE**, so it cannot take a type away from anyone. Once real dependents exist the folding resumes exactly as designed (owner 2026-07-17, *"the grid shows what concerns the account"*) — the design was never wrong, its input does not exist yet.

🪤 **The old test asserted the defect.** *"No people at all → both measured types hide (the expander doorway remains)"* — green the whole time, describing the screen the owner was objecting to. Corrected to assert the fix, with the reason, so the next reader does not restore it.

🪤 **And my first verification of the fix reported a failure that was not real.** `npx tsc` resolved to an unrelated npm package printing *"This is not the tsc command you are looking for"*, because the worktree's `node_modules` was a symlink into a worktree pruned an hour earlier. **A tool that cannot resolve its inputs reports failure, not truth** — the same shape as the day's defects, one level up. Installed properly; typecheck clean.

8419 unit tests pass · typecheck clean · all lints green.

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-08-16 recording that measured-type folding requires at least one person on file, and why.
