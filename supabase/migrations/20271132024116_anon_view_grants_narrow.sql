-- Narrow the anon/authenticated grants on the public views, and make the
-- public dated track record honour a fraud void.
--
-- Verified against PROD (njrupjnvkjkitfctetvi) on 2026-08-11 by reading
-- pg_class.relacl directly. Three things were true and none of them are
-- visible from information_schema:
--
--   1. information_schema.role_table_grants DOES NOT REPORT MATERIALIZED
--      VIEWS AT ALL. A grant audit run through information_schema silently
--      omits every matview -- it reports an absence, not a refusal. The
--      authoritative read is pg_class.relacl. (Same disease as the phantom
--      column / phantom enum value / blocked iframe: the only symptom is
--      something missing.)
--
--   2. `vendor_full_completed_events_stats` was granted to `anon`. Its own
--      docblock in lib/vendor-profile.ts says the opposite:
--        "`full_completed_count` is the unfiltered sibling. Only the
--         vendor's own backend card reads this when their toggle is ON."
--      It is the deliberately-UNREDACTED twin of
--      `vendor_public_completed_events_stats`, which exists precisely
--      because team / internal / self-comp / fraud-voided bookings must not
--      be counted in public. Granting BOTH to anon let a signed-out stranger
--      diff the two numbers and derive exactly how many of a vendor's
--      bookings Setnayan had filtered out as self-dealt or fraudulent --
--      i.e. it published our own integrity findings about that vendor.
--      A matview can never honour RLS, so the grant IS the access control.
--
--   3. Every anon grant here was `arwdDxtm` (ALL PRIVILEGES), not SELECT.
--      That is inert today only because none of these views is
--      auto-updatable (verified: information_schema.views.is_updatable='NO'
--      for all four), so Postgres refuses the write regardless. It is the
--      default-ACL footgun though: the day someone adds a simple
--      single-table view here it becomes auto-updatable and those inherited
--      write bits go live. Tightened to SELECT.
--
-- DELIBERATELY NOT CHANGED:
--   * `events_host` -- it looks alarming (a view over all ~190 columns of
--     `events`, security_invoker=false, granted to authenticated) but it is
--     CORRECT: it re-implements the scoping in its own WHERE clause
--     (current_couple_event_ids() / current_moderator_event_ids() /
--     service_role). That is how a security-definer view is supposed to be
--     written. Revoking it would break every couple's dashboard.
--   * security_invoker on the public vendor views. Turning it ON would make
--     RLS apply to the caller, and anon would then read nothing -- breaking
--     the public shop page's track record on purpose-built public data.
--     These are intentional security-definer aggregates.

BEGIN;

-- 1. The unredacted count stops being public. Its only reader in the whole
--    repo is fetchVendorCompletedEventStats(), which has ZERO callers, so
--    nothing observable changes today. `authenticated` keeps SELECT because
--    that is the documented consumer (the vendor's own backend card).
--    RESIDUAL, deliberately left: a matview cannot honour RLS, so any signed
--    -in user could still read any vendor's full count. Closing that needs an
--    RLS-capable wrapper (security-invoker view or a function keyed to the
--    caller's vendor_profile_id), which is a design change, not a grant flip.
REVOKE ALL ON public.vendor_full_completed_events_stats FROM anon;
REVOKE ALL ON public.vendor_full_completed_events_stats FROM authenticated;
GRANT SELECT ON public.vendor_full_completed_events_stats TO authenticated;

-- 2. A fraud void must reach the public dated list, not just the public count.
--    executeFraudWipeBan() in app/admin/fraud/actions.ts asserts, verbatim:
--        "Soft-delete via voided_by_fraud so the evidence trail survives"
--        "(the vetted views already exclude voided rows)"
--    `vendor_public_completed_events_stats` honours that (it carries
--    `AND ev.voided_by_fraud = false`). `vendor_completed_events` -- the
--    dated list rendered on the SAME shop page -- never has. So the count and
--    the list it sits beside disagree by exactly the voided bookings.
--    LATENT rather than live: the only writer of the flag is the fraud wipe,
--    which also hides the vendor in the same transaction, so the shop page is
--    unreachable afterwards. It still reaches the vendor's own track-record
--    panel, and it is wrong the moment the flag gets a second writer or a
--    vendor is un-hidden on appeal. Column list and order are unchanged, so
--    CREATE OR REPLACE is safe and existing grants are preserved.
CREATE OR REPLACE VIEW public.vendor_completed_events AS
SELECT vp.vendor_profile_id,
    ev.vendor_id,
    ev.event_id,
    e.event_type,
    e.event_date,
    COALESCE(ev.updated_at, e.event_date::timestamp with time zone) AS completed_at
   FROM vendor_profiles vp
     JOIN event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND ev.voided_by_fraud = false
     JOIN events e ON e.event_id = ev.event_id AND e.archived = false
  WHERE NOT (EXISTS ( SELECT 1
           FROM event_members em
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND em.user_id = vp.user_id))
    AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN vendor_team_members vtm ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type))
    AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN users u ON u.user_id = em.user_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND u.is_internal = true
            AND (u.user_id = vp.user_id OR (EXISTS ( SELECT 1
                   FROM vendor_team_members vtm2
                  WHERE vtm2.vendor_profile_id = vp.vendor_profile_id AND vtm2.user_id = u.user_id)))))
    AND NOT (EXISTS ( SELECT 1
           FROM comp_grants cg
          WHERE cg.vendor_profile_id = vp.vendor_profile_id AND cg.source = 'vendor_self_comp'::text
            AND (cg.order_id = ev.vendor_id OR (EXISTS ( SELECT 1
                   FROM event_members em3
                  WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'::member_type AND em3.user_id = cg.created_by_user_id)))));

COMMENT ON VIEW public.vendor_completed_events IS
  'Public dated track record: one row per event this vendor delivered THROUGH '
  'Setnayan. Excludes self-dealt / team / internal / self-comp bookings AND '
  'fraud-voided ones, matching vendor_public_completed_events_stats exactly. '
  'Security-definer on purpose (anon must be able to read it); the WHERE '
  'clause is the access control. If you add an exclusion here, add it to '
  'vendor_public_completed_events_stats too -- the count and this list are '
  'rendered side by side on the vendor shop page and must not disagree.';

-- 3. Drop the inherited write bits everywhere anon/authenticated can read.
--    SELECT is all any of these ever needed. service_role keeps ALL (it
--    refreshes the matviews).
REVOKE ALL ON public.vendor_completed_events FROM anon, authenticated;
GRANT SELECT ON public.vendor_completed_events TO anon, authenticated;

REVOKE ALL ON public.vendor_active_ads FROM anon, authenticated;
GRANT SELECT ON public.vendor_active_ads TO anon, authenticated;

REVOKE ALL ON public.vendor_active_tools FROM anon, authenticated;
GRANT SELECT ON public.vendor_active_tools TO anon, authenticated;

REVOKE ALL ON public.vendor_market_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_market_stats TO anon, authenticated;

REVOKE ALL ON public.vendor_public_completed_events_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;

REVOKE ALL ON public.vendor_review_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_review_stats TO anon, authenticated;

REVOKE ALL ON public.vendor_trusted_review_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;

COMMIT;
