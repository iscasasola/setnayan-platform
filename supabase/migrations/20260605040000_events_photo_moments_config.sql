-- Photo moments config: host-curated phone-down moments shown on the
-- public landing page at /[slug]. Replaces the hardcoded sample list
-- (Ceremony · The Bridal Walk · etc.) baked into PhotoMomentsWidget on
-- apps/web/app/[slug]/page.tsx with host-authored content.
--
-- Co-dispatched with Hero Photo, Dress Code, and Privacy editors (all
-- 2026-05-22 same-day) — each one swaps a hardcoded /[slug] section
-- for a host-editable surface, hub-linked from
-- /dashboard/[eventId]/website. Photo Moments is the camera-guidance
-- card: when to enjoy phone-down, when to shoot freely, and which beats
-- the couple's paparazzo (iteration 0012) will own.
--
-- JSONB shape:
--   {
--     "intro_copy": "Optional 240-char intro paragraph the host writes",
--     "moments": [
--       {
--         "time_label": "3:00 PM · Ceremony",
--         "title":      "The Bridal Walk",
--         "note":       "Processional · everyone stands",
--         "mode":       "phone_down" | "camera_ok" | "papic_only"
--       }
--     ]
--   }
--
-- Default empty object means "host has not curated yet" → landing page
-- renders the polite fallback ("Your hosts will share their photo
-- guidance closer to the wedding") instead of the prior hardcoded
-- ceremony/reception/first-entrance trio.
--
-- Server action at apps/web/app/dashboard/[eventId]/website/photo-moments/actions.ts
-- enforces: max 8 entries, intro_copy ≤ 240 chars, time_label ≤ 60
-- chars, title ≤ 80 chars, note ≤ 200 chars, mode constrained to the
-- 3-value enum above. NOT NULL DEFAULT '{}' so reads never need to
-- defensively coalesce — the column always exists.
--
-- Idempotent via ADD COLUMN IF NOT EXISTS so re-applies are safe.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_moments_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.photo_moments_config IS
  'Host-curated phone-down moments shown on the public landing page. Shape: { intro_copy: text (≤240), moments: [{ time_label: text (≤60), title: text (≤80), note: text (≤200), mode: enum(camera_ok | phone_down | papic_only) }] }. Max 8 moments. Empty {} = host has not yet curated, landing page renders polite fallback copy. Setter UI lives at /dashboard/[eventId]/website/photo-moments. Replaces the hardcoded PhotoMomentsWidget sample list on apps/web/app/[slug]/page.tsx.';
