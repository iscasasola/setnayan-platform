-- ============================================================================
-- event_appointments.previous_scheduled_at — a meeting that moved can say so
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- The Decisions view of a conversation shows WHERE EACH CARD STANDS NOW, and
-- its named example is a meeting that moved: the old time struck through, the
-- new one beside it.
--
-- That was undrawable. `respondToAppointment`'s `propose_new` branch
-- (apps/web/app/_components/appointments-actions.ts) does:
--
--     update.scheduled_at = newAt;
--
-- — an OVERWRITE. It posts no chat message, writes no history row, and the
-- table has no audit trail. So the instant anyone proposed a new time, the old
-- one was destroyed and nothing in the database could ever say what a meeting
-- moved FROM. The design drew a strike-through over data that did not exist.
--
-- One nullable column fixes it, written in the same statement that overwrites
-- the value it preserves.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
-- Additive and nullable, so every existing row is valid unchanged. NULL means
-- "never moved" — which is the truth for every meeting made before this lands,
-- and the renderer prints no strike-through for it rather than inventing one.
--
-- No RLS change: `event_appointments` policies are row-scoped (event member ∩
-- vendor org), never column-scoped, so a new column inherits the table's
-- existing grants and needs no policy rebuild.
--
-- ⚠ BUT INHERITING GRANTS IS ITSELF AN EXPOSURE CHANGE, and the freeze guard
-- says so: this column arrives `anon=SIU authenticated=SIU`, identical to all
-- 24 columns already on the table — including `scheduled_at`, the value it
-- shadows. `supabase/security/exposure-surface.baseline.txt` gains exactly one
-- line for it. Narrowing THIS column alone was considered and rejected twice
-- over: it would be inconsistent with the column it mirrors, and the writer
-- (`respondToAppointment`) updates under the caller's own session, so revoking
-- UPDATE would break the reschedule it exists to record.
--
-- 🔑 CONSEQUENCE WORTH KNOWING: a party to an appointment can therefore write
-- this column directly over REST and fake a "moved from" time. That is not a
-- new class of risk — the same party can already rewrite `scheduled_at` the
-- same way — but it does mean the strike-through is a CONVENIENCE, not
-- evidence. Do not build anything that treats it as proof.
--
-- Idempotent + re-run safe.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_appointments
  ADD COLUMN IF NOT EXISTS previous_scheduled_at timestamptz;

COMMENT ON COLUMN public.event_appointments.previous_scheduled_at IS
  'The scheduled_at this appointment held before the most recent propose_new. '
  'NULL means the time has never moved. Written by respondToAppointment in the '
  'same UPDATE that replaces scheduled_at, so it cannot drift; read by the '
  'conversation Decisions view to strike through the time a meeting moved from. '
  'Only the MOST RECENT previous time is kept — this is a "was/now" pair for a '
  'card, not an audit log.';

COMMIT;
