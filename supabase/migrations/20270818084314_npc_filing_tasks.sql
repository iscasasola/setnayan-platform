-- ============================================================================
-- 20270818084314_npc_filing_tasks.sql
--
-- NPC PRE-FILING READINESS tracker (council verdict 2026-07-16). Turns the
-- completeness audit's Tier 0-3 "before filing" checklist (15 deduped items)
-- into tracked work at /admin/npc-readiness. Structurally cloned from the Data
-- Privacy board (20270814219429_data_privacy_controls.sql) — BUT this is a
-- WORKLIST, not a gate: NOTHING reads task status to flip a capability, so there
-- is no fail-closed behaviour and no isNpc...Active() helper.
--
-- Anti-false-assurance is enforced in the app action, not here: counsel-gated
-- rows can't resolve without a written counsel reference, and t3-13 (FILE the
-- DPS) can't resolve until t0-1 (external counsel review) is resolved.
--
-- Seeded from lib/npc-filing-tasks.ts. Re-run safe (ON CONFLICT DO NOTHING keeps
-- owner status/notes). Admin-only RLS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.npc_filing_tasks (
  task_key            TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  detail              TEXT NOT NULL,
  tier                SMALLINT NOT NULL,
  kind                TEXT NOT NULL
                      CHECK (kind IN ('counsel', 'document', 'reconciliation', 'remediation')),
  severity            TEXT NOT NULL DEFAULT 'normal'
                      CHECK (severity IN ('blocking', 'weakening', 'normal')),
  counsel_gated       BOOLEAN NOT NULL DEFAULT FALSE,
  source_refs         TEXT[] NOT NULL DEFAULT '{}',
  source_audit_ref    TEXT NOT NULL DEFAULT 'NPC_Submission_Completeness_Audit_2026-07-16.md',
  related_control_key TEXT,
  status              TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started', 'in_progress', 'blocked_on_counsel', 'resolved', 'not_applicable')),
  note                TEXT,
  evidence            TEXT,
  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  sort_order          INTEGER NOT NULL DEFAULT 100,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.npc_filing_tasks IS
  'NPC pre-filing readiness worklist (RA 10173). One row per before-filing task from the completeness audit. NOT a gate — no capability reads task status. Anti-false-assurance enforced in the app action (counsel-gated rows need a written counsel reference to resolve; the FILE task is fenced behind the counsel-review task). Admin-only RLS. Seeded from lib/npc-filing-tasks.ts.';

ALTER TABLE public.npc_filing_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS npc_filing_tasks_admin_read ON public.npc_filing_tasks;
CREATE POLICY npc_filing_tasks_admin_read
  ON public.npc_filing_tasks FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS npc_filing_tasks_admin_write ON public.npc_filing_tasks;
CREATE POLICY npc_filing_tasks_admin_write
  ON public.npc_filing_tasks FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- No INSERT policy: seed + first-write upserts run under service-role
-- (createAdminClient bypasses RLS), exactly as data_privacy_controls does.

-- ── Seed the 15 canonical tasks (mirror of lib/npc-filing-tasks.ts) ──────────
INSERT INTO public.npc_filing_tasks
  (task_key, title, detail, tier, kind, severity, counsel_gated, source_refs, related_control_key, sort_order)
VALUES
  ('t0-1', 'Route the full packet to external PH counsel',
   'The terminal gate. Send the whole set to external Philippine data-privacy counsel with specific asks: the §3(l)/minors cluster, the vendor AMLC/PEP + government-ID basis, the NPC registration threshold, and the automated-decision provisions. Resolved = written counsel review received (name + memo date in the note).',
   0, 'counsel', 'blocking', TRUE, ARRAY['t0-1'], NULL, 10),
  ('t0-2', 'Pick ONE authoritative filing backbone + fix the SPI under-declaration',
   'Use the NPC_Compliance pack as the backbone, demote the executive dossier to a summary, and make the dossier''s SPI declaration match the pack — restore vendor gov-ID + AMLC/PEP. Reconcile the two RoPAs (11-12-system pack vs 18-category dossier) to ONE authoritative version.',
   0, 'reconciliation', 'blocking', FALSE, ARRAY['t0-2', 'B4', 'W7'], NULL, 20),
  ('t0-3', 'Reconcile single-source conflicts + commit the untracked canonical docs',
   'One DPO email (dpo@setnayan.com vs iscasasolaii@gmail.com), one DSR SLA (7 vs 15 days), one device-fingerprint live/off state. Commit the 3 untracked canonical docs (dossier, retention schedule, fingerprint one-pager) so the master isn''t the least durable file (W6).',
   0, 'reconciliation', 'normal', FALSE, ARRAY['t0-3', 'W1', 'W2', 'W3', 'W6'], NULL, 30),
  ('t1-4', 'Publish the Anti-Fraud disclosure + record its LIA + document an appeal path',
   'The anti-fraud identity-clustering + automated vendor suspension shipped to prod 2026-07-07 with no notice, no legitimate-interest assessment, no counsel review. Publish the disclosure, record the LIA, and document a formal §16(c)/§34 automated-decision contest/appeal procedure (elevate the help-center ticket stub to a real process).',
   1, 'document', 'blocking', TRUE, ARRAY['t1-4', 'm-6', 'm-8', 'B2'], NULL, 40),
  ('t1-5', 'Publish the faith / minors / e-gift / device-fingerprint disclosures + fix the biometric denial',
   'Add the faith/minors/e-gift/device-fingerprint disclosures to the public privacy notice with matching RoPA rows; FIX the biometric "we do not collect" denial; publish the Person-Graph + Anti-Fraud policy amendments; add the just-in-time consent templates.',
   1, 'document', 'blocking', TRUE, ARRAY['t1-5', 'm-4', 'm-5', 'm-13', 'B3'], 'faith_religion_graph', 50),
  ('t1-6', 'Gate or consent-instrument the events.signature_details honoree SPI',
   'The honoree fields (child DOB/gender for christening, pregnancy due-date for gender-reveal) collect sensitive data with no flag, no consent, no timestamp. Gate behind a flag or add a per-field consent stamp before filing.',
   1, 'remediation', 'blocking', TRUE, ARRAY['t1-6', 'm-5', 'B3'], 'home_activity_signals', 60),
  ('t1-7', 'Confirm the true prod flag state of the dependent + e-gift routes',
   'Confirm whether NEXT_PUBLIC_DEPENDENT_PEOPLE and PABUYA_PUBLIC_ROUTE_ENABLED are ON in production. If ON, add the live SPI + minors and financial-PI processing activities to the RoPA.',
   1, 'remediation', 'normal', FALSE, ARRAY['t1-7'], 'dependent_minor_profiles', 70),
  ('t2-8', 'Execute DPAs / SCCs for every named sub-processor',
   'The single biggest evidentiary hole: every "DPA on file" is [confirm]. Obtain/execute Data Processing Agreements or Standard Contractual Clauses for Supabase, Vercel, Cloudflare, Resend, Sentry, PostHog, Anthropic, Persona, Google, TikTok, Suno; attach the executed references. Underpins the §21 cross-border-transfer basis.',
   2, 'document', 'blocking', FALSE, ARRAY['t2-8', 'm-3', 'B5'], NULL, 80),
  ('t2-9', 'Write the outstanding DPIAs',
   'R-03 Vendor Verification (HIGH — gov-ID/liveness/AMLC/PEP, and processing is LIVE) and R-05 Minors & Legacy (HIGH — counsel-first, before any build). Decide whether R-04 Payments / R-06 Contract Intelligence / R-07 Chat are standalone or folded.',
   2, 'document', 'normal', TRUE, ARRAY['t2-9', 'm-7'], 'dependent_minor_profiles', 90),
  ('t2-10', 'Record the Device-Fingerprint LIA + DPO sign-off before flipping the flag',
   'The device-fingerprint fraud processing relies on §12(f) legitimate interest and needs a documented LIA/balancing test. Record it and get the DPO sign-off before the flag flips on.',
   2, 'document', 'normal', FALSE, ARRAY['t2-10', 'm-6'], NULL, 100),
  ('t2-11', 'Adopt light NDA / privacy-training / device-hygiene notes',
   'Organizational-measure evidence for the 2-person team: personnel confidentiality undertakings, a privacy-training record, and a device/endpoint policy (all [TO CONFIRM] in the manual today).',
   2, 'document', 'normal', FALSE, ARRAY['t2-11', 'm-9'], NULL, 110),
  ('t3-12', 'Sign + date the governance instruments',
   'Sign and date the DPO Designation (with the DPO''s written acceptance), the Privacy Manual, the Breach Policy, and the three completed DPIAs; set effectivity dates. Nothing in the set is currently signed/adopted — the filing has no executed backbone.',
   3, 'document', 'blocking', TRUE, ARRAY['t3-12', 'm-1', 'm-12', 'B1'], NULL, 120),
  ('t3-13', 'File the DPS via NPCRS + capture the registration number',
   'Resolve the remaining [TO CONFIRM] NPCRS fields (business address, DPO title/phone, BIR TIN / Form 2303) and FILE the Data Processing System registration via NPCRS. Resolved = DPS filed and the acknowledgement/registration number captured in evidence. Structurally cannot be resolved before t0-1 (counsel review).',
   3, 'document', 'normal', FALSE, ARRAY['t3-13', 'm-2', 'm-11'], NULL, 130),
  ('t3-14', 'Reconcile the binding policy retention + stand up enforcement',
   'Add the 10-year floor + the vendor-verification retention class to the binding Privacy & Security Policy §4, and stand up retention ENFORCEMENT (R2 lifecycle rules, the retention sweep, fix the chat-message-PII residue left by account hard-delete). A storage-limitation claim the platform cannot yet enforce is a weakness.',
   3, 'reconciliation', 'normal', FALSE, ARRAY['t3-14', 'W4', 'W5'], NULL, 140),
  ('t3-15', 'Initiate the operational breach-management records',
   'Templates exist; the operational records do not. Stand up the breach register (live), run the first table-top drill, and set the annual NPC breach-summary cadence.',
   3, 'document', 'normal', FALSE, ARRAY['t3-15', 'm-10'], NULL, 150)
ON CONFLICT (task_key) DO NOTHING;

COMMIT;
