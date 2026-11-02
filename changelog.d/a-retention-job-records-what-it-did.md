## 2026-09-15 · feat(jobs): a periodic job records what it DID, not just that it was claimed

`public.cron_job_runs` held exactly two columns — `job_key`, `last_run_at` — and
`claim_periodic_job()` stamped `last_run_at` at the instant of the CLAIM, before
the job body ran in the app. Every wrapper then ran the body inside
`try { … } catch { /* best-effort */ }`. **So a retention sweep that threw left a
FRESH timestamp and did not retry for a full week, and a silently failing
deletion job was byte-identical to a working one from every record we keep.**
`/privacy` promises deletions with dates on them under RA 10173 (face data at 3
months, full-res at 6, chat at 5 years); the only evidence any of them had
happened was a timestamp meaning "somebody was about to try".

Nothing in the app read that table either — not one page.

- Migration `20271229157398`: `started_at`, `finished_at`, `ok`, `rows_affected`,
  `error` on `cron_job_runs`; `claim_periodic_job()` opens a run (same
  single-winner compare-and-swap, same predicate, same signature, same grants);
  new service-role `finish_periodic_job()` closes it.
- `runClaimedJob(key, gap, body)` in `lib/periodic-jobs.ts` is now the only
  sanctioned way to run a periodic job — all 22 call sites converted. The catch
  that swallowed a failure now RECORDS it (`ok=false` + the message) and still
  never rethrows into the page render that fired it.
- `/admin/data-privacy` gains a **Deletions** tab: what each job did last time,
  with "started and never finished" and "failed" as their own visible states.
- `rows_affected = 0` is a first-class healthy outcome ("ran, nothing was due")
  and is deliberately distinguishable from NULL and from an unclosed run.
- ⛔ No freshness check, anywhere. These jobs fire on page traffic, not a timer,
  and several are correctly quiet for long stretches — a check that cries wolf on
  correct behaviour teaches everyone to ignore it. The property is
  **claimed ⇒ closed**, never claimed-on-time.

SPEC IMPACT: None. No promise, price, SKU or user-facing period changes; this
adds evidence that the existing promises are kept.
