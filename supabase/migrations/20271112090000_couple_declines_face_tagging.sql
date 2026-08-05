-- The couple can decline face tagging on their own wedding.
--
-- ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
-- Face tagging is optional at every level except the one that matters most.
--
--   · A GUEST chooses: the enrolment block is skippable, the RSVP submits
--     without it, and no descriptor is stored unless they tick consent AND
--     affirm 18+. That has always been true and is not changed here.
--   · An ADMIN chooses, per event, via `papic_face_mode` (2026-08-04).
--   · The COUPLE could not choose at all.
--
-- Their wedding, their guests — and no lever. This is that lever.
--
-- ── IT CAN ONLY EVER NARROW ─────────────────────────────────────────────────
-- The effective mode becomes `admin says mode_a` AND `the couple has not
-- declined`. A couple can turn face tagging OFF for their event; they cannot
-- turn it on where an admin has not, and they cannot override the
-- christening/debut lock. So this column can only ever reduce what is
-- collected, which is why it needs no approval step of its own.
--
-- ── WHY THE COUPLE DOES NOT WRITE IT DIRECTLY ───────────────────────────────
-- `events` UPDATE is column-privileged (migration 20271005100000) and this
-- column is deliberately NOT added to the `authenticated` allowlist: `events`
-- UPDATE RLS is row-level, so a writable column on that table is writable by
-- anyone who can update the row at all. The couple sets it through a server
-- action that checks their membership first — the same shape as the livestream
-- audience switch.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS face_tagging_declined_by_couple boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.face_tagging_declined_by_couple IS
  'The couple has declined face tagging for their own event. NARROWS ONLY: the '
  'effective mode is papic_face_mode=mode_a AND NOT this. A couple cannot turn '
  'face tagging on, only off, and cannot override the christening/debut lock. '
  'Written by setCoupleFaceTaggingDeclined (service-role, membership-checked) '
  'because events UPDATE is column-privileged and row-level. Added 2026-08-05: '
  'face tagging was optional for the guest and for the admin, and not for the '
  'couple whose guests they are.';
