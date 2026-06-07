# Connection Logs — Admin Fault Tracker Guide

A real-time, operator-facing dashboard that captures **front-end faults** — broken buttons, failed Supabase saves, and blank fallbacks — and lets you resolve them as you fix them. Live at **`/admin/connection-logs`**.

> **How this differs from what we already run**
> - **Sentry** (iteration 0035) — engineer-facing error monitor. Stack traces, releases, alerting. Stays the primary tool for deep debugging.
> - **`telemetry_events`** + `/admin/telemetry` (V2 Phase E) — *backend service* checkpoints (Papic / Panood / etc.).
> - **Connection Logs** (this) — *front-end* faults surfaced to an **operator**, with an **auto-clearing resolve lifecycle**. Owner-confirmed as a standalone surface (2026-06-07).

---

## 1. Where everything lives

| Piece | Path |
|---|---|
| **Tracking utility** (client-safe) — `trackFailure()` | `apps/web/lib/telemetry/track-error.ts` |
| Server write helpers — `insertFaultLog()`, `resolveFaultsByFilePath()`, `coerceEventType()` | `apps/web/lib/telemetry/fault-log.ts` *(server-only)* |
| **Dashboard page** (server component, privileged read) | `apps/web/app/admin/connection-logs/page.tsx` |
| Dashboard island (tabs · filters · Realtime · modal · controls) | `apps/web/app/admin/connection-logs/connection-logs-client.tsx` |
| Admin mutations (resolve / ignore / bulk archive) | `apps/web/app/admin/connection-logs/actions.ts` |
| **Ingest endpoint** (public, service-role insert) | `apps/web/app/api/telemetry/client-fault/route.ts` |
| **Auto-resolve endpoint** (code-level auto-clear) | `apps/web/app/api/telemetry/auto-resolve/route.ts` |
| Database table + RLS + Realtime | `supabase/migrations/20260902000000_app_telemetry_logs.sql` |
| Sidebar entry | `apps/web/app/admin/_components/admin-sidebar.tsx` (Insights group) |

**Table `public.app_telemetry_logs`:** `id` · `created_at` · `event_type` (`BUTTON_FAIL` \| `SUPABASE_SAVE_ERROR` \| `BLANK_FALLBACK` \| `OTHER`) · `element_name` · `file_path` · `error_message` · `payload_snapshot` (jsonb) · `status` (`active` \| `resolved` \| `ignored`) · `resolved_at`.

### Architecture (and why)

```
 Browser (any page, even logged-out)
   trackFailure({...})                       ← lib/telemetry/track-error.ts
        │  POST /api/telemetry/client-fault  (no anon DB write — see below)
        ▼
 Route handler  → insertFaultLog()           ← service-role insert, validated + size-capped
        ▼
 public.app_telemetry_logs  (RLS: admin-read only)
        │  Supabase Realtime (honors RLS)
        ▼
 /admin/connection-logs  → live stream, resolve, archive
```

**Why not a direct browser `.insert()`?** That would require an anon-writable table — a spam / DoS / jsonb-injection surface. We insert via the **service-role key** behind a thin endpoint instead (matching the existing `lib/telemetry/insert.ts` posture). Same behavior — faults are captured from public pages — but the table is never anon-writable. Owner-confirmed (2026-06-07).

---

## 2. Wiring `trackFailure()` into your code

Import the helper anywhere (client components, event handlers, `catch` blocks):

```ts
import { trackFailure } from '@/lib/telemetry/track-error';
```

`trackFailure` **never throws and never blocks UX**. In development it also logs `🛑 [TELEMETRY CAPTURED]: <eventType> <elementName>` to the console.

### a) Wrapping a button click (`BUTTON_FAIL`)

```tsx
<button
  onClick={async () => {
    try {
      await submitRegistration();
    } catch (error) {
      void trackFailure({
        eventType: 'BUTTON_FAIL',
        elementName: 'Submit Registration Form',
        filePath: 'app/(auth)/register/register-form.tsx',
        error,
        payload: { email, plan },          // localized vars at failure
      });
      // ...still show the user a friendly error
    }
  }}
>
  Create account
</button>
```

