-- Category photos for the 6 groups and 16 categories that had none
-- (measured 2026-11-06: sample_photo_r2_key IS NULL on every row below).
-- Owner picked the photos 2026-11-06 ("Yes, use them"). Files ship in this
-- PR under apps/web/public/onboarding/refinements/<id>/_main.webp, the same
-- static path shape every existing category photo uses.
--
-- Only fills an EMPTY slot: a photo an admin set in Admin › Categories is
-- never overwritten. Idempotent.
UPDATE public.service_categories AS c
   SET sample_photo_r2_key = '/onboarding/refinements/' || c.id || '/_main.webp'
 WHERE c.id IN ('experience', 'dining', 'logistics_safety', 'insurance', 'event_insurance', 'specialty', 'farewell', 'accommodation', 'travel_honeymoon', 'wedding_paperwork', 'chairs_tents', 'speaker_talent', 'shoes_footwear', 'transfers_rentals', 'tour_activity', 'restaurant_reservation', 'referee_official', 'event_medic', 'reveal_element', 'funeral_home', 'cremation', 'memorial_park')
   AND c.sample_photo_r2_key IS NULL;
