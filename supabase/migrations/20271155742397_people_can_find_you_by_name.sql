-- ============================================================================
-- people_can_find_you_by_name
--
-- ── THE OWNER'S ASK ────────────────────────────────────────────────────────
-- 2026-08-21: *"we can search all users of that name as well. so they can also
-- add manually instead of email address."* · *"it will show all people with that
-- name and pick the person they want to add."* · *"just like facebook."*
--
-- ⚖ THIS IS A DELIBERATE CHANGE OF POSTURE, AND IT NEEDS SAYING PLAINLY.
-- `visible_connection_names`' comment has said since 2026-07-05: *"name-only,
-- confirmed-only, self-scoped — never a browsable directory."* Searching all
-- accounts by name IS a directory. The owner, who is the registered DPO, has
-- asked for it in those words. The rule's OTHER halves are untouched and still
-- enforced: a search result carries a NAME and nothing else — no email, no
-- phone, no events, no connections — and it still takes a mutual confirmation
-- before any relationship exists.
--
-- ── WHAT THIS MIGRATION ADDS: THE WAY OUT ──────────────────────────────────
-- One column, `users.discoverable_by_name`, DEFAULT TRUE — findable is the
-- default, exactly as the owner asked, and exactly as the product it names
-- behaves. What matters is that there IS an off switch and that the search
-- honours it, because a directory with no way out is the version of this that
-- an NPC reviewer would object to.
--
-- ⚠ THE COLUMN IS NOT THE WHOLE GATE. The search also refuses, in code:
--   · accounts with no display name (nothing to match, nothing to show);
--   · anonymous drafts (`anon+…@anon.setnayan.local`) — a person who has not
--     even secured their account has not chosen to be anywhere;
--   · yourself;
--   · anyone already on your list.
-- Those live in `lib/people-search.ts` because they are about the QUERY, not
-- about a person's stored preference. This column is only the preference.
--
-- ⚠ NO INDEX ON display_name YET, deliberately. Prod holds 9 accounts, two of
-- them named. A trigram index is the right answer at a scale this table is
-- nowhere near, and adding one now is a guess dressed as an optimisation. The
-- search caps at 10 rows and requires 2 characters; revisit when the table is
-- big enough for the plan to matter.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS discoverable_by_name BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.users.discoverable_by_name IS
  'May other signed-in people find this account by typing its name (owner ruling 2026-08-21, "just like facebook")? DEFAULT TRUE. A search result carries the display name and nothing else — never an email, a phone number, an event or a connection — and finding somebody still only lets you ASK them; the mutual-confirmation rule is untouched. Turned off, the account is unfindable by name and can only be added by an address the adder already knows. Additional refusals that are NOT this column live in lib/people-search.ts: no display name, anonymous drafts, yourself, anyone already on your list.';
