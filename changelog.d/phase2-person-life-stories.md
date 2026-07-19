## 2026-07-05 · feat(person-spine): Phase 2 life stories — multi-home event media into participants' archives (STAGED / flag-off)

Person-spine Phase 2 "life stories": a shared event photo / 5s clip / editorial
multi-homes into EVERY participant's own lifelong archive (their claimed person
node), not just the host's gallery — so you accumulate a story from events you
only attended. Extends Papic per-guest delivery + galleries + editorial.

⚠ COUNSEL-GATED / STAGED. New feature flag `NEXT_PUBLIC_PERSON_LIFE_STORIES`
defaults OFF (mirrors `peopleConnectionsEnabled()` / PR #2823). Every read,
mutation, and assembly action is inert in production and stores/surfaces NO
cross-event participant media until PH counsel signs off and the owner flips the
flag. Do NOT flip it on.

Shipped:
- Migration `20270515309755_phase2_person_life_story_items_schema.sql` —
  `public.person_story_items`: an empty, additive, deny-by-default,
  participant-scoped table (RLS at create time; policy mirrors
  `person_connections` — `is_admin()` OR the account claiming the person via
  `people.claimed_by_user_id = auth.uid()`). Validated in a rolled-back prod
  transaction (Supabase MCP) with DO-block asserts, incl. that face-derived
  `auto_face` origin, editorial-without-consent, kind/source mismatch, and
  duplicate multi-homing are all REJECTED; post-rollback SELECT confirmed
  nothing persisted.
- Hard constraints baked into the schema + read model:
  · assembled from TAGS + QR + CONFIRMED IDENTITY only — NO cross-event face
    recognition (`origin` has no face value; `auto_face` tags skipped);
  · REFERENCES not copies — soft ref (`source_table` + `source_id`) into the R2
    system of record, no media duplicated;
  · a participant can HIDE any item from THEIR story (`hidden_at`, per-person)
    without affecting the host gallery;
  · opt-out / face-blur REMOVE the person (`removed_at` tombstone);
  · editorials propagate only on host publish + the existing consented-guest
    gate (`origin='editorial_publish'` rows require `consented_at`, enforced by
    a CHECK);
  · adults-first.
- `apps/web/lib/person-life-stories.ts` — flag + read-model types/helpers.
- `apps/web/app/dashboard/(account)/people/life-stories.ts` — server actions:
  read my story, hide/unhide (per-person), event opt-out, and the flag-gated
  host-side assembly (multi-home Papic items via tags; propagate published
  editorial to consented persons). Idempotent via the unique index.

Deferred (out of scope, correctly): the participant-facing "Living" story UI (a
big unverifiable client surface, flag-off) and wiring the assembly calls into the
live Papic capture/publish pipelines — both belong with the counsel review.

SPEC IMPACT: None (spec already anticipates this — People_Graph_and_Lifelong_
Identity_2026-07-04.md §9 "Living" page state + §12 "Life stories" row).
