-- dpo_identity_correction
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

-- ============================================================================
-- COMPLIANCE FACT CORRECTION — the DPO is the PROPRIETOR, not the VP.
--
-- The owner directive of 2026-07-07 ("the DPO is the OWNER, Indalecio Sacdalan
-- Casasola II, NOT Claire E. Buanhog") was applied across the whole spec corpus
-- (NPC_Compliance/00–08, the Privacy Policy, the strategy briefs) — but it was
-- NEVER applied to the DATABASE. `platform_compliance_facts` was seeded by
-- 20270519648420_platform_compliance_facts.sql on 2026-07-06 naming the VP as
-- DPO, and prod STILL held that value on 2026-07-31 (updated_at
-- 2026-07-06 19:08:49Z — untouched since the seed).
--
-- This is NOT a code-comment typo. That row is the source for /admin/compliance
-- and, more importantly, for the /admin/compliance/data-sheet export — the NPC
-- registration data sheet. Left alone it names the wrong accountable person in
-- an RA 10173 filing. The DPO is a named, accountable role, and the proprietor
-- has already registered HIMSELF on the NPC DPO system (2026-07-07).
--
-- Canonical source for every value below:
--   ~/Documents/Claude/Projects/Setnayan/NPC_Compliance/
--     03_DPO_Designation_and_NPCRS_ADOPTED_2026-07-24.md   (DPO identity + email)
--     04_Data_Breach_Management_Policy_ADOPTED_2026-07-24.md § DBRT (who leads)
--     07_Compliance_Facts_Register.md § 6                  (automated decisions)
--   + DECISION_LOG.md row 2026-07-07 (the directive itself)
--
-- ⚠ Claire E. Buanhog is a REAL person and REMAINS VP / co-founder and DBRT
-- support. Do NOT scrub her name from the codebase — the keynote founder credits
-- and the historical CHANGELOG entries naming her are CORRECT. Only the
-- "Claire = DPO" claim is wrong, and only that is corrected here.
--
-- SAFETY: every UPDATE is guarded on the stale value. The admin form at
-- /admin/compliance writes to this same row, so if the owner has already
-- corrected a field by hand, the guard fails and his value is left untouched.
-- Re-running this migration is a no-op.
-- ============================================================================

-- 1. DPO identity — name, title, contact.
--    The email changes too: the seed used the dpo@setnayan.com alias, but the
--    2026-07-07 directive supplied iscasasolaii@gmail.com as the official DPO
--    contact. That is the address published to data subjects in the Privacy &
--    Security Policy and carried into the NPC data sheet — they must match, or
--    the filing contradicts the published policy.
UPDATE public.platform_compliance_facts
   SET dpo_name = 'Indalecio Sacdalan Casasola II'
 WHERE id = 1 AND dpo_name = 'Claire E. Buanhog';

UPDATE public.platform_compliance_facts
   SET dpo_title = 'Proprietor + Data Protection Officer'
 WHERE id = 1 AND dpo_title = 'VP';

UPDATE public.platform_compliance_facts
   SET dpo_email = 'iscasasolaii@gmail.com'
 WHERE id = 1 AND dpo_email = 'dpo@setnayan.com';

-- 2. Breach-response team — the seed had the two roles exactly backwards.
--    Per 04_Data_Breach_Management_Policy § DBRT: the DPO (proprietor) LEADS,
--    the VP SUPPORTS.
UPDATE public.platform_compliance_facts
   SET breach_team = '2-person team: the DPO — Indalecio Sacdalan Casasola II (proprietor) — leads; Claire E. Buanhog (VP, co-founder) supports. No external DBRT members yet; add an external PH counsel liaison when engaged.'
 WHERE id = 1
   AND breach_team = '2-person team: DPO (Claire E. Buanhog) leads, proprietor supports. Add external PH counsel liaison when engaged.';

-- 3. Solely-automated decisions — the seeded "None" became FALSE on 2026-07-07,
--    the same day and by the same directive, when the Anti-Fraud auto-suspend
--    went live. Declaring "no automated decision-making" to the NPC while
--    shipping one is the more serious of the two misstatements in this row.
--    Substance mirrors 07_Compliance_Facts_Register.md § 6.
UPDATE public.platform_compliance_facts
   SET automated_decisions = 'YES — one, as of 2026-07-07: the Anti-Fraud engine (DPIA R-08 / RoPA DPS-12) can automatically suspend a vendor''s public listing at a high fraud score (reversible). The irreversible wipe/ban is NOT automated — it is routed through the four-eyes admin gate. AI planning features remain assistive only. See 08_DPIA_AntiFraud_Trust_Integrity_2026-07-07.md § 6 (RA 10173 § 16(c) / § 34); a formal contest/appeal path is a flagged follow-up.'
 WHERE id = 1
   AND automated_decisions = 'None — AI features assist/navigate; no binding automated decision-making with legal or significant effect.';

-- No DDL, no new object, no grant — this migration only corrects DATA in an
-- existing admin-only table (RLS `is_admin` FOR ALL, set at CREATE TABLE time in
-- 20270519648420). Nothing to REVOKE.
