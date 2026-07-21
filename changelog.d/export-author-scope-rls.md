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
- New `STAFF_ACTOR_FK` keeps pure `*_by` / `*_admin_id` operator stamps out, so
  the widening does not degenerate into "every table".
- `KNOWN_GAP_CEILING` 82 → 85, the one argued exception the ratchet allows: no
  new gap was created, three PRE-EXISTING ones became countable for the first
  time. Documented inline.
- New T7 (heuristic sees non-`*_user_id` subject columns, and still excludes a
  pure operator-stamp table), T8 (the false access-log claim stays corrected),
  T9 (no bare `?? []` unwrap returns on the route).

Measured, not asserted: 344 tables · 36 FK-to-users columns the name regex
misses across 25 tables · 22 of those are operator stamps.

Red-before/green-after run for all four fixes (helper mutated to the old
swallow; `STAFF_ACTOR`/FK detector reverted; parser reverted to line-oriented;
false claim restored; `?? []` restored) — each failed only its own test, then
passed on restore.

SPEC IMPACT: None. No SKU, price, schema, or product-surface change. The
`admin_data_access_log` disclosure shape is flagged for DPO sign-off, and adding
author SELECT policies by migration (the cleaner long-term shape than the
service-role read) is flagged for owner sign-off — neither is bundled here.
