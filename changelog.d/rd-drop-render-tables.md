## 2026-10-26 · chore(mood-board): drop the retired render schema — tables, RPCs, the inspiration-asset render provenance

Owner, 2026-10-26 ("Yes to all"): drop the Mood Board render schema that rd/retire-mood-board-renders (#6938) left in
place, erasing its two rows (both on the owner's own event: a free `consent_bonus` credit and a withdrawn share consent).

- **Migration `20271289858095_drop_retired_mood_board_render_schema`** (IF EXISTS throughout, dependency order):
  · `event_inspiration_assets`: drops `event_inspiration_assets_render_pick_has_provenance`, the
    `source_render_id` FK → `event_renders`, the `source_render_id` column, and re-lists `source_kind` as
    `_check_v5` without `'render_pick'` (prod: 0 rows with a render id, 0 `render_pick` rows);
  · functions: `moodboard_begin/finish/fail_render`, `moodboard_reserve/release_render_credits`,
    `moodboard_render_balance`, `moodboard_render_caller_may_act/_view`, `moodboard_set_share_consent`,
    `moodboard_set_render_featured`, `moodboard_set_render_reuse_blocked`, `moodboard_admin_all_renders`,
    `moodboard_attach_gallery_copy`, `moodboard_inspiration_pool`;
  · tables: `event_render_credit_usage`, `event_render_credit_grants`, `event_render_share_consent`,
    `event_renders`, `moodboard_render_config` (their RLS policies go with them).
- Measured before dropping (prod pg_proc / pg_policies / pg_views / FKs / triggers / cron.job, read-only, and the
  PGlite replay): nothing live used them. The only other mentions were the FK above and a COMMENT inside
  `colour_access_caller_is_couple` naming `moodboard_render_caller_may_act` (not a call). No app code calls any.
- Removed: the RA 10173 export readers (`own_renders_requested`, `own_share_consents_given`) and their
  subject-scope pins; the two erasure-coverage rows; the five render db tests; the Ugat `TYPE-RENDERS` node, its
  three joints and claims, its count and colour; the two `event_inspiration_assets` render claims (now a
  `no_column source_render_id` claim, `source_kind_check_v5`); the 10 `rpc-no-caller` both-ends rows (51 → 41).
- Regenerated: exposure baseline (removals only, 6776 → 6706 facts), user-FK behaviour map (242 → 239).
- Kept: `MOODBOARD_RENDER_PACK` catalogue row (inactive since #6938; an order row may name it) and
  `lib/moodboard-render-parts.ts` (its part ids are still the finalization vocabulary).

SPEC IMPACT: DECISION_LOG row "MOOD BOARD RENDER SCHEMA DROPPED" (Setnayan-specs) — the retirement row said the schema
was kept pending an owner call; that call is now made.
