## 2026-11-04 · fix(meetings): In-person or Virtual — Virtual is a Jitsi room with one button; booked suppliers get Call · Video call

Enforces the owner's 2026-10-28 ruling (DECISION_LOG "CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO CALLS": *"remove both
voice and video call"*) on the one path that still leaked it — meetings — in the shape the owner settled on 2026-11-04:
"VIRTUAL = JITSI ONLY" (*"let's go with jitsi"* · *"just jitsi"*), "ONE BUTTON THAT SAYS WHAT THE ROOM NEEDS" (*"if a
link shows. we can have a button conference room created. you can enter. no conference room created, create one"*) and
"SIX OWNER ANSWERS" (*"Viber and phone call booked suppliers"* · *"We can call and video call suppliers as well on the
chat"* · *"Guest card 1. Yes."*).

**Meetings**
- **Two kinds, one dropdown.** Every composer (the chat ＋ "Request a meeting", the "Set up this meeting" chip, the
  workspace / Customer Card "Propose a meeting") offers **In-person** or **Virtual** in one `PickMenu`; the "Video call"
  / "Voice call" pills are gone (`meeting-how-fields.tsx`, `appointments-section.tsx`).
- **Virtual = Jitsi, made by Setnayan.** No app menu, no field: `https://meet.jit.si/Setnayan-<10 Crockford>` shown
  read-only with "Setnayan made this link · free, no time limit" and an ⓘ (the person who opens it first signs in once
  — Google, Facebook or GitHub; everyone else joins without an account). The server stores ONLY a Jitsi link of ours
  (`virtualLocationFromForm`: keeps the composer's link if Setnayan made it, else makes a fresh one) — no other app, no
  number, is ever written. Google Meet / Zoom / Messenger / Viber / Phone call, their fields, create-link buttons and
  free-plan notes are removed.
- **One button, from 15 min before a confirmed meeting** (`roomButtonFor`, `appointment-join.tsx`):
  "Create the room" (ⓘ "You open the room — sign in once with Google, Facebook or GitHub.") until somebody presses it,
  then "Room created · Enter the room" for everyone (ⓘ "No account needed."). The proposer (`initiated_by`) is offered
  Create first (filled); the other side sees it outlined with a note and may press it too. Pressing records who/when
  once (`createMeetingRoom`) and opens the link in a new tab (opened inside the tap, so iPhone does not block it); the
  state updates in place from the answer and is read on load — no live connection. Before the window: the link
  read-only with Copy.
- **Old rows**: 'video' / 'voice' read as Virtual everywhere a kind is drawn. A row that saved another app's link keeps
  showing it and its "Join on …" opens it; a row with no link shows "No link yet" and its Create the room makes the
  Jitsi link in the same press. Nothing dials from a meeting.
- **Never an in-app call**: `appointment-join.tsx` imports nothing from the call stack and opens no socket. The call
  code (`thread-call-actions`, `thread-call-room`, `call-webrtc`) is kept — deleting it is the owner's call; the
  `ugat-both-ends` baseline gains that one honest row (thread-call-room now has no importer), 41 → 42.

**Schema** — migration `20271308276036_meeting_room_created_once.sql`: `event_appointments.room_created_at` /
`room_created_by` + trigger `tg_event_appointments_room_set_once` — never set on insert; on the first press the values
are the database's own `now()` / `auth.uid()` (whatever the client sent); frozen after (a second press is a no-op). Who
may press is the existing UPDATE policies (the two sides of the meeting). Earlier in this PR, data-only migration
`20271305721935` moved catalog presets off 'voice' and deactivated the "Voice call" preset. `kind` stays a text CHECK;
Virtual is stored as 'video'; the link lives in `location` as `"jitsi|<link>"`.

**Admin**: no admin surface shows appointments today (`grep event_appointments app/admin` is empty), so there is no
"Room created by X at T" to add — flagged, not invented.

**Booked suppliers: Call · Video call in the chat head**
- `shopIsBookedOnEvent` (`lib/shop-booking.server.ts`): `event_vendors.status` in `CONFIRMED_VENDOR_STATUSES` — the same
  set as `current_vendor_booked_event_ids()`. Server-only, fails closed.
- `app/_components/chat/booked-call-buttons.tsx`: icon buttons before ⋮ on both thread pages, ONLY when booked and the
  other side has a number saved (couple → the shop's `contact_phone`; supplier → the couple's `users.phone`). `tel:` and
  `viber://chat?number=` hand-offs; the number is not even read before the booking. Built only in `lib/booked-handoff.ts`.
- **Guest card**: Call + Viber call under a saved mobile (`guest-call-buttons.tsx`, `lib/guest-call-links.ts`), on the
  couple's card only.

**Guards**
- `lib/meetings-never-open-an-in-app-call.test.ts`: no "Video/Voice call", no 'voice', no call stack, no `tel:`/`viber:`
  on any meeting surface; the composer has no app menu; the server stores only a Jitsi link of ours whatever is posted;
  and — rendered for BOTH sides — "Create the room" before creation, "Enter the room" after.
- `tests/db/a-meeting-room-is-created-once.db.test.ts` (real `authenticated` sessions): an outsider's press touches
  nothing; a side's press is recorded as them/now; a second forged press changes nothing; neutralised with the trigger
  off.
- `lib/no-door-out-of-the-app.test.ts`: zero tolerance everywhere else; `BOOKED_HANDOFF_BILL` (`lib/booked-handoff.ts`,
  its one caller the booked chat head) with executed refusals; `GUEST_CONTACT_BILL` + `lib/guest-call-links.ts` (only
  the guest card imports it); `SHOP_CONTACT_READ_BILL` + `lib/shop-booking.server.ts`; no meeting file reaches the
  booked hand-offs. The meeting-specific Viber/phone exemption is gone with the feature.
- Sabotage, each seen red then restored: a booking refusal dropped (2 red) · an extra `sms:` in the guest file (1 red)
  · "Enter" shown only to the proposer (1 red) · a permissive policy letting anyone update (2 red).
- Server-action budget held at its ceiling (1227), not raised: `createMeetingRoom` is a new export, so Withdraw /
  Cancel meeting now post `decision=cancel` to `respondAppointment`, which hands them to the same (now un-exported)
  `cancelAppointment` body. Same update, same notification, same redirect.
- Exposure baseline regenerated: +2 `col` facts, `event_appointments.room_created_at` / `room_created_by`, with the same
  grants as every sibling column. RLS and the set-once trigger govern them.
- `bookedCounterpartyPhone` (`lib/shop-booking.server.ts`) now logs a refused `vendor_profiles` / `event_members` /
  `users` read, and a thrown error, through `logQueryError` (`graceful_degrade`), instead of dropping it. It still
  returns null, so no buttons show, but a refused read is no longer indistinguishable from "no number saved".
  Spotted by #7300's session.

SPEC IMPACT: None in this PR — it implements rulings already in DECISION_LOG.md (2026-10-28 no calls; 2026-11-04 "SIX
OWNER ANSWERS", "VIRTUAL = JITSI ONLY", "ONE BUTTON THAT SAYS WHAT THE ROOM NEEDS").
