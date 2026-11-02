## 2026-06-28 · feat(editorial): provision a draft editorial for every event

Owner intent ("each event created will have an editorial"). Materialize a draft `event_editorial` row at event-creation time so each event is a tracked, ready-to-publish story object — the enabler (PR1 of 2) for a dashboard "publish my story / feature in Real Stories" flow (PR2).

- New `public.seed_event_editorial()` trigger function (SECURITY DEFINER, `search_path=public`, exception-guarded) + `on_event_created_seed_editorial` AFTER INSERT trigger on `public.events`. Covers every creation path (dashboard, onboarding, anon-draft commit, seeds). Inserts `(event_id, status='draft', draft_json='{}')` with `ON CONFLICT (event_id) DO NOTHING`.
- Backfill: every existing event without an editorial row gets a draft one (58 of 59 events were missing one in prod at ship time).
- `draft_json` intentionally seeded EMPTY: the compose engine auto-writes headline/deck/etc. from `events.love_story` and prefers `draft_json` keys only when the couple sets them, so seeding text would freeze stale overrides. The row holds the draft→published flag + (later) frozen impact metrics; the public editorial keeps composing live regardless.
- Resilient: seeding faults can never abort event creation (editorial is non-critical to an event existing).

No app-code change in this PR — the public editorial already renders for every event with or without a row; this makes the row exist so it can be published/shared. Verified via a rolled-back dry-run against prod (function + trigger create cleanly; backfill yields exactly the 58 missing rows).

Migration: `20270316888459_provision_event_editorial_on_create.sql` — needs `supabase db push` (not auto-applied on merge).

SPEC IMPACT: None on locked scope. Logged as a DECISION_LOG row (2026-06-28) in the corpus: editorial is now provisioned per-event at creation; publishing + Real Stories inclusion stay gated on couple action + RA 10173 showcase consent (unchanged).
