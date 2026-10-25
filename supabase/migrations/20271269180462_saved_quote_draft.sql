-- saved_quote_draft
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- A SAVED QUOTE KEEPS ITS LINES (simpler supplier dashboard step 4, 2026-10-14).
--
-- Owner, completeness pass on the supplier's custom quote: "Start from a saved quote" stays
-- (vendor_proposal_templates; hidden when the supplier has none), and the quote screen gains
-- "Save this quote · reuse it next time". A template row holds a name, a body, terms and a
-- package — never the quote's lines, crew meal, transport, discount, payment plan or how long
-- it is good for. So a quote saved from the builder could only come back as its note.
--
-- ONE nullable column on the existing table. NULL = a template written the old way (name ·
-- body · terms · package), which keeps working exactly as before: the builder seeds it from its
-- package and its body. The shape is `lib/saved-quote.ts` (`SavedQuoteDraft`, version 1); a read
-- is parsed there as untrusted and anything unreadable is ignored.
--
-- RLS: unchanged — `vendor_proposal_templates_org_all` (pattern: own org, FOR ALL) already covers
-- every column of the row. No grant change: the table's grants are table-level.

ALTER TABLE public.vendor_proposal_templates
  ADD COLUMN IF NOT EXISTS quote_draft jsonb;

-- An object or nothing (a stray array / scalar is a writer's bug, refused at the door), and
-- bounded — a template is a quote, not a catalogue.
ALTER TABLE public.vendor_proposal_templates
  DROP CONSTRAINT IF EXISTS vendor_proposal_templates_quote_draft_shape;
ALTER TABLE public.vendor_proposal_templates
  ADD CONSTRAINT vendor_proposal_templates_quote_draft_shape
  CHECK (
    quote_draft IS NULL
    OR (jsonb_typeof(quote_draft) = 'object' AND octet_length(quote_draft::text) <= 65536)
  );

COMMENT ON COLUMN public.vendor_proposal_templates.quote_draft IS
  'The builder''s saved quote (lib/saved-quote.ts SavedQuoteDraft v1): lines, crew, transport, discount + reason, payment plan, good-for days, note. NULL = an old-style template (body/terms/package).';
