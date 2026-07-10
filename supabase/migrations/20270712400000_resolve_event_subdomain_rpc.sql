-- Paid event-subdomain resolver (owner 2026-07-10 · EVENT_SUBDOMAIN ₱999/yr).
-- Maps a subdomain label (`juanandmaria` from juanandmaria.setnayan.com) → the
-- couple's event page at bare `/{slug}`, but ONLY when that event owns an active,
-- non-expired EVENT_SUBDOMAIN order. Edge middleware calls this before the free
-- vendor-subdomain rewrite; a NULL return falls through to the vendor path.
--
-- Mirrors resolve_custom_domain (20270425396165): SECURITY DEFINER + STABLE +
-- search_path pinned + granted to anon/authenticated (the edge caller uses the
-- anon key). Expiry is checked inline (o.expires_at) so a lapsed subdomain stops
-- resolving with no sweep — same lazy-expiry philosophy as user_ai_subscription.
CREATE OR REPLACE FUNCTION public.resolve_event_subdomain(p_label TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT '/' || e.slug
  FROM public.events e
  WHERE LOWER(e.slug) = LOWER(p_label)
    AND e.slug IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.event_id = e.event_id
        AND o.service_key = 'EVENT_SUBDOMAIN'
        AND o.status IN ('paid', 'fulfilled')
        AND (o.expires_at IS NULL OR o.expires_at > now())
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_event_subdomain(TEXT) TO anon, authenticated;
