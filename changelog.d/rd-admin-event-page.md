## 2026-09-30 · feat(admin): one admin page per event, with "Reopen guest list"

- New `/admin/events/[eventId]` (accepts the public `S89E-…` id or the event uuid): name, type, date,
  hosts (name + email, linked to their account card), guest counts (total / replied yes / declined),
  the guest-list state (`guest_count_locked_at`, `final_pax`, `guest_list_edit_deadline`), Papic face
  tagging as `resolveFaceMode` sees it ("On (couple declined)" when the couple said no), and a per-guest
  face list (enrolled yes/no from `guest_face_enrollments`, read as `guest_id` only; host exclusion).
  Every read binds its error and renders "Couldn't load", never `0` or an empty list.
- "Reopen guest list" — a second intent on the existing `setEventFaceMode` action (the server-action
  budget is at its ceiling). Clears the stamp AND `final_pax` AND moves the deadline 14 days out, because
  `ensureFinalized` decides by the deadline and would re-stamp a list whose stamp alone was cleared.
  The row is `.select()`ed back before "saved"; the reopen is written to `admin_audit_log`
  (`event_guest_list_reopened`).
- `setEventFaceMode` no longer returns silently: it `.select()`s the row back and redirects with
  `?saved=` / `?error=`.
- The event name on the Accounts → Events list and on the account card now opens the new page.
- Guard: `lib/admin-event-page-is-honest.test.ts`.

SPEC IMPACT: None
