## 2026-10-02 · feat(problems): every action that fails is recorded, traced and listed

Owner rule (DECISION_LOG 2026-10-02, "SPOT PROBLEMS BEFORE USERS REPORT THEM")
plus the same-day addenda (dead taps, rage taps, drop-off; the page is renamed
"Problems"). EXTENDS the Connection Logs skeleton — no second system.

- **Server, central.** `instrumentation.ts` `onRequestError` records every thrown
  error (server actions, route handlers, server components) with route, action
  `file#export`, digest and build SHA. The PostgREST fetch layer every server
  client rides (`lib/supabase/db-error-log.ts`) records refused writes/reads, a
  Supabase that never answered, and a TARGETED update/delete that matched no row
  ("saved" with nothing written). `logQueryError` records the non-PostgREST rest.
- **Browser, central.** One lazily-loaded observer (`lib/telemetry/fault-observer.ts`,
  its own async chunk, mounted at idle by `deferred-observability.tsx`) records a
  Server Action or /api call with no answer after 15 s, a returned `{ ok:false }`
  or `?error=` redirect, dead taps, rage taps, dead ends (not-found / forwarding
  stub / missing #section, with the page it came from), uncaught crashes, and
  step counts for four guided flows. Every error boundary reports through
  `lib/telemetry/report-crash.ts`; the upload watchdog reports a stall.
- **No row for a success** — only `app_action_daily_counts` counters, so a
  failure RATE can be shown.
- **Grouping.** `record_app_fault` (migration `20271260713505`) groups identical
  failures (kind + action/route + normalised message → md5 fingerprint) into one
  `app_fault_issues` row with count, first/last seen, today's count, build, and
  samples trace rows into `app_telemetry_logs`. Issues close themselves once a
  newer build is live and they are quiet for 48 h, and reopen on recurrence.
- **No personal data.** `scrubText` scrubs emails, phones, quoted values and
  names from every message; payload values now pass through it too.
- **Ingest** (`/api/telemetry/client-fault`, no new route) is now rate-limited
  per IP and per instance, and refuses forged server-only kinds.
- **The list.** Admin "Connection logs" is now **Problems** (nav, tab, title,
  masthead, search — old name kept as a search alias): one plain line per issue
  with the trace under it, most-hit first, plus "where people stop".
  `readFaultIssues()` is the server-only read for the controller.

SPEC IMPACT: None
