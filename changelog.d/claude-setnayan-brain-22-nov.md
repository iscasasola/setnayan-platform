## 2026-11-22 · chore(claude): the shared brain: lean CLAUDE.md, guardrails, think-and-build skill, controller brain, finish check, master brief

Owner, 22 Nov: *"I should NEVER have to manually tell you how a page should look or what other parts of the
website it connects to."* After a Stage 1 audit (three read-only passes over origin/main plus the corpus), he answered "Yes, all your picks".

- **`CLAUDE.md` rewritten short.** It covers the North Star, who does what (Fable designs and plans; Opus 5.5 builds and fixes), the canonical design system with paths, the master connection graph (entity → ONE reader → the pages it feeds), the hard rules, the locked decisions and the deploy surfaces.
- **`docs/HISTORY.md`.** The old 698-line CLAUDE.md moved here unchanged (`git mv`), with every trap and dated hand-over.
- **`.claude/rules/design-and-wiring.md`** (imported by CLAUDE.md). No page in isolation; every press real; shared numbers from one reader; the 18 Nov wiring standard carried over from #7984; the done-proof list.
- **`.claude/skills/think-and-build/SKILL.md`.** The four mandatory steps (discover, lock, build and wire, verify) and the Connection card every build starts with.
- **`docs/CONTROLLER_BRAIN.md`.** Trace, combine, split by files, brief, the migration-GO rule, the done gate and the reporting format.
- **`docs/SETNAYAN_MASTER_BRIEF.md`.** The portable single file to upload into Claude Chat. It replaces the untracked 19 Nov planning brief.
- **`.claude/hooks/finish-check.mjs`, a `Stop` hook.** It runs only when the session changed app code: the 9 house design lints, exactly as CI runs them (~15 s, no install needed), plus eslint on the changed files. It blocks the finish with the reason, and a passing state is remembered by content hash. The full typecheck (13 GB) and the build (8 GB) stay in `pnpm preflight` and CI. The owner declined running them on every finish because it would exhaust the 16 GB Mac.
- **`.gitignore`.** Unignores `.claude/rules/` and `.claude/skills/`.
- Builds on the owner's #7984 (wiring guardrails, `/audit`, `/verify-wiring`, `docs/ARCHITECTURE.md`); that branch is merged in.
- `the-public-media-host-is-one-fact.test.ts` reads the R2 bucket count from CLAUDE.md. The new file keeps "5 Cloudflare R2 buckets".

SPEC IMPACT: Setnayan-specs `DECISION_LOG.md` gains three 2026-11-22 rows (the brain and its 7 picks; Fable designs, Opus builds; the controller's calls on #8094, #8095 and #8087). `BUILD_RULES.md` §1 names the platform brain.
