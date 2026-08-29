-- one_way_to_buy_a_challenge
-- ============================================================================
-- OWNER 2026-08-29, verbatim: **"vendors only purchase papic challenges for a
-- 4-week subscription."**
--
-- The BUY path already matched — nothing has been able to buy a per-event
-- sponsorship since 20271181420277. What did not match is the ENTITLEMENT: that
-- migration kept a second arm honouring a legacy ₱400 `papic_photo_challenge_
-- sponsorships` row, on the reasoning that a repricing must never retroactively
-- unsell something somebody had already bought. That reasoning was right and the
-- arm is now provably dead:
--
--   • ZERO rows in production, ever. Nobody bought one.
--   • ZERO writers left anywhere. `activatePhotoChallengeSponsorship` stamps the
--     28-day window on vendor_profiles now; the free-cycle path does the same;
--     the table has no INSERT policy and no other caller.
--
-- ⇒ A read arm whose only writer is gone can never be true. Keeping it leaves
--   the gate saying something the owner's rule does not: that there are TWO ways
--   to be entitled. There is one.
--
-- 🔑 THE SHAPE, because this repo keeps meeting it from the other side: this is
--   a GATE WITH NO HANDLE inverted. The usual instance is a column nothing
--   writes, so a feature is permanently off and looks unused. This is a
--   PERMISSION nothing can grant — same absent writer, and it reads as a
--   deliberate second door rather than as debt. Both are found the same way:
--   grep for the WRITER, not for the column.
--
-- ⛔ THE TABLE IS NOT DROPPED, and that is deliberate rather than timid. Its
--   RLS policies, grants and indexes are inert with nothing reading them, and
--   dropping a table is a one-way act that this migration does not need to
--   perform to make the rule exact. It is NAMED AS DEBT here instead of being
--   removed in a change about a pricing rule.
--
-- Diff against the live `vendor_papic_challenge_entitled`: the second EXISTS
-- goes, and with it the `p_event_id` parameter's only remaining use. The
-- SIGNATURE IS DELIBERATELY UNCHANGED — both callers pass an event id, and
-- changing the argument list of a function two SECURITY DEFINER RPCs call means
-- dropping and recreating it, which drops its grants with it. The parameter is
-- kept and documented as accepted-and-ignored, because entitlement may become
-- per-celebration again the day the owner says so.
--
-- Idempotent: CREATE OR REPLACE only.
--
-- ⚠ COPIED FROM THE LIVE OBJECT (`pg_get_functiondef`, read 2026-08-29), never
--   from the migration that created it. That rule is two days old and was
--   learned the hard way, twice, in the migration this one amends.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_papic_challenge_entitled(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- ONE way in: a live 28-day subscription, which covers every celebration the
  -- shop is booked for (owner 2026-08-29). `p_event_id` is accepted and ignored
  -- — see the header for why the signature is not narrowed.
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.papic_challenge_expires_at IS NOT NULL
       AND vp.papic_challenge_expires_at > NOW()
  );
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge? TRUE only for a live 28-day subscription (vendor_profiles.papic_challenge_expires_at). Owner 2026-08-29: "vendors only purchase papic challenges for a 4-week subscription" — the legacy per-event papic_photo_challenge_sponsorships arm was removed here, having had zero rows and zero writers. p_event_id is accepted and IGNORED: the signature is kept so the two SECURITY DEFINER RPCs that call this keep their grants, and so entitlement can become per-celebration again without a drop/recreate. THE SINGLE definition — called by papic_create_vendor_challenge (authoring) and papic_vendor_challenge_photos (delivery), which drifted apart once when a CREATE OR REPLACE rebased on a pre-paywall body.';

COMMENT ON TABLE public.papic_photo_challenge_sponsorships IS
  'RETIRED 2026-08-29 and kept empty. Held the ₱400 per-event Papic Challenge sponsorship until the owner repriced it to a ₱2,500 / 28-day shop subscription (20271181420277), after which nothing writes it and — since 20271182071895 — nothing reads it. It never held a row in production. NOT dropped in a pricing change; dropping it is its own decision. Do not write to it: the entitlement is vendor_profiles.papic_challenge_expires_at.';

COMMIT;
