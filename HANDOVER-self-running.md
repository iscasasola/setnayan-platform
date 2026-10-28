# HANDOVER: self-running safety kit (branch `claude/self-running-safety-kit`)

> **Delete this file before the PR leaves draft.** It is a WIP handover.
> The root `HANDOVER.md` belongs to a different build (`claude/chat-messenger-look`), which merged it onto main. Do not edit it here.

Paused 2026-10-29 at the controller's request because the Mac was overloaded and the account ends tonight.

## State

- Branch is cut from `origin/main` at `cd137db2ee`. `pnpm install` is done in `~/Documents/Claude/Projects/wt-self-running`.
- **No code has been written yet.** The Rule 0 survey and the design are complete and are below.
- Nothing was run: no server, no load test, no heavy-lock entry.

## Brief (owner, 29 Oct)

1. **Auto-degrade:** one central load level (`normal · busy · protect`), computed from the app's own DB samples, with hysteresis.
2. **Health tab** under Admin › Insights.
3. **Alerts:** phone push + ONE owner email, deduped per incident, with a "recovered" notice.
4. **Runbook:** corpus `RUNBOOK_TRAFFIC.md`.
5. **Load test:** localhost only, as an `sr-` script.

Re-read the full brief in the controller's builder prompt.

## Rule 0: what exists (all on origin/main)

| Need | Exists | Delta to build |
|---|---|---|
| Health signal | `lib/supabase/db-error-log.ts` `createLoggingFetch` is the ONE fetch wrapper for every Supabase client. It sees the status and duration of every PostgREST call. It has a globalThis sink pattern (`DB_FAULT_SINK`, installed by `instrumentation.ts` → `installProblemSinks`). `/api/health/deep` is a point-in-time probe. There is no per-request latency table. `app_load_timings` holds browser RUM only. | Add a `LOAD_SAMPLE_SINK` (a globalThis symbol) that times each `/rest/v1/` call. Install it from `instrumentation.ts`. Browser bundles get no sink, so they no-op. |
| Shared store | No Upstash, no KV, no Edge Config. `vercel.json` has `crons: []`, so the repo is **cron-free**: jobs ride `after()` through `lib/periodic-jobs.ts` `runClaimedJob` / `claim_periodic_job`. The `platform_settings` singleton is cached for 300 s by `rememberedGlobalRead` (`lib/global-settings-cache.ts`, the Next data cache, shared across instances). `runDetached` (`lib/telemetry/server-fault.ts`) runs a task in `after()`, or immediately when there is no request. | Add a NEW singleton table `platform_load_state` and an event log `platform_load_events`. Add a service-role RPC `apply_load_state`: it does a CAS on `version` and inserts an event row on every level change. Read the state through the data cache with a 15 s window. |
| Kill switches | The only one is `HUB_CACHE_DISABLED` (`lib/hub-view-route.ts`), and it turns caching OFF, which is the wrong direction. Flags are read through `lib/env-flag.ts`. `lib/flag-chokepoint-scan.test.ts` requires one module per `NEXT_PUBLIC_` flag. | The level is data, not a flag. Do NOT add a `NEXT_PUBLIC_` flag. |
| Live features | Shared timing helpers: `lib/live-day-timing.ts` (`jittered`, `herdDelay`), `lib/use-day-of-live-refresh.ts` (`useVisibleTick`, `useDayOfLiveTick`), `lib/use-event-pulse.ts` (`PULSE_POLL_MS` 12 s) and `lib/tab-return.ts`. In `tab-return.ts`, `startCountPoll` drives the badges every 60 s and **goes direct to Supabase**; `pauseWhileHidden` is also there. On the server, `lib/live-day-cache.ts` has `rememberedLiveRead` and `liveEdgeHeaders` (CDN 10 s). Guest phones hold **no sockets** (DECISION_LOG "NO EVENT HUB MAY CRASH"). | A client store plus a per-feature policy (see Design). |
| Health page | `/admin/app-performance` has 12 `?tab=` surfaces. The honest model to copy is `_surfaces/slow-loads-surface.tsx`, which uses `ConsoleTable`. `_components/health-now.tsx` is the deep-probe card. The admin route map is `lib/admin-tabs.ts` (Insights → `/admin/app-performance`). | A `health` tab with a new loader `_surfaces/health-surface.tsx`, a pure view, and `HealthNow` reused. A `/dev/health-lab` fixture page for screenshots, following `app/dev/billing-lab/page.tsx` (`notFound()` in production). **Never sign in to prod.** |
| Deploy vs main | `scripts/deploy-drift-doctor.mjs` is CLI/CI only. It exports the pure `classifyDeployDrift` and `pendingAgeSeconds`. `fetchProductionCommit` is not exported. | In the app, compare `VERCEL_GIT_COMMIT_SHA` with main using the GitHub compare API (public repo, cached 5 min). Take the repo from the `VERCEL_GIT_REPO_OWNER` / `VERCEL_GIT_REPO_SLUG` env; if either is missing, show "not measured". Port the classifier with a parity test that imports the `.mjs`. |
| Push | `lib/web-push.ts` has `sendWebPush(userId,{title,body,url,tag})` and `isWebPushConfigured()` (VAPID env). Admins opt in with `<PushToggle audience="admin">` in Admin › Settings › Notifications. ⚠ `public/sw.js` `notificationclick` ignores `url` and opens `/vendor-dashboard`; only `data.thread_id` routes, and `tag` is ignored. ⚠ Prod `push_subscriptions` had 0 rows on 2026-08-26. Whether VAPID is set is unknown. | Call `sendWebPush` directly for each admin; this bypasses the frozen `PUSH_ENABLED_TYPES`. Make a small `sw.js` fix so it honours the top-level `url` and `tag`, and check the sw version-bump guard. |
| Email | `lib/email.ts` has `sendEmail({to,subject,text,html,kind})`, which logs to `email_deliveries`. The owner's address comes from `getOwnerNotificationEmail()` in `lib/hiring-guide/emails.ts`: env `OWNER_NOTIFICATION_EMAIL`, with an existing fallback. Template: `renderBrandedEmail({... audience:'admin'})`. Precedent: `app/api/admin/smoke-test/route.ts`. | Send exactly ONE email per incident to that address, with `kind: 'load_incident'`. Do NOT touch `EMAIL_ENABLED_TYPES`; it is frozen by `the-email-allowlist-is-frozen.test.ts`. |
| In-app notice | `emitNotification` (`lib/notification-emit.ts`) sends to one recipient per call and does not dedupe. Notice kinds are a Postgres ENUM. A new kind needs its own `ALTER TYPE … ADD VALUE` migration (template: `20271235690341_notification_type_booking_fee_waived.sql`), plus the TS union and `NOTIFICATION_TYPE_LABEL` / `TONE` entries in `lib/notifications.ts` (checked by `every-notice-type-exists-in-the-database.test.ts`). The admin set is `users.or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin')`, as copied in `lib/order-admin-notify.ts`. | A new kind `platform_load_alert`, in-app only. |
| Capacity facts | Corpus `audits/event_day_load_2026-10-18/EVENT-DAY-LOAD-AUDIT-2026-10-18.md`: max_connections is 60, about 20 of 60 are used when idle, and the Realtime WAL poll costs more than 10× all other DB time. The Supabase plan was **free** per DECISION_LOG 2026-08-20; the owner said of the Pro upgrade "let's do on october", and nobody has verified it happened. The audit names the owner-only items: the anonymous sign-in rate limit, compute size and the Realtime quota. | Use these for the runbook's capacity table. |

