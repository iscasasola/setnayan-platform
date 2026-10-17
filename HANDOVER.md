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

---------------------------------------------------------------------------------------------------------------------
## STEP 1 — DONE (builder, 2026-10-18): every host write that can lose another writer's change, RANKED

Read in three parallel sweeps (Maker/Prints/E-Gifts · Details/Story/Schedule · Guests/Seating). Repo-wide there is NO
compare-and-set on any host save path except `save_story_arrangement`, `move_event_schedule_with_date`,
`writePaletteFill` and the entourage RPCs (all safe, left alone).

| # | Write (greppable) | What it does | How often two touch it | What is lost | This PR |
|---|---|---|---|---|---|
| 1 | `writeHubDraft` / `saveHubDraftPatch` / `hubDraftAction` save·reset·undo·drop·Apply-trim (`event_site_drafts.draft_json`) | server read → merge → write the WHOLE draft row, no compare-and-set; Maker autosaves every pick | very high (every Maker pick, two hosts or two phones) | the other save's whole patch, silently, + an Undo step; Apply's trim wipes saves made during Apply | FIX |
| 2 | Mood Board & Dress Code `paletteDraftFields` / `dressCodeDraftFields` (`role_palette`, `dress_code_config`) | client posts the WHOLE board / dress code from its own copy (`draftedBoard` cache can be stale) | high — the measured 2026-10-17 incident on cale-ice | other host's colour sets / outfits (two women's colour sets dropped) | FIX |
| 3 | Love Story `editLoveStory` (`love_story` whole, moments array) | client posts the WHOLE story from its copy | high — two partners filling it in together | the other's moments and words | FIX |
| 4 | Guest card `updateGuest` (autosave, ~25 `guests` columns) | posts the WHOLE card every 700 ms pause; Undo posts the whole previous card | very high — any open card on two screens | another host's edit of any field on that guest, AND the guest's own RSVP / consent from their phone | FIX |
| 5 | Maker scene canvas `use-scene-canvas.ts` + panels (`widgets.<type>.canvas` whole) | client posts the whole canvas | medium (same scene at once) | other's facet of the same scene | server ready (rebase accepts a `base`); client wiring LEFT |
| 6 | Event Details form `updateEventMatchCriteria` | posts every shown field | medium | region / feel / budget / cadence | LEFT |
| 7 | `saveReceptionDesign` (`events.reception_design` whole, no seat lock) | client posts whole design | medium | the whole room design | LEFT |
| 8 | Seating `saveFloorPlan` · `persistBooths` · `persistSigns` (lock-gated; one host on two phones shares the lock) | whole form / replace-all | low–medium | room layout, booths, signs | LEFT |
| 9 | `events.print_details` — 6 read→write writers (`app/api/hub-print/[piece]/route.ts`, `saveInviteMessage`, Apply) | server RMW; poster-photo holds the read for seconds; menu posted whole | low–medium | a menu / name style / words | LEFT |
| 10 | Post Event `saveEditorial` / `leadTheStoryWith` (`event_editorial.draft_json`) | server RMW of the whole doc | low–medium | a cover pick or a text save | LEFT |
| 11 | `renameRole` (`events.role_names`) · `addRoleToGuest` / `setGuestPrimaryRole` (`guests.extra_roles`) | server RMW of whole map / array | low | one rename / one extra role | LEFT |
| 12 | `writeStylePreferenceKey` + Apply QR write (`events.style_preferences`) | server RMW, ms window | low | another key | LEFT |
| 13 | `setDelegateArea` (`event_moderators.permissions_json`) | server RMW | rare (but an access level) | one helper's area | LEFT |
| 14 | `saveHostAnswers` (schedule questions) · schedule nudges · `bulkRetimeScheduleBlocks` | whole form / absolute times from client | low | answers / a nudge | LEFT (run-of-show files belong to the live-day lane) |
| 15 | E-Gifts `saveEgiftMethod` edit (whole method) · sort_order appends/swaps | form copy | low | one field of a method | LEFT |
| 16 | Live `invitation_widgets.config_json` writers (`setWidgetMotion` …, non-draft path) · `wizard_state` RMW | server RMW, ms window | low (legacy / onboarding) | a sibling key | LEFT |

## THE SHARED PATTERN — "merge from base" (decided by the builder; written here per the house rule)

`apps/web/lib/merge-from-base.ts` (pure): `mergeFromBase(base, mine, theirs)` — a three-way merge. Unchanged-by-me keys
keep the other writer's value; objects merge key by key; lists of `{id}` items merge by id; a key BOTH changed → mine
(the later save) wins and it is named in `clashed`; `moved` = the result differs from what this screen sent (the
screen must show the newest). Every save carries the value it was BASED ON (`base`), never a guess.
Server atomicity WITHOUT a migration: the draft row already has `updated_at` bumped by its trigger, so every draft
write is a compare-and-set on the `updated_at` it read (`updateHubDraft` in `lib/hub-draft-store.ts`), re-read and
re-merged on a lost race (bounded). Same shape #6621 item 6 used for `submitRsvp`.
The note: one calm line, never a modal, never a choice — "Changed on another screen a moment ago — showing the newest."
⚠ No NAME in it: the draft row deliberately has no `updated_by` (its migration: personal data, no reader). Naming
"Claire" needs a who-edited record — an OWNER decision, listed in the PR.
