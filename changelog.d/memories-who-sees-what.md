## 2026-10-30 · feat(memories): Memories ⚙ › Who sees what — hosts + coordinator manage it, default Only tagged

Owner ruling 2026-10-30, DECISION_LOG "MEMORIES ⚙ HOLDS THE MEMORIES RULES — HOSTS + COORDINATORS MANAGE THEM;
DEFAULT "ONLY TAGGED"" (closing points (3) of "PAPIC ON = A CAMERA TAB ON EVERY STAGE").

- **Who sees what** replaces the "Guests see all photos" switch in Memories ⚙: ONE dropdown (PickMenu) — **Only
  tagged** (default) · **Share all memories**. It is the SAME shipped column, `events.pool_gallery_open`
  (`BOOLEAN NOT NULL DEFAULT FALSE` since 20270917300000): FALSE = Only tagged. **No migration, no data change** — no
  live event changes what its guests see. Saves in place, says a refusal in place. While the shared gallery cannot
  open (env flag / privacy control off) the row says "Only tagged" with no choice, instead of vanishing.
- **Who manages, on the server:** `setPoolGalleryOpen` now admits the hosts (the couple + every co-host — a
  `couple` member) and the event's coordinator (a live, accepted `wedding_planner_external` seat inside the
  delegate window), via the one rule `lib/memories-rules.ts` › `memoriesManagerRoleOf` read by
  `lib/memories-rules.server.ts`. A limited helper is refused first (`limitedHelperRefusal(eventId, null)`); guests
  and other suppliers get `forbidden`; a failed read refuses. ⚠ Supersedes the earlier COUPLE-ONLY lock on this
  action (the owner widened it to the coordinator).
- The Memories page draws ⚙ for the same people: hosts get the whole sheet; a coordinator gets the rule only (the
  photo wall, Thank-You add-on, Google Drive and Keep full resolution stay the hosts').
- The guest read already honoured the switch (Photos of you = their tags · Your shots = their own · "Everyone's
  photos" only while TRUE · `guest_pool_gallery` re-checks it per read) — now pinned by a guard.
- Guards: `apps/web/lib/memories-rules.test.ts` (default · the managers table executed · the action's gate order ·
  the ⚙'s audience · the guest read), sabotage-checked. Labs: `/dev/bar-lab/dashboard/ev-lab/memories?who=tagged|all`
  (`&guest=1&coord=1` = the coordinator) and `/dev/memories-lab?guest=tagged|all`.
- Not built (needs an approved prototype / owner): host-made chapters (make · rename · reorder · merge · Reset) and
  uploads into a chapter; coordinators adding photos; coordinators seeing the guests' photos.

SPEC IMPACT: DECISION_LOG.md — an "AS BUILT" line under the 2026-10-30 "MEMORIES ⚙ HOLDS THE MEMORIES RULES" row
(what shipped, what did not, and that the couple-only lock on the shared-gallery switch is superseded).
