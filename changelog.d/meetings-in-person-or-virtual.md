## 2026-11-04 · fix(meetings): a meeting is In-person or Virtual — no call inside Setnayan

Enforces the owner's 2026-10-28 ruling (DECISION_LOG "CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO CALLS": *"remove both
voice and video call"*) on the one path that still leaked it — meetings — in the shape approved on 2026-11-04 ("Yes, fix
live", prototype v63, and the follow-ups that day).

- **Two kinds, one dropdown.** Every meeting composer (the chat ＋ "Request a meeting", the "Set up this meeting" chip,
  and the workspace / Customer Card "Propose a meeting") offers **In-person** or **Virtual** in one `PickMenu` — the
  "Video call" / "Voice call" pills are gone (`meeting-how-fields.tsx`, `appointments-section.tsx`).
- **Virtual → Via ▾**: Jitsi Meet · Google Meet · Zoom · Messenger · Viber · Phone call, then ONE field that follows the
  pick (`virtual-meeting-fields.tsx`, rules in `lib/virtual-meeting.ts`):
  - **Jitsi Meet** — Setnayan makes the link itself, no API: `https://meet.jit.si/Setnayan-<10 Crockford>`, read-only,
    "Setnayan made this link · free, no time limit" with the ⓘ on who signs in first.
  - **Google Meet / Zoom** — "Meeting link", a **Create a … link** button that opens `meet.google.com/new` /
    `zoom.us/start/videomeeting` in the person's OWN account (they paste the link back), and the free-plan notes
    ("Free · 60 min for 3 or more people", "Free Zoom ends at 40 min"). API/OAuth creation is NOT built — the seam is
    `createLinkHref`.
  - **Messenger** — m.me / https link. **Viber** — PH mobile, stored E.164. **Phone call** — PH number, with the note
    "A phone call is one person — …".
  - Every value is validated on the client (inline message, Send disabled) and again on the server
    (`readVirtualFields`); invalid saves nothing.
- **Join is a hand-off, never an in-app call.** `appointment-join.tsx` no longer imports `startThreadCall` /
  `ThreadCallRoom` and opens no socket (removed from the socket census). From 15 min before a confirmed meeting:
  "Join on Jitsi Meet / Google Meet / Zoom" (new tab), "Open in Messenger", "Open in Viber" (`viber://chat?number=+63…`),
  "Call 0917 …" (`tel:`). Before that: the app + value read-only with Copy. No link yet (every old video/voice row) →
  "Virtual · No link yet" and an add-in-place field either party can save (`setVirtualMeetingLink`, returns state, no
  redirect; a zero-row update is reported, not shown as saved). The confirmed chat card carries the same block.
- **Old rows read as Virtual** everywhere a kind is drawn (chat card, workspace list, schedule's supplier meetings,
  supplier Overview, Upcoming / Preparation lines, the .ics LOCATION).
- **Catalog**: migration `20271305721935_meetings_are_in_person_or_virtual.sql` — data only: presets that defaulted to
  'voice' now default to 'video' (Virtual); the universal "Voice call" preset is set `is_active = false` (not deleted).

Schema: none. `event_appointments.kind` is a text CHECK (`in_person|video|voice`), not an enum — a Virtual meeting is
stored as 'video' and nothing new is written as 'voice' (`postedKindToStored`). The app + value live in the existing
`location` column as `"<via>|<value>"` (`encodeVirtualLocation` / `parseVirtualLocation`, which also reads an older bare
link). The call server code (`thread-call-actions`, `thread-call-room`, `call-webrtc`) is untouched — deleting it is
still the owner's call.

Guard: `lib/meetings-never-open-an-in-app-call.test.ts` — no meeting surface draws "Video call"/"Voice call", names
'voice', or reaches the call stack; each composer posts through the shared pick; both server actions read kind via
`postedKindToStored` and validate the link; the hand-offs, refusals, Jitsi link shape and 15-minute window executed.

⚠ **RULING CONFLICT — held for the owner, guard NOT weakened.** `lib/no-door-out-of-the-app.test.ts` Rule 1 (owner
2026-09-10, *"not to let them communicate outside the app"*, zero tolerance, no bill) fails on the two hand-offs the
2026-11-04 brief asked for: `viber://chat?number=${…}` and `tel:${…}` in `lib/virtual-meeting.ts`. Meetings exist only on
a booked / accepted relationship, but the guard has no such notion. The owner chooses: (a) a narrow, reasoned exemption
for meeting hand-offs on booked relationships, or (b) drop Viber / Phone call from Via (Jitsi · Meet · Zoom · Messenger
stay). Until then this PR's unit suite is red on that one test.

SPEC IMPACT: None in this PR — it implements the 2026-10-28 ruling and the 2026-11-04 approval. Open for the owner: the
"Phone call is one person" rule has no "Who's invited" picker to count in the shipped app (prototype v63 has one; the
schema has no invitee list), so it ships as an always-shown note, not a Propose block.
