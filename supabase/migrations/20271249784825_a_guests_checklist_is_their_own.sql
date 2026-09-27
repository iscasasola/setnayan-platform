-- ════════════════════════════════════════════════════════════════════════════
-- A GUEST'S CHECKLIST IS THEIR OWN (guest pathway, item 6 · owner 2026-09-26)
--
-- Owner, verbatim: *"also. on the event hub invitation. When we are on the
-- countdown to the last 30 days. remind each guest of what they need. the
-- clothes they need? motif? etc."* → *"something interactive they can mark
-- checked if those are ready"*.
--
-- DECISION_LOG 2026-09-26 "THE GUEST CHECKLIST IS INTERACTIVE": each item is a
-- tick; ticks are saved to the GUEST (they follow them to a new phone / their
-- account), PRIVATE to the guest (the couple sees no per-guest ticks).
--
-- ── WHY A TABLE AND NOT A COLUMN ON `guests` ─────────────────────────────────
-- `guests` is readable by the couple under RLS (row-level), and Supabase grants
-- every column of a public table to `anon`/`authenticated` — a column added
-- there would be readable by the couple through PostgREST, and RLS cannot hide
-- one column of a row it lets through. "Private to the guest" is only true by
-- construction in a table no browser role can read at all: RLS ENABLED, NO
-- policy, every grant revoked. The guest's own page reads and writes it with
-- the service role, keyed on the guest the signed guest pass names — the same
-- trust model as the reply (`submitRsvp`).
--
-- Keys are the item names the page draws (`wear`, `motif`, `arrive`, `table`,
-- `pass`) — text, so a later item needs no migration; the page ignores any key
-- it does not draw.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.guest_checklist_ticks (
  guest_id   uuid PRIMARY KEY REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  ticks      text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_checklist_ticks_small CHECK (cardinality(ticks) <= 16)
);

CREATE INDEX IF NOT EXISTS guest_checklist_ticks_event_idx
  ON public.guest_checklist_ticks (event_id);

ALTER TABLE public.guest_checklist_ticks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.guest_checklist_ticks IS
  'Guest pathway item 6 (owner 2026-09-26): the last-30-days "Your checklist" ticks, saved to the GUEST and private to them — the couple sees no per-guest ticks. Service-role only: RLS enabled, NO policy, all grants revoked. Written by submitRsvp''s checklist branch (app/[slug]/actions.ts) for the guest the signed guest pass names.';

REVOKE ALL ON TABLE public.guest_checklist_ticks FROM anon;
REVOKE ALL ON TABLE public.guest_checklist_ticks FROM authenticated;
