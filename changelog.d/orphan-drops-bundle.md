## 2026-09-19 · chore(db): orphan-drops bundle — six drop PRs as one migration train

Bundles #5642 (S37 retired ends), #5643 (S37 pre-split Papic camera gate), #5644 (S36 booking-lifecycle ends),
#5646 (S37 superseded couple-planning tables), #5647 (S35 token wallet + Supplies vertical) and #5655 (S39
supplier tables nobody writes) into one branch, because each PR regenerated the same GENERATED baselines
(`supabase/security/exposure-surface.baseline.txt`, `apps/web/tests/db/user-fk-behaviour.generated.txt`)
and every merge re-conflicted the rest — a CONFLICTING PR runs no CI and never merges. #5642 and #5655 also
each wrote the FK-behaviour count line (241 → 239) for different tables; merged separately the count would
have been wrong. Here both baselines were reset to main's and regenerated ONCE on the bundled tree.

Semantic conflict resolved by hand: #5644 dropped `vendor_contract_signatures` and #5647 dropped
`supplies_orders` — each PR had left the OTHER as a remaining deliberate user-delete blocker. With both
gone, `order_refunds` is the only refusing FK: `user-delete-refusing-fks.baseline.txt`,
`DELIBERATE_BLOCKERS` (`lib/user-delete-blockers.ts` + its test), and the comments in
`app/admin/users/actions.ts` and `lib/erasure/purge.ts` now say one, not two. `CLOSED_IN_BATCH_2`'s floor in
`anon-table-grants-closed.db.test.ts` is set to the list's real length after both removals.

Source content otherwise carried over unchanged; see each source PR's own fragment (also carried).

SPEC IMPACT: None beyond what the six source PRs already declared in their own fragments.