### b) Wrapping a Supabase write (`SUPABASE_SAVE_ERROR`)

```ts
const { error } = await supabase.from('events').update(patch).eq('event_id', eventId);
if (error) {
  void trackFailure({
    eventType: 'SUPABASE_SAVE_ERROR',
    elementName: 'Save event details',
    filePath: 'app/dashboard/[eventId]/settings/settings-form.tsx',
    error,
    payload: { eventId, patch },
  });
}
```

### c) Flagging a blank / fallback render (`BLANK_FALLBACK`)

```tsx
if (!data || data.length === 0) {
  void trackFailure({
    eventType: 'BLANK_FALLBACK',
    elementName: 'Vendor shortlist',
    filePath: 'app/dashboard/[eventId]/vendors/plan-budget-accordion.tsx',
    payload: { eventId, reason: 'empty after fetch' },
  });
  return <EmptyShortlist />;
}
```

### d) Server-side faults

`trackFailure` is the **browser** path (it `fetch`es the ingest endpoint). On the server, prefer `Sentry.captureException(err, { tags })` — already wired — or call the server helper directly:

```ts
import { insertFaultLog } from '@/lib/telemetry/fault-log'; // server-only
await insertFaultLog({ event_type: 'SUPABASE_SAVE_ERROR', file_path: '…', error_message: '…' });
```

---

## 3. Clearing faults

- **Per row** — `Resolve` (real fix) or `Ignore` (archive without claiming a fix) on each active row. Optimistic UI; reconciled by Realtime.
- **Bulk** — `Archive all active` at the top sweeps every active row (or just the current filter's rows when a filter pill is selected).
- **Code-level auto-clear** — when you fix a bug locally, sweep its faults in one call:

```bash
curl -X POST "$SITE_URL/api/telemetry/auto-resolve" \
  -H "content-type: application/json" \
  -H "x-internal-worker-secret: $INTERNAL_WORKER_SECRET" \
  -d '{ "file_path": "app/(auth)/register/register-form.tsx" }'
```

This flips every **active** row whose `file_path` matches to `resolved`. The endpoint accepts **either** the `x-internal-worker-secret` header (local/CI/scripted) **or** a logged-in admin session.

> Tip: drop the curl into a `postfix` step of your local fix workflow, keyed to the file you just changed, so the Active tab self-cleans as you ship fixes.

---

## 4. Securing the `/admin/connection-logs` route

It reuses our **existing** admin auth — no new pattern.

1. **Route guard (already covers it).** Every page under `apps/web/app/admin/` is gated by `apps/web/app/admin/layout.tsx`, which redirects unauthenticated users to login and `notFound()`s anyone who isn't an admin:

   ```ts
   const isAdmin = profile?.is_internal || profile?.is_team_member || profile?.account_type === 'admin';
   if (!isAdmin) notFound();
   ```

   Placing the page at `app/admin/connection-logs/` is all that's needed for the UI gate.

2. **Row-Level Security.** `app_telemetry_logs` has RLS enabled at `CREATE TABLE` time. `SELECT` + `UPDATE` are limited to that **same admin set** (`account_type='admin'` OR `is_internal` OR `is_team_member`). Because Supabase Realtime honors RLS, only admins receive the live stream. There is **no** `INSERT`/`DELETE` policy — only the service-role key writes (the ingest endpoint).

3. **Server actions re-check.** Server actions are independent POST endpoints the layout does **not** cover, so `actions.ts` re-verifies the caller is an admin (`assertAdmin()`) before any mutation. The `auto-resolve` endpoint is likewise gated (worker secret **or** admin session).

### Required env vars

| Var | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service-role insert / resolve (already set platform-wide) |
| `INTERNAL_WORKER_SECRET` | `auto-resolve` header gate (already used by `lib/telemetry/insert.ts`) |

### Applying the migration

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```