## Design (decided, not built)

**Pure signal and stepper: `lib/load/load-signal.ts`**

- A 60 s ring-buffer window (capacity 2000) of `{ts, ms, ok, saturated}`.
- An error is a 5xx or a network failure. A 4xx (RLS denial or 404) is NOT a load error.
- Saturated means a 503, 504 or 429, or PGRST003 or 57014.
- A verdict needs at least 30 samples.
- Thresholds, anchored to existing budgets (cite them in code: `SESSION_CHECK_BUDGET_MS` = 2000 in `lib/supabase/session-budget.ts`, `READ_LIMIT_MS` in `lib/read-limit.ts`):

  | Level | p95 | Error rate | Saturations |
  |---|---|---|---|
  | protect | ≥ 2000 ms | ≥ 10 % | ≥ 5/min |
  | busy | ≥ 800 ms (check against `READ_LIMIT_MS`) | ≥ 2 % | ≥ 1 |

- Exit thresholds sit at about 70 % of the entry thresholds.
- `stepLoadState(state, verdict, now)`:
  - escalates immediately;
  - refreshes `held_at` while the verdict is at or above the current level;
  - steps down ONE level only after a cool-down measured from `held_at` (protect 5 min, busy 3 min).
- An incident opens on entry to protect. It alerts only if the last alert was 30 min or more ago; otherwise the alert is suppressed and logged.
- The incident closes when the level returns to normal, and a "recovered" notice is sent.

**Server: `lib/load/load-state.server.ts`**

- Keeps the window and the sink on globalThis.
- Evaluates at most once every 15 s per instance, through `runDetached`.
- Writes only in three cases:
  - a level transition;
  - a "still hot" refresh when the stored state is more than 30 s stale and the level is not normal;
  - a conditional 5-minute report.
