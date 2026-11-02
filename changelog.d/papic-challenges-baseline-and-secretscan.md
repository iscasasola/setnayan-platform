## 2026-08-07 · fix(papic-games): rebase, record the trigger-function reason, and un-trip the secret scan

Three red checks, none of them the feature:

**1 · `THE FREEZE`** — the usual cross-PR baseline collision. Rebased onto main
and **regenerated** (never hand-merged; two sides editing the same running
totals is what makes this file conflict).

**2 · `no NEW anon-callable SECURITY DEFINER function appears without a written
reason`** — `papic_missions_prompt_guard`. Recorded in
`anon-rpc-surface.baseline.txt` with a reason that was **verified, not
assumed**: it is a TRIGGER function, and probing the replayed schema as `anon`
shows PostgreSQL refuses a direct call outright —
`trigger functions can only be called as triggers`. The guard's own question
("what stops an anonymous caller passing arguments of their choosing?") has no
attack surface here: there are no arguments, and the only way into the body is
writing to `papic_missions`, which its RLS governs.
⚠ Deliberately **not** revoked — the revoke buys nothing already true, and
PostgreSQL's trigger-time privilege behaviour is not worth risking on a write
path to remove a line from a report.

**3 · `secret scan`** — a false positive **in a comment**. gitleaks'
`generic-api-key` rule read the slash-joined role list
`couple/coordinator/admin/service_role` as one high-entropy token and reported a
leak at line 201. There is no credential anywhere near it.

🔑 **Split rather than suppressed.** An inline `gitleaks:allow` would silence the
rule on that line permanently, and a suppression marker on a line that never held
a secret is one nobody can later evaluate — it looks identical to a marker hiding
a real key. The phrasing changed instead; the second occurrence in the same file
was reworded too, so the token appears nowhere in this PR.
⚠ Fixed by **amending**, because gitleaks-action scans *every commit in the PR
range* — a follow-up commit would leave the original still failing.

SPEC IMPACT: None — no behaviour change. Comment wording, a regenerated
baseline, and one recorded review reason.
