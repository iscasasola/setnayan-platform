## 2026-08-09 · fix(patiktok): delete the dead render worker that faked a finished reel

`app/api/internal/patiktok/process-job/route.ts` was a stub queue-drainer. It claimed the
oldest `queued` row in `patiktok_render_jobs`, slept 100ms, then wrote
`status='completed'` with a hardcoded placeholder `output_url`
(`r2://patiktok-renders/_pending/please-replace-with-real-output.mp4`). It was deployed and
secret-gated, so anything that ever reached it would have told a couple their reel was
finished while pointing at a file that does not exist — and the job could never be re-run,
because it was no longer `queued`.

**Proved unreachable before deleting** (no live caller found on any of these):
- no import, no `fetch`, no dynamic `import()` by string — the only reference to the path
  anywhere in `apps/web` was its own registry entry in `lib/routes.ts` and one stale comment
- `apps/web/vercel.json` ships `"crons": []`
- no `cron.schedule` / `net.http_post` in `supabase/migrations/` names it (the two scheduled
  jobs that exist are the quarterly BIR 2307 generator and the notify webhook)
- no GitHub workflow mentions patiktok
- `app/api/CONSUMER_INVENTORY.md` named a consumer at
  `app/dashboard/[eventId]/add-ons/patiktok/actions.ts` — **that path does not exist**; the
  inventory row was wrong and is removed

The real render runs in the guest's browser (WebCodecs / MediaRecorder), uploads to R2, and is
closed out by `finalizePatiktokRenderJob`, which derives the output object key server-side from
the job row.

### Changed
- **Deleted** `apps/web/app/api/internal/patiktok/process-job/route.ts` (the whole
  `app/api/internal/` tree is now empty and gone).
- `apps/web/lib/routes.ts` — removed the `api.internal.patiktok.processJob` builder.
- `apps/web/app/dashboard/[eventId]/studio/patiktok/actions.ts` — **comment only**: the header
  pointed at the deleted file as "the worker seam"; it now records that there is deliberately no
  server-side drainer and names the guard.
- `apps/web/CONNECTION_MATRIX.md`, `apps/web/app/api/CONSUMER_INVENTORY.md`,
  `OWNER_ACTIONS.md` — inventory rows corrected. `INTERNAL_WORKER_SECRET` is still required:
  `/api/telemetry/auto-resolve` uses it.

### Guard — `apps/web/lib/patiktok-render-completion-writer.test.ts` (6 assertions)
Source scan, comments stripped before matching (a whole-file grep would have matched the
comment explaining the bug and passed forever on its own justification). Asserts: the scan
actually reaches the tree (>500 files, so a silent zero can't read as a pass) · no
`app/api/internal/patiktok` directory · no `internal/patiktok` in the route registry ·
**exactly one** file in `app`/`lib`/`components` writes `status: 'completed'` within a
`.from('patiktok_render_jobs')` chain · that file still exports `finalizePatiktokRenderJob(`
and still persists the server-derived `output_object_key` · no shipped code carries a
placeholder render output.

Mutation-tested (baseline 7153 tests, 0 fail):

| sabotage | result |
|---|---|
| restore the deleted route file verbatim | 3 of 6 red |
| add a differently-shaped drainer at `lib/tmp-mutation-drain.ts` (no placeholder string, not under `api/`) | 1 red (the completion-writer allowlist) |
| restore the `processJob` line in `lib/routes.ts` | 1 red |
| decoy file with all the banned strings **in comments only** | stays green — confirms scoping |
| rename `finalizePatiktokRenderJob` → `…RENAMED` | **passed at first — prefix match.** Assertion re-anchored on the opening paren, then red |
| write `output_object_key: input.key` (launder the client key) | 1 red |

SPEC IMPACT: None. No product, pricing or scope change — Patiktok already rendered
client-side; this removes a server path that could only ever corrupt a job.
