-- sponsors_join_the_guest_list
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────
-- 👥 SPONSORS JOIN THE GUEST LIST — one list; a sponsor is a guest with the sponsor role.
--
-- ⚖ Owner, brief Add 41 (25 Nov 2026, final check A2-I14): "move sponsors into the guest list. One list; a
-- sponsor is a guest with the sponsor role." The Sponsors page kept a second list (`event_sponsors`) that the guest
-- list, the entourage and the printed invitation never read (`lib/entourage.ts`: roles come from the guest list and
-- nowhere else). From this migration on the Sponsors page reads and writes `guests`; `event_sponsors` stays as a
-- READ-ONLY record (not dropped).
--
-- WHAT THIS DOES — once per `event_sponsors` row that is not already linked to a live guest:
--   1. find the guest it already is (the MATCH RULE below) and LINK to it — never a second row for one person;
--   2. otherwise COPY it into `guests` as that sponsor, and link to the new row.
--
-- 🔑 THE MATCH RULE (held by `apps/web/tests/db/sponsors-join-the-guest-list.db.test.ts`):
--   A sponsor S matches a guest G when G is on the SAME event, is not deleted, and
--     (a) both carry an email and they are equal ignoring case and surrounding spaces, OR
--     (b) S.full_name equals G's "first last" name, OR
--     (c) S.full_name equals G.display_name,
--   where names are compared ignoring case, surrounding spaces and repeated inner spaces.
--   Several matches → an email match first, then the oldest guest row. One guest is picked; never two.
--   A sponsor already linked (`linked_guest_id`) to a live guest is that guest — no search.
--
-- 🔗 LINKING A MATCHED GUEST gives them the sponsor role without taking anything away:
--   their primary role becomes the sponsor role only while it is the plain 'guest'; otherwise the sponsor role is
--   added to `extra_roles` (unless they already hold that tier). Their reply, seat and invitation are untouched.
--
-- 🏷 THE ROLE. cord → cord_sponsor · veil → veil_sponsor · coin → coin_sponsor · candle → candle_sponsor ·
--   principal → principal_sponsor ("not yet specified"). NEVER ninong or ninang: `event_sponsors` does not record
--   which, and the side is not the honorific (owner ruling 2026-09-15, `lib/event-sponsors.ts` sponsorRoleHonorific).
--   Any principal_sponsor* role counts as already holding the principal tier.
--
-- 📋 A COPIED ROW carries what the sponsor row knew: the name (first word / the rest), the side (neutral → both),
--   family, the email, the phone as mobile, the relationship note as notes, the walking pair as entourage_order, and
--   the reply — accepted → attending, declined → declined, anything else → pending — with who set it ('guest': a
--   sponsor's own answer, as `guests.rsvp_set_by` documents) and when, and when they were asked (`sponsor_asked_at`).
--   A principal pair (same pair_index, groom side + bride side) walks together: `pair_with_guest_id`, only where empty.
--
-- ✉ ONE NEW COLUMN, `guests.sponsor_asked_at`: when the couple asked this guest to stand as a sponsor (the Sponsors
--   page's "Mark as sent"). Not `invitation_sent_at` — that is the formal RSVP invitation, with exactly one writer
--   (the Invitation page's per-guest "Mark sent", held by `lib/the-invite-step-counts-what-is-true.test.ts`); being
--   asked to be a sponsor is a different invitation, and stamping that column would make "N to send" fall when nobody
--   sent an RSVP invitation. Writer: `sponsors/actions.ts` · sendInvitation (and the copy below). Reader:
--   `lib/sponsor-guests.ts` · sponsorsFromGuests. `public.guests` carries table-level grants, so the column inherits
--   them; RLS is the table's own. No new table, policy or grant. Runs as the migration owner, so RLS does not apply.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS sponsor_asked_at timestamptz;
COMMENT ON COLUMN public.guests.sponsor_asked_at IS
  'When the couple asked this guest to stand as a sponsor (the Sponsors page''s "Mark as sent"). NULL = not asked yet. '
  'Not invitation_sent_at, which is the formal RSVP invitation and has one writer of its own.';

DO $$
DECLARE
  s            record;
  v_guest      uuid;
  v_role       public.guest_role;
  v_first      text;
  v_last       text;
  v_name       text;
  v_asked      timestamptz;
BEGIN
  FOR s IN
    SELECT es.*
      FROM public.event_sponsors es
     WHERE es.linked_guest_id IS NULL
        OR NOT EXISTS (
             SELECT 1 FROM public.guests lg
              WHERE lg.guest_id = es.linked_guest_id AND lg.deleted_at IS NULL)
     ORDER BY es.event_id, es.pair_index NULLS LAST, es.created_at, es.id
  LOOP
    v_role := CASE s.sponsor_tier
                WHEN 'cord'   THEN 'cord_sponsor'
                WHEN 'veil'   THEN 'veil_sponsor'
                WHEN 'coin'   THEN 'coin_sponsor'
                WHEN 'candle' THEN 'candle_sponsor'
                ELSE 'principal_sponsor'
              END::public.guest_role;
    v_name := lower(regexp_replace(btrim(s.full_name), '\s+', ' ', 'g'));
    -- the sponsor row's "asked" moment → guests.sponsor_asked_at. A row that was ANSWERED was asked, even where no
    -- sent time was recorded — so an accepted sponsor keeps their place on the public "who was there" band.
    v_asked := coalesce(s.invitation_sent_at,
                        CASE WHEN s.invitation_status IN ('accepted', 'declined') THEN coalesce(s.responded_at, s.updated_at) END);

    -- 1 · the match rule
    SELECT g.guest_id INTO v_guest
      FROM public.guests g
     WHERE g.event_id = s.event_id
       AND g.deleted_at IS NULL
       AND (
             (nullif(btrim(s.email), '') IS NOT NULL
              AND lower(btrim(g.email)) = lower(btrim(s.email)))
          OR lower(regexp_replace(btrim(g.first_name || ' ' || g.last_name), '\s+', ' ', 'g')) = v_name
          OR (nullif(btrim(g.display_name), '') IS NOT NULL
              AND lower(regexp_replace(btrim(g.display_name), '\s+', ' ', 'g')) = v_name)
           )
     ORDER BY (nullif(btrim(s.email), '') IS NOT NULL
               AND lower(btrim(g.email)) = lower(btrim(s.email))) DESC,
              g.created_at, g.guest_id
     LIMIT 1;

    IF v_guest IS NOT NULL THEN
      -- 🔗 link: give the sponsor role, take nothing away
      UPDATE public.guests g
         SET role = CASE WHEN g.role = 'guest' THEN v_role ELSE g.role END,
             extra_roles = CASE
               WHEN g.role = 'guest' THEN g.extra_roles
               WHEN g.role = v_role OR v_role = ANY (g.extra_roles) THEN g.extra_roles
               WHEN v_role = 'principal_sponsor'
                    AND (g.role::text LIKE 'principal_sponsor%'
                         OR EXISTS (SELECT 1 FROM unnest(g.extra_roles) r WHERE r::text LIKE 'principal_sponsor%'))
                 THEN g.extra_roles
               ELSE array_append(g.extra_roles, v_role)
             END,
             entourage_order = coalesce(g.entourage_order, CASE WHEN s.sponsor_tier = 'principal' THEN s.pair_index END),
             sponsor_asked_at = coalesce(g.sponsor_asked_at, v_asked),
             updated_at = now()
       WHERE g.guest_id = v_guest;
    ELSE
      -- 📋 copy
      v_first := split_part(btrim(s.full_name), ' ', 1);
      v_last  := nullif(btrim(substr(btrim(s.full_name), length(v_first) + 1)), '');
      INSERT INTO public.guests (
        event_id, first_name, last_name, side, group_category, role,
        email, mobile, notes, entourage_order,
        rsvp_status, rsvp_set_by, rsvp_responded_at, sponsor_asked_at,
        photo_consent, invited_to_blocks, custom_tags)
      VALUES (
        s.event_id,
        coalesce(nullif(v_first, ''), btrim(s.full_name)),
        coalesce(v_last, '—'),
        (CASE s.side WHEN 'bride' THEN 'bride' WHEN 'groom' THEN 'groom' ELSE 'both' END)::public.guest_side,
        'family',
        v_role,
        nullif(btrim(s.email), ''),
        nullif(btrim(s.phone), ''),
        nullif(btrim(s.relationship_note), ''),
        CASE WHEN s.sponsor_tier = 'principal' THEN s.pair_index END,
        (CASE s.invitation_status WHEN 'accepted' THEN 'attending' WHEN 'declined' THEN 'declined' ELSE 'pending' END)::public.rsvp_status,
        CASE WHEN s.invitation_status IN ('accepted', 'declined') THEN 'guest' END,
        CASE WHEN s.invitation_status IN ('accepted', 'declined') THEN s.responded_at END,
        v_asked,
        true,
        ARRAY['ceremony', 'reception']::text[],
        ARRAY[]::text[])
      RETURNING guest_id INTO v_guest;
    END IF;

    UPDATE public.event_sponsors SET linked_guest_id = v_guest, updated_at = now() WHERE id = s.id;
  END LOOP;

  -- 🚶 a principal pair walks together (only where nobody set a partner yet)
  UPDATE public.guests a
     SET pair_with_guest_id = b.linked_guest_id
    FROM public.event_sponsors sa
    JOIN public.event_sponsors b
      ON b.event_id = sa.event_id AND b.sponsor_tier = 'principal' AND b.pair_index = sa.pair_index
     AND b.side <> sa.side AND b.side IN ('groom', 'bride') AND b.linked_guest_id IS NOT NULL
   WHERE sa.sponsor_tier = 'principal' AND sa.pair_index IS NOT NULL AND sa.side IN ('groom', 'bride')
     AND a.guest_id = sa.linked_guest_id
     AND a.pair_with_guest_id IS NULL
     AND b.linked_guest_id <> a.guest_id;
END $$;

COMMENT ON TABLE public.event_sponsors IS
  'READ-ONLY since 20271363480132 (owner, brief Add 41): sponsors live in the guest list — a sponsor is a guest with '
  'a sponsor role. Every row was linked (linked_guest_id) to the guest it is, or copied into guests. Kept as a record; '
  'the app writes guests, never this table.';
