## 2026-09-22 · fix(admin): the payment-gate audit inserts read their error

CI caught four Supabase calls added an hour earlier that discard their `error`:

```
discarded from:admin_audit_log.insert — 4 now, 0 inherited
    at app/admin/settings/actions.ts:371, :533, :665, :700
```

`a-database-error-is-never-ignored.test.ts` is right, and its wording says why this class is
worse than it looks: **Supabase RESOLVES with `{ error }`; it does not throw** — so the failure
is silent and a try/catch around it is dead code.

All four are the paper trail for the § 9.1 receiving-account gate. Two record the REQUEST; two
record the EXECUTION and are **the only place two admins are recorded together**. ⚠ Four eyes
that leaves no trace of the second pair is a control nobody can audit afterwards.

They now read the error and report it **without** aborting: the approval row is the control and
is already written, and the money change has already succeeded — undoing a correct change
because a log write failed would be the worse outcome. The two execution-side messages say
explicitly that the change is **live but unrecorded**, because that is the sentence someone
reading the console at 2am needs.

### 🔑 Why my own sweep missed it

I ran the affected set with `grep -l "<changed-basename>" *.test.ts` — 17 files, all green. This
guard was not among them, and could not have been: **it scans the whole tree, so it names no
basename I changed.** A changed-basename heuristic is structurally blind to whole-tree scanning
guards, and this repo has many of them.

The heuristic is still right for proportionality — it is how `an-ai-may-not-approve-money`
surfaced on the refund PR. It just needs a companion: the tree-scanning guards
(`a-database-error-is-never-ignored`, `every-cleanup-delete-is-pinned`,
`the-receiving-account-has-one-door`) must be run on **any** change, because they are about the
shape of code rather than about a file.

SPEC IMPACT: None.
