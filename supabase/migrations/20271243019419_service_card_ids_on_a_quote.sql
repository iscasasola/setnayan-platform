-- ═══════════════════════════════════════════════════════════════════════════
-- A QUOTE REMEMBERS WHICH SERVICE CARDS IT WAS BUILT FROM.
--
-- ── THE DEFECT THIS EXISTS TO REMOVE ──────────────────────────────────────
-- `lib/offered-service-card-state.ts` (shipped 2026-09-22, owner's ruling: "the
-- quote card REPLACES the offered-service card") decides supersession from TWO
-- TIMESTAMPS and nothing else — the offer's `created_at` against
-- `latestQuoteAtFrom(messages)`, the newest quote ANYWHERE in the thread. It
-- cannot know which cards a quote covered, because nothing records that.
--
-- Measured by executing the shipped rule, 2026-09-22:
--
--   offer CARD_PHOTO · offer CARD_VIDEO · one quote built from PHOTO only
--     CARD_PHOTO -> superseded  actionable=false  "Replaced by a quote"
--     CARD_VIDEO -> superseded  actionable=false  "Replaced by a quote"   ← wrong
--
-- The video offer was never quoted for. It goes grey and loses its actions, so
-- the couple is told an unrelated quote replaced it. That is the ruling's own
-- mitigation — "a view must not be destroyed" — failing in the direction it was
-- written to prevent.
--
-- 🔑 THE INFORMATION ALREADY EXISTS AND WE THROW IT AWAY. The quote builder
-- loads one or several service cards and knows exactly which
-- (`lib/quote-from-service-card.ts`, the builder's `pickedCards`). Nothing
-- persists it, so a later surface has to guess with a proxy. That is the same
-- shape as `includes_setnayan_gift` before 20271240324859: written at compose
-- time, never stored, guessed at afterwards.
--
-- ── WHY NULLABLE WITH NO DEFAULT, against the nearest precedent ────────────
-- `vendor_locked_qr_tokens.vendor_service_ids` (20270427844373) is
-- `JSONB NOT NULL DEFAULT '[]'`. That is right THERE — nothing reads it to
-- decide whether to retire another card, so `[]` on a legacy row is inert.
--
-- Here it would NOT be inert. `[]` reads as "this quote was built from no
-- cards", and every quote that existed before this file would suddenly assert
-- that about itself. NULL is the honest value for a row that never said, and it
-- is what makes the reader fall back to today's timestamp rule — so no existing
-- thread changes behaviour. Same reasoning as `includes_setnayan_gift` on this
-- same table, where `the-gift-switch-reaches-the-bill.test.ts` asserts the
-- absence of a NOT NULL DEFAULT in as many words: a default records a decision
-- nobody made.
--
-- ⛔ Additive and idempotent. No RLS change — `vendor_proposals` already carries
-- its policies and a new column is covered by them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS service_card_ids JSONB;

COMMENT ON COLUMN public.vendor_proposals.service_card_ids IS
  'The vendor_services leaf ids this quote was built from, as a JSON array of text. NULL = this quote never said (it predates the column, or was written from scratch with no card), and readers must fall back to the thread-wide timestamp rule. An empty array means a genuine from-scratch quote, which supersedes no offer.';
