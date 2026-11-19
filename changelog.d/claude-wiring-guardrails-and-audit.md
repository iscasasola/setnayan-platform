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

- Review fixes (20 Nov, verdict FIX-FIRST):
  - The env deny no longer uses `Read(**/.env.*)`, which also hid the tracked `.env.example` files. It
    now names the real env files: `.env`, `.env.local`, `.env.*.local`, `.env.development`,
    `.env.production`, `.env.preview`, `.env.staging`, `.env.test`. No tracked file matches any of them
    (`git ls-files | grep -i env`).
  - `no-double-build.sh` now recognises every build form the repo uses — `pnpm --filter @setnayan/web
    build` (ci/e2e/lighthouse/release-rehearsal), `turbo run build` (root `build`), `next build`
    (apps/web `build`), with `-C`/`--dir`/`-F`/`-r` flags, `run`, `npx`/`pnpm exec`, env prefixes,
    `bash -c`, the heavy-lock `( … )` form and `\`-continued lines — and only at the start of a command
    segment, so `git commit -m "pnpm build"`, `pnpm tauri:build`, `pnpm rebuild` and
    `node scripts/check-build-budget.mjs` pass. Table: `.claude/hooks/no-double-build.test.sh` (58 cases).
  - `warn-hardcoded.sh` now only warns (owner ruling): it always exits 0 and prints the warning.
  - CLAUDE.md rule 5 no longer claims routes come from `lib/routes.ts` only: it is labelled
    NOBODY IS CHECKING, because the `scripts/lint-routes.mjs` guard `routes.ts` names does not exist.

SPEC IMPACT: None (repo tooling + docs only).
