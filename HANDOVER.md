# HANDOVER — rd/two-hosts-never-overwrite · 2026-10-18 by the controller

Owner, 2026-10-18 (asked "how about … the similar fix" after the guest double-records fix #6621; controller named this and
the owner approved the day's list with "all builds for today"). THE PROBLEM: two hosts on one event (cale-ice: Indalecio
and Claire — an unlock belongs to the event, both edit) or one host on two devices can save at once; a save that writes a
whole JSON blob / row from a stale copy silently wipes the other person's change. Measured incident: on 2026-10-17 an
editor save dropped two women's colour sets (Immediate Family; Secondary Sponsors) on cale-ice — the Mood Board & Dress
Code editor wrote from a stale copy.

STEP 1 — FIND every host-side write that can lose another writer's change (read-then-write of a whole jsonb or row from
the client's copy, no compare-and-set): the Maker draft (hub-draft / launch actions — save, Apply/publish, Undo/Restore),
Mood Board + Dress Code editor, Details (event fields, entourage/roles), Guests (edit, bulk edits, roles, +1s), Seating
(table moves, assignments), Love Story, Schedule/run-of-show, Prints settings, E-Gifts list. Rank by: how often two people
touch it × how much is lost. Write the table into this HANDOVER before fixing.
STEP 2 — FIX the top ones with ONE shared pattern (make it a small lib, reuse it): every save carries the version it was
based on (updated_at or a revision int); the server merges at the FIELD/ITEM level inside one SQL statement or a locked
RPC (unchanged fields keep the other writer's value; lists merge by item id); only when BOTH changed the SAME field does
the later save win AND the editor shows a calm one-line note ("Claire changed this a moment ago — showing her version")
and refreshes. "We handle the chaos": never ask the host to choose, never a modal, never lose a value silently.
STEP 3 — tests: two saves from the same base touching different fields → both kept; same field → later wins + note
signal; a db test per migrated RPC; sabotage each.
Rules: migrations via pnpm migration:new; RLS/grants unchanged in meaning; Ugat/exposure guards green; no new emails;
words plain; 375 px WebKit shots of the note in the Maker (light + dark) → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/.
Never open the owner's cale-ice Maker — use the lab / two lab sessions. Changelog fragment changelog.d/rd-two-hosts-never-overwrite.md.
If the list is long, ship the top 3–4 in this PR and name the rest as left (ranked) in the PR body.
