-- gown_fabric_types_v207
-- Gown maker prototype v207 (2026-11-28, "Fabric feel"): three new fabric types, Duchess satin, Bias satin and Taffeta,
-- as rows in the admin Fabric-types registry (step B5b). Coordinator ruling 28 Nov: existing columns only, no new
-- columns. The prototype's FEEL card numbers that have no column (foldCm, foldD, sharp, edge, swing, shine type, and
-- bias satin's metres multiplier) stay in code; the multiplier lives in apps/web/lib/gown-maker.ts
-- (GOWN_FABRIC_METRES_MULT).
--
-- From the FEEL card: gsm → gsm · stiff → stiff · gloss → sheen · see → sheer · stretch → stretch.
-- family and used_for follow each card's own why-line. Every row is verified = FALSE ("Values to check") until checked
-- against a source (corpus D26 / step B16), the same as the original 15.
--
-- Duchess satin had been an ALIAS of plain satin ('duchess satin', 'duchesse'). It is its own type now, so the two
-- aliases move to it; a swatch book labelled "Duchess" then finds the right cloth. Only the seed's own aliases are
-- removed, so an admin's later edit to satin's aliases is kept.
--
-- Idempotent: ON CONFLICT DO NOTHING, and array_remove is a no-op once the aliases are gone. No money here.

INSERT INTO public.gown_fabric_types (type_id, name, aliases, family, gsm, stiff, sheen, sheer, stretch, used_for, render_as, sort, verified)
VALUES
  ('duchess',    'Duchess satin', ARRAY['duchess satin', 'duchesse', 'duchesse satin'], 'satins',     240, 0.65, 0.62, 0.00, 'none', ARRAY['gown_body', 'skirt'],               NULL, 12, FALSE),
  ('bias_satin', 'Bias satin',    ARRAY['bias-cut satin', 'liquid satin'],             'satins',     110, 0.12, 0.85, 0.00, 'none', ARRAY['gown_body', 'skirt', 'entourage'],  NULL, 14, FALSE),
  ('taffeta',    'Taffeta',       ARRAY['silk taffeta', 'polyester taffeta'],          'structured', 140, 0.70, 0.60, 0.00, 'none', ARRAY['gown_body', 'skirt', 'entourage'],  NULL, 25, FALSE)
ON CONFLICT (type_id) DO NOTHING;

UPDATE public.gown_fabric_types
   SET aliases = array_remove(array_remove(aliases, 'duchess satin'), 'duchesse')
 WHERE type_id = 'satin'
   AND aliases && ARRAY['duchess satin', 'duchesse']::TEXT[];

COMMENT ON TABLE public.gown_fabric_types IS
  'Gown maker (2026-11-27): the fabric-type registry every shop''s fabric points at — how a cloth hangs and shines (gsm, stiff, sheen, sheer, stretch), its family, what it is used for, and which stock type it renders as. Seeded with the prototype''s 15 (v186 FABRICS; family and used_for from corpus fabric-types-research.md), plus Duchess satin, Bias satin and Taffeta (v207), all verified = FALSE. Everyone signed in reads it; Setnayan admin only edits it (owner Q4, 2026-11-27) — through the service role from the admin console, never a shop. Code fallback: lib/gown-config.ts GOWN_STOCK_FABRICS. Hide (active = FALSE), never delete.';
