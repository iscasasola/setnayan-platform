-- events recap social optout at
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--
-- Social Sharing follow-through #2 (2026-07-16) — couple opt-OUT of Setnayan
-- re-posting a PUBLISHED recap to Setnayan's OWN Facebook / Instagram.
--
-- lib/social/recap-post.ts composes a source_type='event_recap' social_posts
-- row when a couple publishes their recap; lib/social/flush.ts dispatches it to
-- Setnayan's Page/IG. Owner ruling: "everything public initially, then they can
-- set it private" → the DEFAULT stays opt-IN (NULL = allowed), but the couple
-- gets one clear, revocable opt-out. A single stamp, NOT a per-artifact consent
-- row (that's marketing_share_consents, a different grant): this is one boolean.
--
--   NULL      → allowed (default)      — Setnayan MAY feature the recap
--   timestamp → opted OUT (stamped now) — never composed / never dispatched
--
-- Do NOT conflate with events.public_summary_consent_at (that gates the
-- /realstories index, a different surface). RLS on public.events already scopes
-- reads/writes to the event's members — no new policy is needed for one more
-- nullable column on the same table.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recap_social_optout_at timestamptz;

COMMENT ON COLUMN public.events.recap_social_optout_at IS
  'Social follow-through #2: when set, the couple opted this event''s published recap OUT of Setnayan''s own FB/IG re-post. NULL = allowed (default). Not a marketing_share_consents grant — one per-event opt-out.';
