## 2026-11-18 · chore(claude): wiring guardrails, house rules, draft architecture audit

- `.claude/settings.json` (now committed): **only** denies the Read tool on `.env*`, `secrets/**`,
  `~/.ssh`. No ask rules, no Bash denies — owner 2026-11-18: nothing may stop a builder or cloud
  session mid-flow (builds and pushes run all day). Per code.claude.com/docs/en/permissions, Read rules
  also cover `cat`/`head`/`tail`/`sed`/`tee` but not `cp`, so a lab's `cp` of `.env.local` still works.
- Hooks: `.claude/hooks/no-double-build.sh` blocks a production build only while a dev server runs
  **in the same checkout** (another session's server never blocks you);
  `.claude/hooks/warn-hardcoded.sh` warns when an edit writes TODO/FIXME/localhost/dummy/mockData into
  app code (labs and tests exempt). Both sabotage-tested (9 cases, see the PR's STATUS comment).
  Review fix (19 Nov): a dev server in a builder worktree under `.claude/worktrees/*` is another checkout
  and no longer blocks the main checkout's build (4 cases re-tested: main + nested server → allowed;
  the worktree's own server → blocked; main's own server → blocked; worktree vs main's server → allowed).
- Measured 19 Nov under the `Read(**/.env.*)` deny: `set -a; source .env.local; set +a` and
  `node --env-file=.env.local` still load the values; `cat` and the Read tool on the file are refused.
- `/audit` and `/verify-wiring` slash commands in `.claude/commands/` (report only).
- CLAUDE.md: "WIRING STANDARD — house rules" section (one source of truth, no backup folders, one
  `ActionButton`/input/modal, colour tokens only, folder homes, flat pages under 3 levels with no
  pass-through wrappers, clean `.next` before a production build, deliberate no-ops only). Brand line
  now names `lib/brand-*.ts` instead of saying the brand is scattered.
- `.gitignore`: allowlists those `.claude` files; `.env.*` and `.cache/` ignored.
- `docs/ARCHITECTURE.md`: DRAFT audit (5 tables + cleanup order). No application code changed.

SPEC IMPACT: None (repo tooling + docs only).
