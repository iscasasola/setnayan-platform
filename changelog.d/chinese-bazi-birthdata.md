## 2026-06-28 · feat(weddings): BaZi birth-data capture (dark, flag-gated)

Opt-in, consent-gated, per-partner birth-DATE + TIME-OF-BIRTH capture for the
Chinese-wedding BaZi (Four Pillars) date-check, with full RA 10173 export +
deletion compliance. **Ships DARK** behind `NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED`
(default OFF). Only the *capture* (the details-form section + the write path) is
flag-gated — with the flag off the Personalization details form renders nothing
new and writes nothing, byte-identical to before. The RA 10173 *export* and
*erasure-purge* are deliberately always-on (own-data-only, RLS-safe): access and
right-to-erasure must land with the schema, not with the capture flag, so the new
columns are exported/purged whenever present regardless of the flag.

- **Migration** `20270311811312_events_partner_birth_data.sql` — adds
  `events.partner_a_birth_date` / `_time`, `partner_b_birth_date` / `_time`,
  and `bazi_birthdata_consent_at`, each with an RA 10173 purpose-limitation
  `COMMENT` (sensitive; birth time must never render publicly). No new RLS
  policy — existing `events` couple/admin policies (`current_event_ids` /
  `couple_can_update_event`) already cover the columns.
- **Flag helper** `apps/web/lib/bazi-birthdata.ts` (mirrors `experience-quiz.ts`):
  `baziBirthDataEnabled()`, default OFF (accepts `'true'`/`'1'`/`'on'`).
- **Triple gate to render or write:** flag ON **AND** `isChineseWedding(event)`
  **AND** an explicit consent checkbox ticked. Birth fields are never written
  without a fresh `bazi_birthdata_consent_at` stamp; unticking consent purges
  the stored data. The server re-checks the flag + the *stored* ceremony (never
  trusts the client) and validates date (`YYYY-MM-DD`) / time (`HH:MM`).
- **Never a verdict.** No compatibility/score computation anywhere — the
  details section and the `/paperwork` BaZi card stay advisory and route to the
  `date_fengshui_consultant` vendor leaf (`/explore?category=date_fengshui_consultant`).
- **RA 10173 export** (`app/api/profile/export/route.ts`) now includes the birth
  fields + consent for events the user OWNS (`member_type='couple'`) — events
  were previously under-exported vs `users`.
- **RA 10173 deletion** (`app/admin/users/actions.ts`) now NULLs the 5 birth
  columns on owned events before `deleteUser` / `blacklistUser` hard-delete —
  closing the right-to-erasure gap where event-level birth data survived a user
  hard-delete (events have no owner FK).
- **No public leak:** the new columns are read back only on the couple-dashboard
  Personalization surface; excluded from every public/guest events select.

**DPO sign-off REQUIRED before flipping the flag** — purpose notice, retention,
and consent copy must be reviewed before any couple-facing capture goes live.

SPEC IMPACT: None (dark ship; no public surface or pricing change). Decision
lineage: Chinese_Wedding_Traditions_Reference_2026-06-28 §2.3 (advisory-only,
never a clash verdict) + §2.4 (per-partner birth date/time for the delegated
date-check). When the flag is flipped, log the go-live + DPO sign-off at the
bottom of `DECISION_LOG.md`.
