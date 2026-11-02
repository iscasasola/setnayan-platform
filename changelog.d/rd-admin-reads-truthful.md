## 2026-10-01 · fix(admin): admin reads tell the truth — no all-clear, empty or Save over a failed read

Step 5, PR 1 of the 2026-09-30 admin audit (stacked on #6212). A refused
Supabase read resolves with `{ error }`, so `?? []` / `?? 0` / a FALLBACK made
the screen state an absence — or seed a form — from a read that never happened.

- **`/admin/work`** — a queue whose count couldn't be read no longer folds into
  "All queues clear."; the page says "N queues couldn't be read — refresh to try
  again" and the row says "Couldn't count this queue".
- **Overview** — the headline shows "—" instead of "0 items need you" when any
  actionable queue went uncounted; the cleared-queues ring shows "—"; a refused
  activity read is no longer "No admin actions logged yet."
- **Numbers › Connection logs** — a refused read is no longer "All clear"; the
  notice replaces the surface.
- **Music Maker queue** — a refused orders (or events) read now sets the error,
  so paid orders can't vanish behind "No Music Maker orders yet."
- **Studio › Social queue** — every section (take-downs, scheduled, failed,
  published, consents, suppliers, greetings) carries its own `loadFailed`
  (required on the type) and shows "—" + "Couldn't load this" instead of its
  empty line.
- **Forms that could Save defaults over real data** — Event type › Profile
  (Save disabled), Event type › Onboarding (editor not mounted), Budget Planner
  engine settings (Save disabled), Ugat › Onboarding music (now reads
  `fetchPlatformSettingsMeasured`, Save disabled), Integrations (notice replaces
  the forms), Secrets (unread presence reads "Unknown from here"; unread rotation
  dates replace the alarm/all-clear banner). New
  `getSecretPresenceMapMeasured()` in `lib/integration-config.ts`.
- Guard: `apps/web/lib/admin-reads-are-truthful.test.ts` (16 sabotages, all red).

SPEC IMPACT: None
