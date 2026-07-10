## 2026-07-11 · feat(appointments): scheduler + propose/confirm UI (category-aware + custom)

Two-sided Appointments scheduler for the vendor↔couple relationship (Relationship
Workspace + Appointments, PR 12). Additive — no schema, no existing-action, no
page-restructure changes.

- **New `lib/appointments.ts`** — shared types + the `vendor_category →
  appointment_type_catalog.category` bridge (`appointmentCategoriesFor`, always
  including `any`) + label/format helpers.
- **New `app/_components/appointments-actions.ts`** — `proposeAppointment`,
  `respondAppointment` (confirm | decline | propose_new), `cancelAppointment`.
  All RLS-gated inserts/updates under the caller's OWN session client (never an
  admin client to bypass RLS); the admin client is used ONLY to fan out the
  best-effort `schedule_suggestion` notification to the other party. Mirrors
  `suggestScheduleChange` / `vendorRaiseChangeOrder`. Single-winner via a
  `status='proposed'` WHERE precondition (no new RPC/state-machine). Role
  (`initiated_by`) is derived server-side from the caller's vendor profile.
- **New `app/_components/appointments-section.tsx`** — one client component used
  by BOTH sides: the scheduler (In-person/Video/Voice mode · category presets +
  a persistent Custom chip · location for in-person · date/time/duration/note)
  and the list (status chips; in-person → Directions + Add-to-calendar;
  video/voice → Join deep-linked to the relationship thread; Confirm /
  Propose-new / Decline on the other side's proposals; Withdraw/Cancel on yours).
- **Wired into both entry pages, minimally**: the vendor Customer Card
  (`/vendor-dashboard/clients/[eventId]`, in the Schedule tab, booked-only) and
  the couple Vendor Workspace
  (`/dashboard/[eventId]/vendors/[vendorId]/workspace`, connected-vendor only).

Deferred follow-ups (noted, NOT built here):
- The `appointment_reminder` email template (0028) on confirm.
- `.ics` file generation — the in-app "Add to calendar" is a Google Calendar
  template link for now.
- Live voice/video "Join" wiring — Join deep-links to the relationship thread
  (the P2P call room is a separate in-flight PR; not imported here).
- Availability-from-`vendor_calendar_blocks` — MVP uses a plain date/time picker.

SPEC IMPACT: Relationship_Workspace_and_Appointments_2026-07-11.md (PR 12)
