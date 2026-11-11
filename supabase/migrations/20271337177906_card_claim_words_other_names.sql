-- card_claim_words_other_names
-- 🚫 FAIR PRESENTATION, CHECK 14 — "Other names (competitors, celebrities, "as seen at") — on the words list"
-- (plan `plans/supplier_build_2_2026-11-08/00-BUILD-2-PLAN.md`, the 2026-11-08 "FAIR PRESENTATION: 18 checks" line).
--
-- DATA ONLY. The ruling puts borrowed fame on the SAME admin list the claim words live on (`card_claim_words`, read by
-- `loadClaimWordsFor` for the card maker, the shop name, the tagline, About and the bundle name, live and at save). A
-- competitor's or a celebrity's name is the admin's to add on /admin/settings — this seeds only the phrases that borrow
-- standing without naming anyone. PR #7480 seeds the 8 Nov claim list; this adds to it and never overlaps it.
--
-- ON CONFLICT DO NOTHING: an admin's own edit to a phrase or its note is never overwritten. Matching is whole-word,
-- any case, and reads disguised forms too (`lib/claim-text-fold.ts`). Nothing live is taken down: a name already
-- carrying one is listed on its shop's "Edit your name" notice and noted in its editor.

INSERT INTO public.card_claim_words (phrase, note) VALUES
  ('as seen on', 'Borrowed standing: a couple can’t check where you were seen'),
  ('as seen at', 'Borrowed standing: a couple can’t check where you were seen'),
  ('as seen in', 'Borrowed standing: a couple can’t check where you were seen'),
  ('as featured in', 'Borrowed standing: a couple can’t check where you were featured'),
  ('celebrity choice', 'Borrowed standing: a name a couple can’t check'),
  ('trusted by celebrities', 'Borrowed standing: a name a couple can’t check')
ON CONFLICT (phrase) DO NOTHING;
