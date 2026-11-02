## 2026-09-18 · test(guard): a Supabase call whose error is never read fails the build (LAU-31)

Supabase resolves with `{ error }`; it does not throw. So a call whose `error`
nobody reads fails silently, and a `try/catch` around it is dead code that looks
like handling. That is how LAU-30 shipped: the concierge abuse-flag insert
logged "insert failed" from a catch block that could never run.

- `apps/web/lib/supabase-unread-error-scan.ts` is the decision: a pure
  TypeScript-AST scan with no `server-only` and no fs. It flags `discarded`
  (a bare `await sb.from(…).insert(…)`), `discarded-in-try` (the LAU-30 shape),
  `never-awaited` (a lazy builder that never even sends), `write-error-dropped`
  (a write that keeps `data` but not `error`) and `error-unused` (`error` is
  destructured and never referenced). Out of scope, and documented as blind
  spots: data-only reads (the reads-are-honest guards cover those), results
  that escape (returned, passed on, `Promise.all`, `.then`), `.throwOnError()`
  and Storage.
- `apps/web/lib/a-database-error-is-never-ignored.test.ts` runs the decision
  over fixtures, including LAU-30 verbatim, and then sweeps `app/`, `lib/`,
  `components/` and `middleware.ts` against
  `lib/supabase-unread-error.baseline.txt`. Measured on the day: 3,849 files,
  5,939 Supabase calls, 550 inherited unread errors across 367 keys. Keys are
  `file · kind · table.op` plus a count, never a line number. A new key or a
  higher count fails the build. Paid-down entries are printed, not failed, so a
  fix merged by another PR can't turn `main` red. Floors on the number of files
  and calls stop an empty sweep from passing.
- Escape hatch for a truly best-effort write: `// supabase-error-ignored: <reason>`
  on the line above. The reason must be at least 12 characters.
- Sabotage-proven, and each of these went red: a new try-wrapped insert, a
  second violation under an existing key, a careless LAU-30 "fix" that keeps
  only `data`, the scanner going blind to discards, the scanner going blind to
  unused errors, and the sweep's roots narrowed.

LAU-30 itself is not fixed here. It sits in the baseline as
`concierge/actions.ts · discarded-in-try · concierge_abuse_flags.insert`, and
the PR that fixes it should lower that entry.

SPEC IMPACT: None.
