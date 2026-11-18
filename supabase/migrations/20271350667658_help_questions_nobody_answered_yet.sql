-- help questions nobody answered yet
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ❓ HELP — WHAT WE COULD NOT ANSWER IS KEPT (owner 13 Nov 2026, "help approved" on the ask-first Help prototype
-- v5; DECISION_LOG 2026-11-13 "Help — no AI answers yet": "logs unanswered questions for admin").
--
-- One row per question the help could not answer well — no best answer, only a closest or near match — and one per
-- "Did this answer it?" press (Yes is counted for that answer; No lands in the list). The team's Help reads it as
-- "No answer yet", most-asked first, so the missing article gets written; the same counts order the "People ask"
-- chips on the first screen.
--
-- 🔒 NO NAME, NO EMAIL, NO USER ID — the words, which account's help (coverage), web or app, what was shown. A
-- person who wants a reply uses Message us (help_messages), which is a separate, signed act.
--
-- Written and read ONLY by the server with the service-role client (lib/help-asks.server.ts, the /admin help
-- pages): RLS is on with no policy, so anon and authenticated can neither insert nor read a row.

CREATE TABLE IF NOT EXISTS public.help_asks (
  ask_id        BIGSERIAL PRIMARY KEY,
  words         TEXT NOT NULL CHECK (length(btrim(words)) > 0 AND length(words) <= 120),
  coverage      TEXT NOT NULL CHECK (coverage IN ('user', 'guest', 'supplier', 'public', 'team')),
  surface       TEXT NOT NULL DEFAULT 'web' CHECK (surface IN ('web', 'app')),
  outcome       TEXT NOT NULL CHECK (outcome IN ('best', 'closest', 'near', 'none', 'yes', 'no')),
  article_slug  TEXT CHECK (article_slug IS NULL OR length(article_slug) <= 120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.help_asks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS help_asks_created_at_idx ON public.help_asks (created_at DESC);
CREATE INDEX IF NOT EXISTS help_asks_coverage_outcome_idx ON public.help_asks (coverage, outcome);

COMMENT ON TABLE public.help_asks IS
  'Help questions: no best answer (closest/near/none) and Did-this-answer-it votes (yes/no). No name, no email. Service-role only; read by the team''s Help "No answer yet".';

-- The second lock (tests/db/anon-table-grants-closed.db.test.ts): a table in this schema arrives with anon and
-- authenticated grants from the default privileges. Only the service role reads or writes this one.
REVOKE ALL ON TABLE public.help_asks FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.help_asks_ask_id_seq FROM anon, authenticated;
