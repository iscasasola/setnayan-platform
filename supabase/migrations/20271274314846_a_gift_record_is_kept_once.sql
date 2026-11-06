-- ═══════════════════════════════════════════════════════════════════════════
-- A GIFT RECORD IS KEPT ONCE — event day, no double records (L1·4)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🪤 WHAT WAS WRONG. "I sent it" (`recordGift`, apps/web/lib/gift-record.server.ts)
-- inserted one `event_gift_records` row per request. A guest whose answer was
-- lost on bad signal taps Send again: the same ₱2,000 is counted twice, and the
-- wish it names can reach its price — and be marked "got" — on money that was
-- only said once.
--
-- ✅ THE FIX. The gift sheet mints `client_ref` once per sheet and sends it
-- with every Send from that sheet. UNIQUE (giver_guest_id, client_ref): the
-- second arrival of one Send cannot become a second row, and `recordGift`
-- answers it with the first record. NULL on every row written before.

ALTER TABLE public.event_gift_records
  ADD COLUMN IF NOT EXISTS client_ref UUID;

COMMENT ON COLUMN public.event_gift_records.client_ref IS
  'The id the guest''s gift sheet minted for this Send and re-sends on a retry. UNIQUE per giver: one Send is one record, counted once toward its wish (event-day L1·4). NULL on rows written before it existed.';

CREATE UNIQUE INDEX IF NOT EXISTS event_gift_records_client_ref_uniq
  ON public.event_gift_records (giver_guest_id, client_ref)
  WHERE client_ref IS NOT NULL;
