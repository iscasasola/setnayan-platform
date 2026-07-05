-- Platform compliance facts — the single-row store for the RA 10173 / NPC
-- (National Privacy Commission) registration data (owner 2026-07-05).
--
-- WHY: the DPO Designation + NPC Registration data sheet lives as a spec draft
-- (NPC_Compliance/03_DPO_Designation_and_NPC_Registration_Sheet). It carries a
-- handful of SENSITIVE identifiers (BIR TIN, registered office address, DPO
-- phone) that must NOT live in a plaintext file or in the repo. This table is
-- their home instead: the owner enters them ONCE through the admin Compliance
-- form (/admin/compliance) and they feed the NPC filing.
--
-- SINGLETON: exactly one row (id = 1, CHECK-enforced) — the platform_settings /
-- platform_integration_secrets pattern. Deny-by-default RLS; a single admin-only
-- FOR ALL policy (public.is_admin()).
--
-- SENSITIVITY: the seed below plants ONLY the NON-sensitive facts that already
-- appear in public docs (legal name, proprietor, DTI number, DPO name/title/
-- email, headcount, sub-processor roster, processing notes). The sensitive
-- identifiers (bir_tin, registered_address, dpo_phone) — plus fields still to be
-- settled (npc_registration_no, dpo_designation_date, staff_controls,
-- dpia_adoption_dates) — are LEFT BLANK on purpose and are only ever written at
-- runtime by the owner through the admin form. Never seed them here.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING; re-runnable.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_compliance_facts (
  -- Singleton lock — exactly one row.
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Business / Personal Information Controller (PIC) identity.
  legal_name             TEXT,
  proprietor             TEXT,
  dti_bn                 TEXT,
  bir_tin                TEXT,   -- SENSITIVE — runtime-only, never seeded.
  registered_address     TEXT,   -- SENSITIVE — runtime-only, never seeded.
  npc_registration_no    TEXT,

  -- Data Protection Officer (DPO).
  dpo_name               TEXT,
  dpo_title              TEXT,
  dpo_email              TEXT,
  dpo_phone              TEXT,   -- SENSITIVE — runtime-only, never seeded.
  dpo_employment_basis   TEXT,
  dpo_designation_date   DATE,

  -- Scale of processing (team).
  headcount              INT,
  staff_with_data_access INT,

  -- Breach response.
  breach_team            TEXT,
  breach_contacts        TEXT,

  -- Sub-processors — array of {name, role, jurisdiction, personal_data, dpa_on_file}.
  sub_processors         JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Processing declarations.
  sensitive_rsvp_fields  TEXT,
  automated_decisions    TEXT,
  maya_status            TEXT,
  staff_controls         TEXT,
  dpia_adoption_dates    TEXT,

  -- Meta.
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by             UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

ALTER TABLE public.platform_compliance_facts ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: the ONLY policy is admin-only, both directions. No public /
-- couple / vendor / guest access — these are the platform's compliance
-- identifiers, several of them sensitive.
DROP POLICY IF EXISTS platform_compliance_facts_admin_all
  ON public.platform_compliance_facts;
CREATE POLICY platform_compliance_facts_admin_all
  ON public.platform_compliance_facts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed the singleton row (id = 1) with NON-SENSITIVE facts only. The sensitive
-- identifiers and still-to-confirm fields stay NULL (owner fills them via the
-- admin form). ON CONFLICT DO NOTHING keeps this idempotent + preserves any
-- values the owner has already entered on a re-run.
INSERT INTO public.platform_compliance_facts (
  id,
  legal_name,
  proprietor,
  dti_bn,
  dpo_name,
  dpo_title,
  dpo_email,
  dpo_employment_basis,
  headcount,
  staff_with_data_access,
  breach_team,
  sub_processors,
  sensitive_rsvp_fields,
  automated_decisions,
  maya_status
) VALUES (
  1,
  'SETNAYAN SOFTWARE DEVELOPMENT SERVICE',
  'Indalecio Sacdalan Casasola II',
  '8297508',
  'Claire E. Buanhog',
  'VP',
  'dpo@setnayan.com',
  'Internal (2-person founding team; no formal contract yet)',
  2,
  2,
  '2-person team: DPO (Claire E. Buanhog) leads, proprietor supports. Add external PH counsel liaison when engaged.',
  '[
    {"name":"Vercel","role":"App hosting","jurisdiction":"United States","personal_data":true,"dpa_on_file":false},
    {"name":"Supabase","role":"Database","jurisdiction":"Singapore (ap-southeast-1)","personal_data":true,"dpa_on_file":false},
    {"name":"Cloudflare R2","role":"Media storage","jurisdiction":"APAC","personal_data":true,"dpa_on_file":false},
    {"name":"Resend (+ SendGrid fallback)","role":"Email","jurisdiction":"United States","personal_data":true,"dpa_on_file":false},
    {"name":"PostHog","role":"Analytics","jurisdiction":"US/EU cloud — confirm instance","personal_data":true,"dpa_on_file":false},
    {"name":"Persona / Veriff / Onfido","role":"Vendor ID verification","jurisdiction":"US/EU","personal_data":true,"dpa_on_file":false},
    {"name":"Anthropic / OpenAI","role":"AI features","jurisdiction":"United States","personal_data":true,"dpa_on_file":false},
    {"name":"Suno","role":"Music generation","jurisdiction":"United States","personal_data":false,"dpa_on_file":false},
    {"name":"Face matching (in-house)","role":"On-device face-api.js / MediaPipe in-browser; vectors stored in Supabase Singapore; no third party","jurisdiction":"In-house","personal_data":true,"dpa_on_file":false}
  ]'::jsonb,
  'dietary_restrictions, meal_preference (may reveal health / religious belief). No standalone religion or health field.',
  'None — AI features assist/navigate; no binding automated decision-making with legal or significant effect.',
  'Not active — dormant / V1.5 roadmap; no contract yet. Current payment is manual apply-then-pay (BDO/GCash).'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