- Reads the shared state through the data cache (15 s).
- Exports `currentLoadLevel()`, `loadHeaders()` (sets `x-sn-load`) and `optionalReadAllowed(key)`.

**Alerts: `load-alerts.server.ts`**

- A push to each admin, an in-app `platform_load_alert`, and one email to the owner.
- Only the instance whose CAS applied the transition sends them.

**Client store: `lib/load/live-load.ts` (no React) and `lib/load/use-load-level.ts`**

- Sources:
  - `noteLoadFrom(res)` reads the `x-sn-load` header off existing poll responses: `/[slug]/live-pulse`, `/api/live/run-of-show/[eventId]`, `/[slug]/announcement`, `/[slug]/live-wall`, `/api/wall/[eventId]/feed` and `/api/live/[slug]/watch`.
  - Fallback beacon `GET /api/load-level` (CDN `s-maxage` 15). It is asked only when no header has been seen for 120 s, the tab is visible and a registered feature is mounted. This covers the badges, chat and presence, which have no app-server poll.
- Exposes `liveDelay(key, ms)`, `livePaused(key)` and a tick-skip gate for `setInterval` sites.

**Registry: `lib/load/load-level.ts`, `LIVE_FEATURES`**

- busy: polls ×2.
- protect: polls ×4 (badges ×5), plus these switches:
  - `chat-stream` moves from Realtime to a 30 s poll of `fetchMessages`, visible tabs only.
  - Paused: `chat-typing`, `seating-presence` (the "who's here" widget), `plan3d-room` and `admin-connection-logs`.
  - The live-wall route answers `{paused:true}` (`optionalReadAllowed`).
- **Essential** (factor 1 always, enforced by a test):
  - check-in desk: `LiveRefresher` on `guests/checkin`, so give `useDayOfLiveTick` a `feature` param;
  - `vendor-payment-live`;
  - the run-of-show crew channel;
  - the `use-seating-lock` heartbeat;
  - Panood, call and demo WebRTC;
  - the Panood camera heartbeat;
  - chat send.
- Sign-in and the cached guest hub are untouched by design.

**Guard: `lib/load/every-live-feature-reads-the-load-level.test.ts`**

- Every non-test file under `app|lib|components` that contains `.channel(`, `setInterval(` or `jittered(` must either reference a registered key or appear in the exemption census with a reason. That is 70 files at `cd137db2ee`. Pure clock and animation timers go in the exemption census.
- The test prints its counts and requires them to be non-zero.
- Run a sabotage against it once.

## Exact next steps

1. Run `pnpm migration:new` twice.
   - First migration: `platform_load_state`, `platform_load_events` and `apply_load_state`. Enable RLS at CREATE: admin read on the `cron_job_runs` admin-read pattern, writes by service role only.
   - Second migration: the enum value `platform_load_alert`.
   - Add a db test under `apps/web/tests/db/`.
   - Fix the Ugat concept baseline or node.
   - Run `pnpm exposure:baseline` and check the `supabase/security` snapshots.
2. Write the pure modules and their tests, then the server modules. Wire the sink into `instrumentation.ts` and `db-error-log.ts`.
3. Wire the client sites listed above. Add the guard and run the sabotage.
4. Build the Health tab.
   - In `page.tsx`: add it to `TABS`, `TAB_STRIP` and `TAB_TITLE`, and give it a skeleton.
   - Build the surface on `ConsoleTable` and add it to `CONVERTED` in `app/admin/_components/admin-console-is-one-table.test.ts`.
   - Add `/dev/health-lab`.
   - Run `pnpm admin:map && pnpm admin:jobs`.
   - Regenerate `scripts/port-control-baseline.json` and run `check-ugat-screens.mjs`.
5. Fix `url`/`tag` handling in `sw.js` and run the service-worker version guard.
6. Write `apps/web/scripts/sr-load-test.ts`, localhost only.
   - A local HTTP server simulates a DB pool (N slots, fixed service time).
   - Concurrency ramps 5 → 50 → 200 → 5.
   - The real window and stepper print the level table.
7. Screenshot `/dev/health-lab` at 375 and 1280, in light and dark, into `~/Documents/Claude/Projects/shots-2026-10-29/self-running/`.
8. Write `RUNBOOK_TRAFFIC.md` in a corpus worktree off origin/main. Pull with `--rebase`, add only that file, and push.
9. Finish:
   - Add a changelog fragment.
   - Run all `apps/web/scripts/lint-*.mjs`, with tests run from `apps/web`.
   - Keep the PR a draft with the `do-not-auto-merge` label.
   - **Delete this file.**
