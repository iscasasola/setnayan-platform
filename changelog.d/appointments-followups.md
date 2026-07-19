## 2026-07-11 · feat(appointments): .ics download + live Join wiring + confirm reminder email

The three production follow-ups that finish the two-sided Appointments feature
(Relationship_Workspace_and_Appointments_2026-07-11.md · "On confirm: .ics +
reminder"; Join) — PR 12 follow-ups. All additive; the appointments schema and
the P2P call transport (lib/call-webrtc.ts) are untouched.

- **.ics download** — new RLS-gated route
  `app/api/appointments/[appointmentId]/calendar.ics/route.ts` returns a single
  timed VEVENT for a CONFIRMED appointment (title from custom_label / catalog
  label / humanized type, DTSTART = scheduled_at, DTEND from duration_min,
  LOCATION for in-person, DESCRIPTION with the note). RLS is the only gate: the
  row is read under the caller's own session, so the `event_appointments` SELECT
  policies return it only to the two parties. Reuses the ICS builder module
  `lib/calendar-links.ts` — added `buildAppointmentIcs()` (a timed VEVENT next to
  the existing all-day Save-the-Date builders; same CRLF envelope). The
  appointments-section "Add to calendar" now points at this route (replaces the
  Google-Calendar-only template link — the .ics imports into Apple Calendar /
  Outlook / Google alike).

- **Live Join wiring** — the video/voice "Join" for a confirmed appointment now
  opens the REAL free P2P call instead of a chat deep-link stub. New
  `app/_components/appointment-join.tsx` is a single-button twin of
  `ThreadCallLauncher`: it reuses `startThreadCall` + `ThreadCallRoom` + the
  `thread_calls` realtime probe, keyed on the appointment's `thread_id` (falling
  back to the section's resolved (event, vendor) relationship thread when null).
  If the other party is already ringing it joins that call; otherwise it starts
  one of the appointment's kind. Both land in `call:{threadId}` so the peers
  meet. Gated to the existing join window (from 10 min before start); outside the
  window the "Join opens near start" stub stays. `AppointmentsSection` gained a
  `currentUserId` prop (the viewer's auth uid) and dropped the now-unused
  `threadHref`; `event_appointments` selects on both entry pages now also read
  `thread_id`. Fail-soft: a not-yet-accepted thread surfaces inline, never throws.

- **Confirm reminder email** — new `appointment_reminder` notification type
  declared in the 0028 system: added to the `NotificationType` union +
  label/tone records (lib/notifications.ts), to `EMAIL_ENABLED_TYPES`
  (lib/notification-emit.ts, branded HTML + plaintext via the shared renderer —
  same declaration pattern as rsvp_received / payment_confirmed), and to the DB
  enum via migration
  `supabase/migrations/20270719834517_appointment_reminder_notification_type.sql`
  (ALTER TYPE ... ADD VALUE IF NOT EXISTS). Emitted on the CONFIRM branch of
  `respondAppointment` to the OTHER party (the proposer): "Your <kind> '<meeting>'
  is confirmed for <date>" — best-effort, never blocking the write.

Follow-ups NOT in this PR (noted for the next slice):
- A **scheduled T-minus reminder** (e.g. Resend `scheduledAt` at booking-confirm,
  or a cron sweep) — the confirm-time "you're confirmed" email is the MVP here.
- **Availability / open-slots** authoring for the scheduler (propose-from-free-
  slots), and marking appointments `done` after their time passes.

SPEC IMPACT: Relationship_Workspace_and_Appointments_2026-07-11.md — Appointments §
"On confirm: .ics + reminder" and "Join" are now BUILT (confirm-time reminder =
MVP; scheduled reminder + availability remain follow-ups). No corpus edit needed
beyond this note; the spec already describes these as the intended behavior.
