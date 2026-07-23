-- Seed two new Data-Privacy controls for the 2026-07-23 guest-content builds,
-- so the owner (DPO) can Approve / Block them at /admin/data-privacy. Both seed
-- as 'inactive' (fail-closed) — the features AND-gate this control with their
-- env flags (isDataPrivacyControlActive) and stay dark until explicitly
-- approved. Mirrors the catalog in lib/data-privacy-controls.ts (new
-- 'guest_content' board section). ON CONFLICT DO NOTHING keeps any admin edit.
--
-- guest_columns (PR #3583 · env GUEST_COLUMNS_ENABLED, default OFF):
--   Exposes: guest-authored text (title ≤60 + body ≤280) + the guest's byline,
--   published to the couple's PUBLIC guest site and post-event editorial after
--   couple approval. RA 10173 basis: consent captured on every submit
--   (consent_captured_at NOT NULL backstop) + self-serve withdrawal; the
--   PUBLICATION flow still needs /privacy + ROPA coverage (declaredIn: [] —
--   surfaces as drift on the Coverage tab until declared).
--   Activating means: with the env flag also on, guests can submit columns and
--   approved columns render publicly with bylines.
--
-- papic_pool_gallery (PR #3581 · env NEXT_PUBLIC_PAPIC_POOL_GALLERY, default
-- OFF, + the per-event couple toggle events.pool_gallery_open, default FALSE):
--   Exposes: the WHOLE event capture pool (clean-screened photos + clips, web
--   copies only) to EVERY session guest, plus guest self-linking ("I'm in
--   this") via manual_pick photo_tags. RA 10173 basis: the RPC bakes the
--   FaceBlock blur rule + photo_consent veto + web-copy-only keys, and the
--   couple's toggle closes it retroactively; still a NEW event-wide exposure
--   of guests' images that /privacy + ROPA must declare (declaredIn: []).
--   Activating means: with the env flag on AND a couple opening their event's
--   pool, every session guest of that event can browse everyone's captures.

INSERT INTO public.data_privacy_controls (control_key, title, description, category, risk_note, sort_order) VALUES
  ('guest_columns',
   'Guest Columns (guest-authored paper)',
   'Every guest may write ONE short column (title + body, size-capped) for the couple''s paper. The couple approves before publish; approved columns render on the PUBLIC guest site and the post-event editorial with the guest''s byline. Tier-1 moderation screens every submit; the guest can withdraw at any time (RA 10173 self-serve takedown).',
   'Guest-authored public content',
   'Publishes guest-authored text + byline (guest PII) to the open web after couple approval. Consent is captured on every submit, but the live /privacy notice and the ROPA do not declare this publication flow yet — activate only after they cover it and the DPO ruling is on file.',
   160),
  ('papic_pool_gallery',
   'Papic Shared Pool Gallery',
   'Lets every session guest browse the WHOLE event capture pool (clean-screened photos + clips, web copies only) and self-link ("I''m in this") into photos — a manual_pick tag that joins their personal gallery, ZIP download, and Story reel. The couple''s per-event toggle (events.pool_gallery_open, default OFF) still applies on top of this control, and closing it is retroactive.',
   'Event-wide guest media exposure',
   'Widens photo/clip visibility from per-guest tagged delivery to EVERY guest in the event — guests see other guests'' images. The pool read bakes the FaceBlock blur rule, the photo_consent veto, and web-copy-only keys (never the geo-bearing original); still a new exposure surface the /privacy notice and ROPA must declare before this activates. DPO ruling required.',
   170)
ON CONFLICT (control_key) DO NOTHING;
