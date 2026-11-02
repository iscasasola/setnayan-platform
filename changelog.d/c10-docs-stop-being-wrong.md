## 2026-08-30 · docs(c10): correct false/stale claims in our own notes, repo side

Session C10 ("our own notes stop being wrong"). Docs-only, no code. The repo-side
piece of a twelve-claim sweep across the repo and the spec corpus — see
`DECISION_LOG.md` (corpus) 2026-08-30 row for the full breakdown of all twelve.

- **`STATUS.md`** — "0 orders, ever" was FALSE: `select count(*) from orders` = 6
  (4 paid and receipted, most recent 2026-08-29). Corrected in place, since
  STATUS.md is a refreshed snapshot and this is exactly the case it exists for.

Verified against the live prod database via the Supabase MCP, not against any
document. Corpus-side corrections (11 files: `README.md`, `API_Integration_Checklist.md`,
`CLAUDE.md`, `Pricing.md`, three `WHAT_IS_LEFT*` registers, `WHATS_NEXT_INDEX.md`,
`WHATS_NEXT_Samahan_2026-08-24.md`, `DECISION_LOG.md`) were committed and pushed
directly to the corpus repo per the 2026-06-04 standing Cowork authorization —
not part of this PR.

SPEC IMPACT: None (this PR only corrects a stat in a repo-local status doc; the
spec-impacting corrections already landed in the corpus repo directly, per the
Cowork direct-edit authorization).
