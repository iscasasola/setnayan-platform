-- 🗣 THE CATALOGUE'S OWN WORDS SAY "EVENT" (sweep 2026-10-19, rows B6 · B7).
--
-- /pricing prints `platform_retail_catalog_v2.description` under each SKU and in
-- its schema.org structured data. Two families of active rows still used the
-- retired house word (owner 2026-10-04: say "event", never "celebration"):
--
--   • LIVE_STUDIO (Live Watch) — "Your celebration, streamed live for everyone
--     who can't be there. …" — the visible line under the Live Watch price.
--   • PAPIC_GUEST and every PAPIC_GUEST_<n> rung — "Adds N credits to the
--     celebration's shared pot. …" — read by /pricing's structured data.
--
-- ⚠ THESE ROWS ARE ADMIN-MANAGED (the description is editable in /admin/pricing),
-- so this does NOT overwrite them with a fresh literal. `replace()` swaps only the
-- word, in whatever text the row holds today, and leaves every other admin edit
-- alone. Case-sensitive on purpose: the inactive SETNAYAN_AI_C row names an event
-- TYPE called "Celebration" (capital C), which is a real type name, not the word —
-- and it is not in the WHERE anyway.
--
-- Data only: no table, column, policy or function changes. No price moves.
-- Idempotent: once no lowercase "celebration" remains, the WHERE matches nothing.

UPDATE public.platform_retail_catalog_v2
   SET description = replace(description, 'celebration', 'event'),
       updated_at  = NOW()
 WHERE (service_code = 'LIVE_STUDIO' OR service_code ~ '^PAPIC_GUEST(_[0-9]+K?)?$')
   AND description LIKE '%celebration%';
