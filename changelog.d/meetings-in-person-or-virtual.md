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

**Booked suppliers only — Viber, phone and the chat's Call / Video call** (owner 2026-11-04, DECISION_LOG "SIX OWNER
ANSWERS", verbatim: *"Viber and phone call booked suppliers"* · *"We can call and video call suppliers as well on the
chat"* · *"Guest card 1. Yes."*). This resolves the Rule 1 conflict this PR first raised.

- **The one booking check** — `shopIsBookedOnEvent` (`lib/shop-booking.server.ts`): `event_vendors.status` in
  `CONFIRMED_VENDOR_STATUSES` for the shop's row, the same set as the database's `current_vendor_booked_event_ids()`.
  Server-only, fails closed. Not a new source of truth.
- **Meetings' Via**: unbooked → Jitsi Meet · Google Meet · Zoom · Messenger, with an ⓘ "Viber and phone calls open once
  this supplier is booked"; booked → all six (`viasFor`). Enforced on the SERVER too: `readVirtualFields(formData,
  booked)` refuses Viber / Phone for an unbooked pair in `proposeAppointment`, `createScheduleRequestFromChat` and
  `setVirtualMeetingLink` (which reads the row's own event + shop). A Join on an unbooked Viber/phone row opens nothing.
- **Chat head: Call · Video call** (`app/_components/chat/booked-call-buttons.tsx`), icon buttons before ⋮ on both
  thread pages, ONLY when booked and a number is saved on the other side: the couple calls the shop's
  `contact_phone`; the supplier calls the couple's own saved `users.phone` (none saved → no buttons). `tel:` and
  `viber://chat?number=` hand-offs — ThreadCallRoom stays unused. The number is not even read before the booking.
- **All shop ↔ couple tel:/viber links are built in ONE file**, `lib/booked-handoff.ts`, whose builders take `booked`
  and return null without it (`virtualHandoff` now delegates to it).
- **Guest card**: Call + Viber call icon buttons under a saved mobile (`guest-call-buttons.tsx`,
  `lib/guest-call-links.ts`), on the couple's guest card only (couple + coordinators with guest_list access).
- **Guard** `lib/no-door-out-of-the-app.test.ts`: zero tolerance kept everywhere else. New `BOOKED_HANDOFF_BILL`
  (`lib/booked-handoff.ts`, count 2, each builder must open with `if (booked !== true`) + executed tests: unbooked
  builders and an unbooked thread head render no tel:/viber link; both thread pages key the buttons on
  `shopIsBookedOnEvent`; both actions pass `booked` to `readVirtualFields`. `GUEST_CONTACT_BILL` gains
  `lib/guest-call-links.ts` (count 2) and a test that only the guest card imports it. `SHOP_CONTACT_READ_BILL` gains
  `lib/shop-booking.server.ts` (count 1). Sabotage seen red, then restored: dropping one booking refusal (2 red), an
  extra `sms:` in the guest file (1 red).
- Dial helpers moved to a new `lib/ph-dial.ts` (re-exported from `lib/virtual-meeting.ts`) so no import cycle.

SPEC IMPACT: None in this PR — it implements the 2026-10-28 ruling, the 2026-11-04 approval and the 2026-11-04
"SIX OWNER ANSWERS" ruling, all already in DECISION_LOG.md. Open for the owner: the
"Phone call is one person" rule has no "Who's invited" picker to count in the shipped app (prototype v63 has one; the
schema has no invitee list), so it ships as an always-shown note, not a Propose block.
