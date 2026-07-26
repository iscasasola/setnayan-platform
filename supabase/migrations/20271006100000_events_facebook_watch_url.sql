-- events_facebook_watch_url — the second live destination.
--
-- DUAL-STREAM (owner-approved 2026-07-26): a couple may push the same OBS program
-- output to YouTube AND Facebook at the same time and show both doors on their
-- event page. The duplication happens on THEIR laptop (the free obs-multi-rtmp
-- plugin), so there is nothing to build on the streaming side and no Meta API,
-- OAuth or app review anywhere in this feature — the couple pastes a URL.
--
-- One nullable TEXT on events, the exact mirror of panood_watch_url
-- (20261122000000): the canonical Facebook watch URL, written by the host-guarded
-- setup actions after lib/facebook-watch.ts normalizes-or-rejects it, and
-- re-normalized again on READ before it reaches an href.
--
-- ⚠ FACEBOOK IS A LINK, NEVER AN EMBED. next.config.ts pins frame-src to
-- youtube-nocookie / youtube / vimeo / instagram / tiktok; facebook.com is not on
-- that list and is not being added. The only Meta embed (plugins/video.php) would
-- put Meta cookies on a public wedding page, which is exactly what the
-- youtube-nocookie choice exists to avoid.
--
-- RLS: no new policies. events UPDATE is already host-scoped
-- (couple_can_update_event, TO authenticated). Reads go through the admin client
-- like every other public landing column — the URL is, by definition, a public
-- watch link.
--
-- Additive + idempotent; safe on a live database.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS panood_watch_url_facebook TEXT;

COMMENT ON COLUMN public.events.panood_watch_url_facebook IS
  'Canonical Facebook Live watch URL for the couple''s simultaneous Facebook broadcast (normalized by lib/facebook-watch.ts). NULL = not published. Rendered as a LINK on the event page during the live window — never an iframe (facebook.com is deliberately absent from frame-src). Meta deletes live replays after ~30 days, so this is never the archival copy; panood_watch_url (YouTube) is.';

-- ============================================================================
-- ⚠ THE 20271005100000 GRANT TRAP — this block is NOT optional.
--
-- Migration 20271005100000_events_column_update_privileges.sql REVOKEd
-- table-level UPDATE/INSERT on public.events from authenticated + anon and
-- granted back a COMPUTED allow-list ("every column MINUS the deny-set"),
-- snapshotted at APPLY TIME. Its own maintenance note spells out the
-- consequence: a column added AFTER it is not in that snapshot, so it is
-- service-role-writable only, and a host's save silently writes nothing.
-- Fail-closed, which is safe — and invisible, which is why it needs a test.
--
-- The fix is the exact GRANT that migration prescribes.
--
-- ── WHY `authenticated` ONLY, WHERE THE SIBLING COLUMN ALSO HAS `anon` ──────
-- panood_watch_url carries an anon grant only as an artifact: 20271005100000
-- re-granted the blanket pre-existing state minus its deny-set, and anon was in
-- that blanket state. Nothing needs it. EVERY write policy on public.events —
-- authenticated_can_create_event, couple_can_update_event — is `TO authenticated`,
-- so the anon role cannot write any events row under any circumstance (a Supabase
-- *anonymous user* holds a real `authenticated` JWT and is unaffected; see
-- 20270823141500). Granting a new column to anon would add surface for zero
-- capability, so this one is granted narrower than its sibling on purpose. The
-- post-condition below asserts BOTH halves of that claim.
-- ============================================================================
GRANT UPDATE (panood_watch_url_facebook), INSERT (panood_watch_url_facebook)
  ON public.events TO authenticated;

-- ----------------------------------------------------------------------------
-- Post-condition — assert against the REAL catalog, so a grant that silently
-- did not take fails the migration instead of shipping a dead save button.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events',
                              'panood_watch_url_facebook', 'UPDATE') THEN
    bad := array_append(bad, 'authenticated-cannot-update');
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events',
                              'panood_watch_url_facebook', 'INSERT') THEN
    bad := array_append(bad, 'authenticated-cannot-insert');
  END IF;
  IF has_column_privilege('anon', 'public.events',
                          'panood_watch_url_facebook', 'UPDATE') THEN
    bad := array_append(bad, 'anon-can-update');
  END IF;
  -- The sibling must be untouched — this migration must not disturb the live
  -- YouTube path in either direction.
  IF NOT has_column_privilege('authenticated', 'public.events',
                              'panood_watch_url', 'UPDATE') THEN
    bad := array_append(bad, 'youtube-column-lost-host-write');
  END IF;
  IF NOT has_table_privilege('service_role', 'public.events', 'UPDATE') THEN
    bad := array_append(bad, 'service_role-lost-update');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'facebook watch-url grant post-condition failed: %',
      array_to_string(bad, ', ');
  END IF;
END $$;
