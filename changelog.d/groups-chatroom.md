## 2026-10-28 · feat(groups): the group is a chatroom — stories, events and an hourly collage in the chat

Owner, 28 Oct: *"groups should look like a chatroom with stories and events. all stories will run in a collage every
hour"* → *"Groups chatroom approved. Send it to the build screen"* (DECISION_LOG "GROUPS AS A CHATROOM"; contract
`prototypes/groups_chatroom_2026-10-28/`, baseline `prototypes/group_samahan_2026-10-25`).

- `/dashboard/samahan/[communityId]` (`GroupHome` → new `GroupChatroom`): Usapan IS the page. Top to bottom —
  ‹ People (People › Groups) · the group's photo/initials, name and member count · ⋯ · the shipped Stories strip
  (rings only; rules unchanged — one clip an hour, gone after 24 hours) · the next dated event pinned with **Going?**
  (its own page, where the reply lives; "Open" for an organizer) · the chat · the message bar at the thumb
  (＋ · Message the group · 📷), drawn as the one `ThumbRow`, riding the keyboard.
- ⋯ sheet: Members · All events · Bring people in (organizers) · Notifications (the inbox) · Leave group (two taps) —
  the shipped `?tab=members` / `?tab=events` / `#bring-in` lists, one tap in. ＋ sheet: a story · Plan an event ·
  Bring people in (organizers) or All events (members).
- New in the chat: (1) each community event posts a **card** at the moment it was planned (`events.created_at`, now
  read by `fetchCommunityEvents`); tap opens that event through `eventBoardHref`, and an event you may not open says
  why. (2) **The hourly collage** — when an hour ends, that hour's stories post as ONE item ("3 PM · 6 stories"):
  tiles play together, muted, only while on screen; ▶ Play opens it full-screen; a tile opens that person's story in
  the strip's own player; Next hour steps on. Reduced motion: tiles hold still on their posters.
- The collage is DERIVED at read time (`lib/samahan-chatroom.ts`): the live clips bucketed by the hour of
  `created_at` (Manila = UTC+8, no DST, so the bucket is the same on server and phone), only hours that have ended,
  only clips whose `expires_at` has not passed — so it expires with them. No new upload, no render, no stored row,
  no migration.
- Moved, not lost: the group's photo + rename now sit at the top of Members; "Take it down" appears under your own
  message when you tap it; "Play the day" is the strip's last ring; "Plan an event" is under ＋.
- Old addresses: `?tab=usapan` (the Usapan notice still writes it) now opens the chatroom; `?tab=members`,
  `?tab=events` unchanged. The message post/delete actions return to the group page itself.
- A refused Usapan read now says so ("We couldn't load the chat just now") instead of "No one has said anything yet" —
  `fetchSamahanMessages` returns `null` on a refused read.
- `SamahanStories` gains `strip` (rings only) and `controlRef` (the 📷 and the collage tiles reach its ONE camera and
  player).
- `/dev/group-lab` carries a chat fixture: messages, a new event's card, two ended hours of stories (6 + 2, some real
  clips) and an open hour that has not posted; `?member=1`, `?empty=1`, `?refused=1`.
- Guards: `group-is-a-chatroom.test.ts` (rendered — order, the back link, event doors, the collage, ⋯ rows, every old
  `?tab=`, moved-not-lost; replaces `group-is-four-things.test.ts`) and `lib/samahan-chatroom.test.ts` (groups by hour,
  drops expired clips and unended hours, timeline order, the pinned event, nothing stored). 11 sabotages, all red,
  restored green.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — the 2026-10-28 "GROUPS AS A CHATROOM" row is the
decision (unchanged); build notes appended to `prototypes/groups_chatroom_2026-10-28/` are NOT needed. Deviations the
owner should see: the full-screen collage stays muted (no "Turn sound on" — six clips at once; sound is one tap away
on a tile), Notifications opens the inbox (there is no per-group switch to say "On"), the placeholder is "Message the
group" (≤ 3 words, house rule) and Going? opens the event's own page where the RSVP lives (no in-place toggle — no
store for it without a migration).
