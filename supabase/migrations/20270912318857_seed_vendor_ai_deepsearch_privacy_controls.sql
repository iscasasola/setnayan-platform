-- Seed two new Data-Privacy controls for the 2026-07-22 vendor AI/data flows,
-- so the owner (DPO) can Approve / Block them at /admin/data-privacy. Both seed
-- as 'inactive' (fail-closed) — the features gate on isDataPrivacyControlActive()
-- and stay dark until explicitly approved. Mirrors the catalog in
-- lib/data-privacy-controls.ts. ON CONFLICT DO NOTHING keeps any admin edit.

INSERT INTO public.data_privacy_controls (control_key, title, description, category, risk_note, sort_order) VALUES
  ('vendor_ai_autoreply',
   'Vendor AI (auto-reply)',
   'The paid Vendor AI add-on reads a couple''s inbox messages + Event Brief (dates, pax, budget-per-head, venue) and auto-answers — and can auto-accept — on the vendor''s behalf. Deterministic (no LLM); the couple sees it labelled "AI auto-reply".',
   'Automated processing of couple messages',
   'Automated processing of couple chat + event data on the vendor''s behalf. The live /privacy notice needs a Vendor-AI section (purpose + legal basis) before this activates; couple-faith consumption must stay unwired. DPO sign-off required.',
   130),
  ('vendor_deep_search',
   'Vendor Deep Search',
   'The paid Deep Search add-on runs AI web-research (Anthropic web_search) over the vendor''s OWN business across public sources incl. review sites, and stores a structured dossier (vendor_web_dossiers) to auto-fill the vendor profile.',
   'AI web-research + dossier storage',
   'AI web-research via the Anthropic web_search subprocessor; may read third-party PII (reviewers, named clients) from the open web; a dossier is stored. The /privacy notice needs a Deep-Search section + a retention limit; DPO review of third-party-source storage required.',
   140)
ON CONFLICT (control_key) DO NOTHING;
