-- RW-65 (walk 13 Nov 2026): the create-event tile for the simple type (shown as "Get-together") read
-- "No vendors, no marketplace." The product's word is "supplier", and "marketplace" is an internal word.
--
-- Data only, and GUARDED: the row is admin-managed (Admin › Event types), so it is changed ONLY while it still holds the
-- text its seed wrote (20270307127948). An admin's own wording is never overwritten. Idempotent: a second run matches
-- nothing.
UPDATE public.event_type_vocab
   SET description = 'A lightweight event — pick a date and use Setnayan''s in-app services. No suppliers to book.'
 WHERE event_type = 'simple_event'
   AND description = 'A lightweight event — pick a date and use Setnayan''s in-app services. No vendors, no marketplace.';
