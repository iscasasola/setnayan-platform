## 2026-07-12 · feat(family-graph): PR-G married household — shared dependents + joint Year view (flag-off)

Two spouses who co-host a wedding form a household; their JOINT children are
shared between them (a joint Year view), while each spouse's OWN relatives stay
private unless explicitly shared. Consent asymmetry (owner rule B6):
`relationship = 'child'` → shared by default; anyone else → opt-in.

- New migration `20270803222366_…`: `dependents.shared_with_spouse` column
  (child-auto-shared backfill), `current_spouse_user_ids()` SECURITY DEFINER
  helper (wedding co-hosts; **not** archived-filtered → dissolution co-parenting
  persists), and an **additive** `dependents_spouse_read` SELECT policy (a spouse
  can READ shared rows, never write).
- `setDependentSharing` action (owner-only toggle) + `addDependent` stamps the
  child-auto-shared default.
- People → dependents section: spouse-shared rows render read-only with a
  "Shared by your spouse" badge; own rows get a share/make-private toggle when the
  user has a spouse. The Year + faith-rites views fold shared rows in for free
  (RLS-driven, no query change).

⚠ LOAD-BEARING: this widens RLS on the **minors** table. Inert in prod (the table
is empty behind `dependentPeopleEnabled()`), but the consent-asymmetry model is
owner + counsel sign-off (B6, feeds G1) BEFORE the flag flips.

SPEC IMPACT: None (design in `Family_Life_OS_Master_Build_Plan_2026-07-12.md` §B6/PR-G;
gate tracked in `Family_Graph_Owner_Actions_2026-07-12.md`).
