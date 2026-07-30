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

## Full-row sweep (all 24 columns, 2026-07-31)

Having found one wrong fact, every other column was compared against the ADOPTED
corpus rather than assuming the rest were fine. **One more was fixable and is
included here:**

- `dpo_employment_basis` — recorded the team size but omitted the one fact the NPC
  actually scrutinises: **that the PIC and the DPO are the same person.** NPC
  Advisory 2017-01 prefers a DPO autonomous from the controller, so a
  self-designation must be stated and reasoned. Now carries the independence
  rationale from `07_Compliance_Facts_Register` § 2 / doc 03 § A.3.

**Verified correct, left alone:** `legal_name`, `proprietor`, `dti_bn`,
`headcount`, `staff_with_data_access`, `sensitive_rsvp_fields`, `maya_status`, and
all 9 `sub_processors` (names match the register § 5 exactly; every
`dpa_on_file:false` is honest — none is confirmed). `npc_registration_no` is
correctly NULL until filed.

**Cannot be fixed from a migration — OWNER ACTION, all empty in prod:** `bir_tin`,
`registered_address`, `dpo_phone` (sensitive by design — they live only in the
admin form, never in a repo), plus `breach_contacts`, `staff_controls`,
`dpia_adoption_dates`, and `dpo_designation_date` (a designation date is a legal
act, not a derivable fact).

**Scale counts do not drift** — `data-sheet/page.tsx` computes them live via
`countOf()`, so the export always reports the truth on the day it is generated.

SPEC IMPACT: **Yes — corpus corrected in the same session** (direct-edit
authorization). The sweep found the *corpus* wrong where the DB row was right:
three documents placed the biometric **face-vector index on Cloudflare R2**.
Verified against shipped code, the vectors are `JSONB` in **Supabase Postgres
(Singapore)** — `guest_face_enrollments.face_vector` (`20260901000000`) and
`user_face_profiles` (`20270306508746`); R2 holds only the source selfie image
(`asset_url`). No R2 vector index was ever built. Corrected in
`01_Privacy_Manual_ADOPTED_2026-07-24.md` §§ 5.2/5.3/10,
`03_DPO_Designation_and_NPCRS_ADOPTED_2026-07-24.md` § sub-processors, and
`02_Records_of_Processing_Activities_DRAFT_2026-07-05.md` DPS-04 — the last of
which also let a standing `[TO CONFIRM]` be closed: embedding is **on-device
(face-api.js / MediaPipe)**, so **no face data reaches any AI sub-processor**.
Stale scale figures flagged in `07_Compliance_Facts_Register.md` § 3.
