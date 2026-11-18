-- The house word is "event", never "celebration" (W5-B4, 2026-11-18). Two /start card taglines still said it.
-- Guarded on the OLD text so an admin-edited tagline (/admin/event-types) is never overwritten. Idempotent.
BEGIN;

UPDATE public.event_type_vocab
   SET description = 'Another year, with your people.'
 WHERE event_type = 'birthday'
   AND description = 'Another year, celebrated.';

UPDATE public.event_type_vocab
   SET description = 'A formal evening — awards nights, fundraisers, and black-tie events.'
 WHERE event_type = 'gala_night'
   AND description = 'A formal evening — awards nights, fundraisers, and black-tie celebrations.';

COMMIT;
