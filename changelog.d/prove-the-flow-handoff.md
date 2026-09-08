## 2026-09-08 · docs(handoff): rewrite PROVE-THE-FLOW for a new Claude Code account

The next session runs on a **different account**, so `~/.claude/**/memory/` does not
travel and the spec corpus is a second repo it may not have. Everything needed is now in
this one committed file.

🔑 **The previous version had decayed exactly the way it warns about.** It claimed
`chat_threads = 0` after the first inquiry in the platform's history already existed, and
named a couple account (`testnayan4` / `Ana & Miguel`) that the live test never used. It
is the third time this repo has been bitten by its own most-read handoff.

Re-measured against prod and rewritten:

- **§ 1** the real frontier — `chat_threads = 1`, `chat_messages = 3`, and
  `vendor_replies = 0`: **the supplier has never once replied in production.**
  `templates = 0` and `payment_methods = 0` block the two steps after that.
- **§ 2** what shipped 2026-09-08 so it is not rebuilt, including the lesson that two
  layers hid the customer and deleting the mask alone changed nothing on screen.
- **§ 4** the supplier-inbox build plan (5 phases), the prototype link, and the owner's
  already-made decision that the stage control is **read-only and derived** — with the
  instruction to extend `apps/web/lib/vendor-thread-stage.ts` rather than write a fourth
  resolver.
- **§ 5** tools a new account cannot infer: project refs, the worktree/`node_modules`
  trap, the guard runner, the never-apply-a-migration-directly rule.
- **§ 6** traps measured this session — vacuous guards that passed their own sabotage,
  zsh not word-splitting, `git checkout` unable to restore an untracked file,
  `deploy-prod` green not meaning "served".

`apps/web/lib/prove-the-flow-doc-is-alive.test.ts` caught one dead path during the
rewrite — a repo-relative link written as if rooted at `apps/web`. That is the guard
doing its job.

SPEC IMPACT: None — the two owner rulings it summarises are already recorded in
`DECISION_LOG.md`.
