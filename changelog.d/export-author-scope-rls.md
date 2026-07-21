## 2026-07-21 · fix(privacy): RA 10173 export — author-scoped reads returned EMPTY under RLS

Fix-forward on PR #3467, which added `event_vendor_working_notes` +
`coordinator_broadcasts` to the data-subject export at
`apps/web/app/api/profile/export/route.ts`. Two adversarial reviewers returned
FLAWED; all four defects verified against the migrations and fixed here.

**1 · The author-scoped reads could return EMPTY for a legitimate subject.**
Both reads ran under RLS via the anon session client, and neither table grants
an author/sender SELECT:
- `20270825279091` gives `event_vendor_working_notes` only `evwn_moderator_select`
  (`current_moderator_event_ids`) and `evwn_couple_select`
  (`current_couple_event_ids AND visibility='shared'`). Its only author-keyed
  policy, `evwn_author_delete`, is a DELETE policy — a filter is not a grant.
- `20270825364600` gives `coordinator_broadcasts` only `current_event_ids()`
  (event_members) and `current_moderator_event_ids()`. No sender policy at all.

`removeHost` stamps `event_moderators.removed_at` **and** deletes the
`event_members` row, closing both grants at once — so a departed coordinator,
precisely the person most likely to file a subject-access request, read zero
rows from both tables and received a file asserting they had written nothing.

Both reads now use the service-role client with a hard `.eq(author_user_id |
sender_user_id, user.id)` filter. The route carries a bounded-bypass block
naming the four properties that make it safe (server-verified `user.id` from
`auth.getUser()` with no request input on this route · the filter column IS the
identity · two tables, fixed projection, no joins · read-only) and stating that
loosening any of them means removing the pattern, not extending it.

**2 · Silent-empty was undetectable to the subject.** Every read on the route now
goes through the new `lib/export-integrity.ts` instead of `?? []`. A failed or
un-attempted read becomes a NAMED line in `not_included` and flips a new
top-level `export_complete: false`. Error text is capped so a DB error can never
echo another party's row content into a subject-access file.

**3 · A `not_included` rationale was factually false.** It claimed "no user-scoped
access-log table in V1" while `20270212405352` creates `admin_data_access_log`
with an `accessed_user_id` column and an index its own comment labels
"(subject-access)". Split into two true statements: the API-access log genuinely
does not exist (0033 ships `api_keys` only), and `admin_data_access_log` DOES
exist, IS keyed to the subject, and is available from the DPO — withheld from the
file only because each row also names the admin who looked.

**4 · The guardrail under-detected subjects.** `lib/export-coverage-guardrail.test.ts`:
- Added a second, name-independent signal — any column with
  `REFERENCES public.users(user_id)`. Parsing switched from line-oriented to
  segment-oriented (top-level comma split) so a wrapped REFERENCES clause is
  seen. This is what finally makes `marketing_share_consents.customer_id`
  visible — a table the export already reads but the guardrail could not see.
- Removed `accessed_user_id` and `target_user_id` from `STAFF_ACTOR`. The
  docblock rationale ("an operator acting in role") is true for the `*_by_user_id`
  names and FALSE for those two — there the subject IS the target. Measured
  fallout: 3 tables, not 11.
- New T7 (heuristic sees non-`*_user_id` subject columns), T8 (the false
  access-log claim stays corrected), T9 (no bare `?? []` unwrap returns on the
  route).

**5 · Second pass — three adversarial reviewers returned not-SOUND on the above.**
All MUST FIXes addressed:
- **The parser rewrite silently DE-ENFORCED two tables.** Switching to a
  segment split fixed wrapped `REFERENCES` clauses but stripped only whole
  comment LINES, so a comma inside a *trailing* `--` comment split the segment
  and swallowed the next real column. 161 columns across 55 tables went
  undetected; `people` and `vendor_meetings` fell OUT of the enforced tier while
  still counting toward the ceiling — the exact "silently under-detects →
  manufactures false confidence" failure this file exists to prevent, shipped
  inside the fix for it. Comments are now stripped to end of line.
