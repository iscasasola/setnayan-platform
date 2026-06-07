# TRACKING_STATUS.md

Status of the dual-track failure tracking work (branch `connlogs-wire-and-sentry`,
2026-06-07). Two tracks: **Sentry** (primary) + the **Connection Logs** Supabase
firehose (`app_telemetry_logs`) as an independent failback. This pass:
**fixed the real Sentry gaps**, **wired the failure firehose into 19 real call
sites**, and **added server-side PII redaction** to the firehose write path.

> ⚠️ **Important context:** the independent tracking table this task asked for
> **already shipped** to `origin/main` + production earlier today (2026-06-07) as
> the **Connection Logs** feature — table `app_telemetry_logs`, a `trackFailure()`
> helper, a service-role ingest route, and an `/admin/connection-logs` Realtime
> surface. Rather than build a second, near-duplicate `client_interaction_errors`
> table (which would have re-introduced the anon-writable design the team
> deliberately rejected), this work **reuses** that canonical substrate and
> completes its outstanding follow-up — wiring the call sites — per owner
> direction. See "Why no `client_interaction_errors` table" below.

---

## 1. What was blocking Sentry — and what actually got fixed

**The premise in the task ("partial configs throwing compilation errors", "bad
config wraps", "barebones manual init") did not match the code.** Sentry was not
throwing and was not half-wired — it's a deliberately LCP-optimized install.
"Cleaning it up" would have *regressed* working code. The real state + fixes:

### Already correct (left untouched)
- `apps/web/next.config.ts` correctly wrapped with `withSentryConfig(...)`.
- `instrumentation.ts` → `sentry.server.config.ts` + `sentry.edge.config.ts`, reading
  **`SENTRY_DSN`** (server-only), production-only.
- The **browser** SDK *is* initialized — by `app/_components/deferred-observability.tsx`
  (mounted in `app/providers.tsx`), reading **`NEXT_PUBLIC_SENTRY_DSN`** and lazy-loading
  the ~105 kB Sentry chunk after idle so it never hurts first paint. That's why there is
  no `sentry.client.config.ts` — its absence is intentional.
- Admin smoke-test exists: `POST /api/admin/sentry-smoke-test` (+ button in `/admin/settings`).

### The two real code gaps (now fixed)
1. **`app/global-error.tsx` never reported to Sentry.** The root-layout crash boundary
   showed a branded page saying *"We've logged the issue"* but only `console.error`'d in
   dev — it **never called `Sentry.captureException`** (Sentry does not auto-capture
   errors caught by a React error boundary). → Added a dynamic-import
   `Sentry.captureException(error, { tags: { boundary: 'global-error' } })` in its
   `useEffect`. No-ops safely when the DSN is unset.
2. **Error-replays configured but inert.** `deferred-observability.tsx` set
   `replaysOnErrorSampleRate: 1.0` but never registered `Sentry.replayIntegration()`, so
   no replay was recorded. → Added `integrations: [Sentry.replayIntegration()]` (in the
   deferred chunk, so LCP is unaffected).

### Most likely actual cause in prod: an unset env var (OPS, not code)
Both Sentry configs gate on `NODE_ENV === 'production'` **and** a DSN being present. If
the DSN vars aren't set in the Vercel **Production** environment, nothing reports — and
nothing reports locally by design. `OWNER_ACTIONS` #19e ("verify Sentry capture") is open.

**Owner env checklist (Vercel → Settings → Environment Variables → Production):**

| Var | Value | Why |
|---|---|---|
| `SENTRY_DSN` | the project DSN | Server / edge / server-action capture |
| `NEXT_PUBLIC_SENTRY_DSN` | the **same** DSN | Browser capture (`NEXT_PUBLIC_` so it's inlined into the client bundle at build) |
| `SENTRY_AUTH_TOKEN` | a Sentry auth token *(optional)* | Source-map upload for readable stack traces. Safe to leave unset. |

After setting them, redeploy → `POST /api/admin/sentry-smoke-test` (as admin) → confirm
the event lands in Sentry within ~60 s.

---

## 2. The independent Supabase failback (reused, now hardened)

The Sentry-agnostic firehose already exists and is live: **`app_telemetry_logs`**
(Connection Logs). This pass added the one thing it was missing for the RA 10173 posture.

- **Table:** `public.app_telemetry_logs` — `id`, `created_at`, `event_type`
  (`BUTTON_FAIL | SUPABASE_SAVE_ERROR | BLANK_FALLBACK | OTHER`), `element_name`,
  `file_path`, `error_message`, `payload_snapshot` (jsonb), `status`
  (`active | resolved | ignored`), `resolved_at`. **RLS admin-read only; service-role
  INSERT only (no anon-writable table).** Migration
  `supabase/migrations/20260902000000_app_telemetry_logs.sql` (already applied to prod).
- **Browser helper:** `apps/web/lib/telemetry/track-error.ts` → `trackFailure({...})`,
  which POSTs to `/api/telemetry/client-fault` (service-role insert via `insertFaultLog`).
- **Server helper:** `apps/web/lib/telemetry/fault-log.ts` → `insertFaultLog({...})` for
  server components / actions.
- **Admin surface:** `/admin/connection-logs` — live Realtime stream + resolve/ignore/auto-clear.
- **NEW — PII redaction (this pass):** `apps/web/lib/telemetry/redact.ts` →
  `redactPayload()`, now run inside `insertFaultLog()` — the single write chokepoint, so
  **every** fault row is PII-scrubbed before storage (keys that look like
  email / name / phone / token / secret / address / auth etc. are stripped; strings,
  depth, array length, and total size are capped). The ingest route previously stored
  `payload_snapshot` verbatim (size-capped only). This closes the RA 10173 "no PII in
  logs" gap.

### Reading the firehose
Use the admin UI at **`/admin/connection-logs`** (live), or SQL:
```sql
select created_at, event_type, element_name, file_path, error_message, payload_snapshot
from public.app_telemetry_logs
where status = 'active'
order by created_at desc
limit 100;

-- recurring failures in the last day, ranked:
select element_name, count(*), max(created_at) as last_seen
from public.app_telemetry_logs
where created_at > now() - interval '24 hours'
group by element_name order by count(*) desc;
```

---

## 3. Where it's wired (the "if-blank"/fallback sweep) — 19 sites, 13 files

`trackFailure()` (client) / `insertFaultLog()` (server) dropped into the real
failure-fallbacks across the core surfaces — catch blocks and silent backup branches
where a data load or user action could fail and currently degrade quietly. Before this
pass, **zero** call sites were wired (the substrate shipped, the instrumentation didn't).

- Shared chrome: `unread-bell-badge.tsx`, `unread-messages-badge.tsx`,
  `chat-message-stream.tsx`, `file-upload.tsx` (watermark fallback + presign failure)
- Dashboard: `event-date-input.tsx`, `vendor-availability-intersection.tsx`,
  `plan-card-compare.tsx` (lock failure + orphan-risk sibling cleanup)
- Wizard cards: `set-wedding-date-card.tsx`, `vendor-pick-grid-card.tsx` (search / lock /
  custom-save), `paperwork-card.tsx`, `create-schedule-card.tsx` (server-side seed
  fallback → `insertFaultLog`)
- Attire guide: `wedding-attire-guide.tsx` (save + reset)
- Onboarding: `onboarding-shell.tsx` (commit-plan rejection + router-push hard-nav fallback)

**Deliberately NOT instrumented** (to keep the firehose high-signal, not noisy): benign
`localStorage` try/catch (private-mode), date-parse fallbacks, `router.prefetch`
best-effort, `NEXT_REDIRECT` re-throw guards, and the server loader in
`vendor-dashboard/profile/page.tsx` (already logs to Sentry's Node hook).

---

## 4. How to wrap a future `<button>` so failures save to Supabase

The canonical helper takes an **object**:

```tsx
'use client';

import { trackFailure } from '@/lib/telemetry/track-error';

export function SaveProfileButton({ profile }: { profile: ProfileDraft }) {
  async function handleSave() {
    try {
      const res = await saveProfile(profile);            // your server action / fetch
      if (!res.ok) {
        // "if blank"/backup branch — the call came back wrong, not thrown:
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',                // BUTTON_FAIL | SUPABASE_SAVE_ERROR | BLANK_FALLBACK | OTHER
          elementName: 'Save Profile Button',
          filePath: 'components/ProfileForm.tsx',
          error: new Error(`saveProfile returned ${res.status}`),
          payload: { status: res.status, profileId: profile.id }, // ids/flags only — PII is stripped server-side
        });
        showRetryToast();
        return;
      }
      showSavedToast();
    } catch (err) {
      void trackFailure({
        eventType: 'BUTTON_FAIL',
        elementName: 'Save Profile Button',
        filePath: 'components/ProfileForm.tsx',
        error: err,
        payload: { profileId: profile.id },
      });
      showRetryToast();
    }
  }

  return <button type="button" onClick={handleSave}>Save profile</button>;
}
```

Rules of thumb:
- `void trackFailure({...})` is **fire-and-forget** — don't `await` it; it never throws and
  never blocks UX. It POSTs to the service-role ingest route (no anon DB write).
- Put **ids / counts / status codes / flags** in `payload`. The server now strips
  PII-shaped keys before storage, but keep payloads diagnostic on purpose.
- In a **server component / server action**, import `insertFaultLog` from
  `@/lib/telemetry/fault-log` instead (it's `server-only`) and `await` it — same fields,
  snake_case (`event_type`, `element_name`, `file_path`, `error_message`, `payload_snapshot`).
- It logs to Supabase **and** prints `🛑 [TELEMETRY CAPTURED]` to the dev console, so a
  fault is never fully silent.

---

## 5. Why no `client_interaction_errors` table

The task specified a new `client_interaction_errors` table + a `lib/track.ts` helper with
a direct anon `.insert()`. Mid-task it surfaced that the **Connection Logs** feature
(`app_telemetry_logs` + `lib/telemetry/trackFailure` + ingest route + admin surface)
**already landed on `origin/main` + prod today** — a richer superset that deliberately
uses a **service-role ingest route instead of an anon-writable table** ("Owner-confirmed
posture 2026-06-07"). Building the specced table would have created **two competing
error-telemetry systems** and re-introduced exactly the anon-`.insert()` surface the team
rejected. Per owner decision (2026-06-07), this work reuses the canonical substrate and
folds the one improvement the duplicate would have added — automatic PII redaction — into
the existing write path (§2). No `client_interaction_errors` table is created.
