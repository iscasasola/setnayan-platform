## 2026-07-31 · fix(compliance): the DPO of record is the proprietor, not the VP

The owner directive of **2026-07-07** — *"the DPO is the OWNER (Indalecio Sacdalan
Casasola II), NOT Claire E. Buanhog"* — was applied across the entire spec corpus
that day (`NPC_Compliance/00–08`, the Privacy Policy, the strategy briefs). **It was
never applied to this repo, or to the database.**

**The live defect.** `platform_compliance_facts` (seeded by
`20270519648420_platform_compliance_facts.sql`) is the source for `/admin/compliance`
and for the **`/admin/compliance/data-sheet` export — the NPC registration data
sheet**. Prod was queried on 2026-07-31 and still held the seeded values, `updated_at
2026-07-06 19:08:49Z`, untouched since the seed:

| Field | Was | Now |
|---|---|---|
| `dpo_name` | Claire E. Buanhog | Indalecio Sacdalan Casasola II |
| `dpo_title` | VP | Proprietor + Data Protection Officer |
| `dpo_email` | dpo@setnayan.com | iscasasolaii@gmail.com |
| `breach_team` | "DPO (Claire) leads, proprietor supports" | DPO (proprietor) leads, VP supports — the two roles were backwards |
| `automated_decisions` | "None" | "YES — one, as of 2026-07-07": the Anti-Fraud auto-suspend (DPIA R-08 / RoPA DPS-12) |

That last row is the more serious of the two: it declared **no** solely-automated
decision-making with significant effect, while the reversible Anti-Fraud auto-suspend
went live on the very day of the directive. The corpus was corrected then
(`07_Compliance_Facts_Register.md` § 6); the DB never was. Both are now consistent.

**New migration `20271025017078_dpo_identity_correction.sql`** — data-only, no DDL.
Every `UPDATE` is **guarded on the stale value**, because the admin form writes to
this same row: if the owner has already fixed a field by hand, the guard fails and
his value survives. Re-running is a no-op. The applied seed migration
`20270519648420` is **not edited** — its `VALUES` clause is SQL that already ran.

**Comment-only fixes** (no behavior): `apps/web/lib/stewarded-accounts.ts`,
`supabase/migrations/20270517133592_phase3_stewardship_scaffolding.sql`, and the
unfolded `changelog.d/phase3-stewardship-scaffolding.md` fragment — each of which
named the VP as the sign-off authority gating Phase 3.

**Deliberately NOT changed.** Claire E. Buanhog is a real person and **remains VP /
co-founder and DBRT support**. Her name is correct in the keynote founder credits
(`homepage-stories.jsx`, `keynote-vendors.jsx`) and in the historical `CHANGELOG.md`
entries about 2026-05-22 guest test data. Only the *"Claire = DPO"* claim was wrong,
and only that was corrected — a blanket find-and-replace here would have erased a
co-founder from her own product.

Why it matters: the DPO is a **named, accountable role** under RA 10173, the
proprietor has already registered himself on the NPC DPO system (2026-07-07), and
this row feeds a regulator-facing export.

SPEC IMPACT: None — the corpus has carried the correct DPO since 2026-07-07
(`DECISION_LOG.md` row 2026-07-07 ·
`NPC_Compliance/03_DPO_Designation_and_NPCRS_ADOPTED_2026-07-24.md`). This PR makes
the repo and the database match the corpus, not the other way round.
