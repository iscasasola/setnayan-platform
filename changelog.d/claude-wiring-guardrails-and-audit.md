## 2026-11-18 · chore(claude): wiring guardrails + draft architecture audit

- `.claude/settings.json` (now committed): deny reading `.env*` / `secrets/**` / `~/.ssh`, deny
  starting dev servers from Bash (use `preview_start`), ask before `build` and `git push`.
  Hooks: `.claude/hooks/no-double-build.sh` blocks a build while a dev server runs (16 GB Mac);
  `.claude/hooks/warn-hardcoded.sh` warns when an edit writes TODO/FIXME/localhost/dummy/mockData
  into app code (labs and tests exempt).
- `/audit` and `/verify-wiring` slash commands in `.claude/commands/`.
- CLAUDE.md: new "WIRING STANDARD" section (one source of truth, real folder homes, no hardcoding
  in UI, flat pages, deliberate no-ops only).
- `.gitignore`: allowlist the committed `.claude` files; `.env.*` (not just `.env.*.local`) and
  `.cache/` ignored.
- `docs/ARCHITECTURE.md`: DRAFT audit — no application code changed.

SPEC IMPACT: None (repo tooling + docs only).