- **`STAFF_ACTOR_FK` is DELETED, not narrowed.** Its blanket `.*_by` alternative
  suppressed 22 tables wholesale, including `event_journey_steps.completed_by`
  (the couple member who completed a planning step) and
  `event_preparation_items.created_by` — genuine subject data with no
  `*_user_id` column, hence invisible, unexported and unclassified. A regex
  cannot decide this: `created_by` is an admin on `platform_expenses` and a data
  subject on `event_preparation_items`. The FK signal is now unfiltered, and all
  23 tables it pulls in are answered BY NAME (21 `DELIBERATE_EXCLUSIONS`, each
  checked column-by-column against its migration; 2 `KNOWN_GAPS`).
- **The dev-only anon-key fallback re-created the silent empty.**
  `lib/supabase/admin.ts` swaps in `NEXT_PUBLIC_SUPABASE_ANON_KEY` when the
  service key is unset under `NODE_ENV==='development'` — construction SUCCEEDS,
  the try/catch never fires, the read runs with `auth.uid()` NULL, RLS returns
  zero rows with `error` null, and the file ships `export_complete: true`. Prod
  threw correctly, so this was never a production data defect, but it was live on
  the one surface anyone would use to hand-verify the fix. The route now gates on
  `process.env.SUPABASE_SERVICE_ROLE_KEY` being present; the comment that claimed
  "we do NOT silently fall back" is rewritten to describe what actually happens.
- **The core fix had NO test teeth.** Mutation testing showed both privileged
  reads could be reverted to the RLS session client — restoring the original bug
  verbatim — with 19/19 green and `tsc` clean. New **T11** asserts each table is
  read from `admin` and NOT from `supabase`, that the filter is
  `.eq(<author col>, user.id)`, and that the service-role key is gated on.
- **New T10** asserts every classified table is still IN SCOPE — the reverse of
  T3. Nothing previously caught "classified but the DETECTOR stopped seeing it",
  which is how `people` and `vendor_meetings` went unguarded while green.
- T9 hardened: the `?? []` detector no longer keys off the `*Res` naming
  convention (the route's own original offender was `mediaRows ?? []`, which it
  could never have caught), and the completeness assertion matches the FIELD
  rather than the bare identifier, which also appears in three comments.
- Corrected claims: `editorial_vendor_media.created_by` was stated to be caught
  by the widening — `STAFF_ACTOR_FK` killed it; it is in scope now. The docblock
  count "36 columns on 25 tables, 22 pure operator stamps" was wrong in both the
  number and its stated meaning. Re-measured: **344 tables · 135 in the enforced
  tier · 37 FK-to-users columns the name regex misses on 35 tables, 25 of them
  invisible to the name regex alone · 87 second-tier (`event_id`-only)**. The
  residual blind spot the FK signal cannot see (a bare `UUID`, or an FK added by
  `ALTER TABLE … ADD CONSTRAINT`) is now stated in the docblock, and T10 asserts
  the class of narrowing that hid it can never ship green again.
- `KNOWN_GAP_CEILING` 82 → **87**, in two argued steps, with the incomplete
  first justification corrected inline: the original 82 → 85 was argued on "no
  new gap was created" while the same commit de-enforced two pre-existing ones.

Red-before/green-after, second pass (each mutation run against the real module,
worktree restored after every one):
- both privileged reads → session client: **T11 RED**, restored **12/12 green**
- `SUPABASE_SERVICE_ROLE_KEY` gate removed: **T11 RED**
- `export_complete:` field deleted, comments kept: **T9 RED**
- `eventsRes.data ?? []` reintroduced (non-`*Res` shape): **T9 RED**
- parser reverted to the whole-line comment filter: **T7 + T10 RED**, naming
  `owner_alerts, event_preparation_items, people, vendor_meetings`
- `STAFF_ACTOR_FK` reintroduced: **T7 + T10 RED**, naming all 23 suppressed tables

`tsc --noEmit` exit 0 · `lib/**/*.test.ts` 2459/2459 pass.

SPEC IMPACT: None. No SKU, price, schema, or product-surface change. The
`admin_data_access_log` disclosure shape is flagged for DPO sign-off; adding
author SELECT policies by migration (the cleaner long-term shape than the
service-role read) is flagged for owner sign-off; the `KNOWN_GAP_CEILING`
82 → 87 raise needs the owner's explicit yes given the file's may-only-go-DOWN
rule — none is bundled here.
