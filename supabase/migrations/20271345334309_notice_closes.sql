-- notice_closes — ONE memory for "Got it" / "Not now" / "Hide" on every added notice.
--
-- Owner, 14 Nov 2026, approving `prototypes/notices_system_2026-11-14_fable.html` (corpus DECISION_LOG
-- 2026-11-14 "ONE NOTICE SYSTEM — APPROVED"): a close follows the person to a new phone. Before this the
-- app had 13 hand-written stores (11 in one browser's localStorage), so a closed notice came back on a
-- new device. Guests have no account and keep using the browser (apps/web/lib/notice-memory.ts).
--
-- One row per (person, notice). `closed_at` is the LAST close; `close_count` lets an alerts ask stop
-- after its second "Not now". When a notice may return is a RULE in code (apps/web/lib/notices.ts:
-- News never · To do 7 days · Offer 30 days · Live when its fact changes), never stored here.
-- `notice_key` is chosen by the code (e.g. `badge-earned:<shop>:<rung>`), never typed by a person.
--
-- Created via `pnpm migration:new`. Idempotent — may be re-applied.

CREATE TABLE IF NOT EXISTS public.notice_closes (
  user_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  notice_key  TEXT NOT NULL CHECK (char_length(notice_key) BETWEEN 1 AND 200),
  closed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  close_count INTEGER NOT NULL DEFAULT 1 CHECK (close_count >= 1),
  PRIMARY KEY (user_id, notice_key)
);

ALTER TABLE public.notice_closes ENABLE ROW LEVEL SECURITY;

-- Own rows only, every verb, both halves of the predicate (a row is yours AND stays yours).
DROP POLICY IF EXISTS notice_closes_owner_select ON public.notice_closes;
CREATE POLICY notice_closes_owner_select ON public.notice_closes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notice_closes_owner_insert ON public.notice_closes;
CREATE POLICY notice_closes_owner_insert ON public.notice_closes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notice_closes_owner_update ON public.notice_closes;
CREATE POLICY notice_closes_owner_update ON public.notice_closes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notice_closes_owner_delete ON public.notice_closes;
CREATE POLICY notice_closes_owner_delete ON public.notice_closes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ALTER DEFAULT PRIVILEGES hands anon + authenticated everything on a new relation. Revoke first, then
-- grant back exactly the four verbs the four policies above use. anon gets nothing.
REVOKE ALL ON TABLE public.notice_closes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notice_closes TO authenticated;

COMMENT ON TABLE public.notice_closes IS
  'One memory for closing an added notice (Got it / Not now / Hide), per account, so a close follows the person to a new phone. When a notice may return is decided in code (apps/web/lib/notices.ts), never stored. Owner 2026-11-14.';
