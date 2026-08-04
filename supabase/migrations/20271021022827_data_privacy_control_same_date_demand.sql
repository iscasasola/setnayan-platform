-- data_privacy_control_same_date_demand
--
-- Seed ONE new Data-Privacy control so the same-date demand signal is something
-- the owner (DPO) can actually Approve or Block at /admin/data-privacy, instead
-- of a paragraph in a handoff.
--
-- WHY THIS EXISTS. `WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §6 decision 3
-- logged the "In demand right now" lens as having "no opt-out and no DPO
-- sign-off", and the 2026-07-30 session closed that item by DOCUMENTING it. The
-- owner then went to /admin/data-privacy for the sign-off and correctly found
-- nothing: all 19 controls on that board were approved, and this signal was not
-- one of them. A privacy gate that exists only in prose is not a gate.
--
-- WHAT THE SIGNAL DISCLOSES. Every other couple holding the SAME EXACT DATE with
-- the same vendor is counted, the number is shown to this couple ("N couples
-- inquired for your date"), and it feeds the ranking lens as a sub-score. That is
-- a CROSS-COUPLE disclosure: couple A learns something about couple B's booking
-- behaviour. Two honesty rules are already baked into the resolver
-- (`lib/same-date-demand.ts`), which is why the exposure is small rather than nil:
--   • INQUIRY-ONLY — discriminates on `chat_threads` existence, so a vendor a
--     couple merely bookmarked contributes ZERO. This implements the owner's
--     2026-06-02 ruling that counting a SAVE as competition is "manufactured
--     scarcity (a fineable dark pattern)".
--   • MIN-N FLOOR of 3 (`MIN_DEMAND_COUPLE_COUNT`) applied SERVER-side, so a
--     below-floor count never reaches a client. n=1, on a solo vendor, for an
--     exact date in a small municipality, is functionally re-identifying.
--
-- Seeds 'inactive' (fail-closed). The feature AND-gates this control with
-- `isExploreReplanEnabled()`, and the gate is written so NOT-approved means NO
-- demand signal at all — never a fall-through to the raw save-count path, which
-- would be strictly worse than showing nothing. ON CONFLICT DO NOTHING keeps any
-- admin edit.
--
-- Live state at write time: 0 `chat_threads` in prod, so the lens cannot render
-- for anyone yet regardless of this control. Approving is therefore safe to do
-- now and safe to defer; the real deadline is before couples start messaging
-- vendors. Mirrors the catalog in `lib/data-privacy-controls.ts`.

INSERT INTO public.data_privacy_controls (control_key, title, description, category, risk_note, sort_order) VALUES
  ('same_date_demand',
   'Same-date demand signal ("In demand right now")',
   'Counts the OTHER couples who have inquired with the same vendor for the same exact date, shows that number to this couple ("N couples inquired for your date"), and feeds it to the "In demand right now" ranking lens as a sub-score. Inquiry-only (a saved-but-never-contacted vendor counts as zero) and floored at 3 couples server-side, so a below-floor count never leaves the server.',
   'Cross-couple activity disclosure',
   'Tells one couple something about other couples'' booking behaviour — the only signal on the marketplace that does. The min-3 floor exists because n=1 on a solo vendor for an exact date in a small municipality is functionally re-identifying, and the inquiry-only rule exists because counting a mere SAVE as competition is manufactured scarcity (owner ruling 2026-06-02: "a fineable dark pattern"). There is no per-couple opt-out: a couple cannot exclude their own inquiry from other couples'' counts. The live /privacy notice and the ROPA do not declare this cross-couple aggregation yet. DPO ruling required before couples start messaging vendors.',
   180)
ON CONFLICT (control_key) DO NOTHING;

-- Belt-and-braces: this table predates the default-ACL discipline, and a fresh
-- environment must not hand it to anon/authenticated (the board reads via
-- service-role only). Idempotent and harmless where the grants are already gone.
REVOKE ALL ON TABLE public.data_privacy_controls FROM anon, authenticated;
