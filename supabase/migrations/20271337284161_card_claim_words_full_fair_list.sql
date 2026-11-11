-- card_claim_words_full_fair_list
-- 🚫 THE FULL CLAIM-WORD LIST — DECISION_LOG 2026-11-08 "NO CLAIM WORDS IN ANY SUPPLIER-WRITTEN NAME — THE FULL LIST IS
-- BANNED" (owner: "any of these words should not be allowed"), Supplier Build 2 item (1), which never shipped: production
-- held only the first six (#1 · 100% · best in · guaranteed · lowest price · official). Owner 11 Nov, on a live card named
-- "Best mobile bar": "I thought we already did the prohibited words to use like best" ⇒ plain "best" is on the list too.
--
-- DATA ONLY. Adds rows to the admin-editable list the card maker's live check and the save's server re-check already read
-- (`lib/service-card-checks.server.ts` · `loadClaimWordsFor`). ON CONFLICT DO NOTHING: an admin's own edit to a phrase or
-- its note is never overwritten, and a phrase an admin removed on purpose is re-added only if it is on this ruled list.
-- Matching is whole-word and case-insensitive (`claimWordPattern`), so "best" refuses "Best mobile bar" and "best-selling"
-- but never "bestow"; per-shop exceptions stay in `card_claim_word_allowances` (Admin › Repost watch).
-- Nothing live is taken down: a card already carrying a word is flagged in the maker when next edited.

INSERT INTO public.card_claim_words (phrase, note) VALUES
  ('best', 'Rank: a claim a couple cannot check'),
  ('the best', 'Rank: a claim a couple cannot check'),
  ('best in', 'Rank: a claim a couple cannot check'),
  ('#1', 'Rank: a claim a couple cannot check'),
  ('no. 1', 'Rank: a claim a couple cannot check'),
  ('no 1', 'Rank: a claim a couple cannot check'),
  ('number one', 'Rank: a claim a couple cannot check'),
  ('top-rated', 'Rank: a claim a couple cannot check'),
  ('top rated', 'Rank: a claim a couple cannot check'),
  ('top', 'Rank: a claim a couple cannot check'),
  ('leading', 'Rank: a claim a couple cannot check'),
  ('premier', 'Rank: a claim a couple cannot check'),
  ('finest', 'Rank: a claim a couple cannot check'),
  ('unbeatable', 'Rank: a claim a couple cannot check'),
  ('unmatched', 'Rank: a claim a couple cannot check'),
  ('trending', 'Popularity: a claim a couple cannot check'),
  ('rising', 'Popularity: a claim a couple cannot check'),
  ('best-selling', 'Popularity: a claim a couple cannot check'),
  ('best selling', 'Popularity: a claim a couple cannot check'),
  ('bestseller', 'Popularity: a claim a couple cannot check'),
  ('most booked', 'Popularity: a claim a couple cannot check'),
  ('most popular', 'Popularity: a claim a couple cannot check'),
  ('in demand', 'Popularity: a claim a couple cannot check'),
  ('viral', 'Popularity: a claim a couple cannot check'),
  ('sold out', 'Popularity: a claim a couple cannot check'),
  ('guaranteed', 'Promise: a claim a couple cannot check'),
  ('100%', 'Promise: a claim a couple cannot check'),
  ('official', 'Promise: a claim a couple cannot check'),
  ('certified', 'Promise: a claim a couple cannot check'),
  ('award-winning', 'Promise: a claim a couple cannot check'),
  ('award winning', 'Promise: a claim a couple cannot check'),
  ('lowest price', 'Promise: a claim a couple cannot check'),
  ('cheapest', 'Promise: a claim a couple cannot check'),
  ('best price', 'Promise: a claim a couple cannot check'),
  ('limited slots', 'Pressure: rushes a decision'),
  ('last slot', 'Pressure: rushes a decision'),
  ('hurry', 'Pressure: rushes a decision'),
  ('today only', 'Pressure: rushes a decision'),
  ('pinakamagaling', 'Tagalog claim'),
  ('pinakamahusay', 'Tagalog claim'),
  ('numero uno', 'Tagalog claim'),
  ('pinakamura', 'Tagalog claim'),
  ('patok', 'Tagalog claim'),
  ('sikat', 'Tagalog claim'),
  ('garantisado', 'Tagalog claim'),
  ('verified', 'Setnayan''s earned badge — given by Setnayan, never self-claimed'),
  ('featured', 'Setnayan''s earned badge — given by Setnayan, never self-claimed'),
  ('top pick', 'Setnayan''s earned badge — given by Setnayan, never self-claimed'),
  ('couple trusted', 'Setnayan''s earned badge — given by Setnayan, never self-claimed'),
  ('recommended by setnayan', 'Setnayan''s earned badge — given by Setnayan, never self-claimed')
ON CONFLICT (phrase) DO NOTHING;
