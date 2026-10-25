## 2026-10-26 · fix(access): a Limited helper views the event and changes only the areas the host set to Edit

Owner, live on `cale-ice` (2026-10-25): *"when we give access as helper/limited on a guest — they should be only able to
view and not edit. we tried it and they can change table, delete guests, and more."* Refined 2026-10-26: *"Limited
helpers can view but not change anything. limited helpers capabilities depend on the settings on their event details"*.
So: view-only by default; an area set to **Edit** for that helper in Event Details › Event access (`setDelegateArea` →
`event_moderators.permissions_json.areas`) they may change; View / Off / no area → refused, in place.

**What was live, measured.** The database already refused a helper's writes on most tables. The production edge log for
the owner's test helper shows `PATCH /rest/v1/guests` answered **200 with zero rows** — a refused UPDATE under RLS is an
empty success, so the server action returned normally and the screen showed the change as made. Actions that write with
the service-role client are not fenced by RLS at all.

**The fix.**
- `lib/limited-helper-gate.ts` (pure) + `refuseLimitedHelper(eventId, area)` / `limitedHelperRefusal(eventId, area)` in
  `lib/host-gate.ts`. Two questions of the database's own definitions: `is_limited_helper(event_id)`, then — only for a
  helper, only when the action has an area — `moderator_area_level(event_id, area) = 'edit'` (the function the 19
  area-gated tables' policies already ask). Asked first by every server action under `app/dashboard/[eventId]` (131
  files · 432 exported actions; all but 32 reads / own-row / couple-only ones, each listed with its reason). An action
  whose screen prints `{ ok: false, error }` returns e.g. "You can view the seat plan but not change it." (shown through
  `plainRefusal`); the rest throw it. A check that does not answer refuses.
- The map of every write path to its area is `AREA_RULES` in
  `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts` (guests → Guest list · seating → Seat plan ·
  schedule/playlist → The Day · vendors/manpower/messages → Suppliers · budget · mood board · website/invitation/STD/
  launch/QR/monogram → Event Hub · Papic/Patiktok/photo delivery/Alaala → Photos · everything else → none). Exceptions:
  granting access, publishing the seat plan, unlocking a category and the couple's review are area-less (hosts only).
- Migration `20271288470033_limited_helper_writes_follow_their_areas.sql`: the RESTRICTIVE `lh_ro_*` refusals of
  `20271251336140` refused a helper on 20 tables even in an area set to Edit. The six that belong to a settable area
  (guest_checkins, guest_souvenir_claims → guest list; event_song_picks → the day; event_appointments,
  event_vendor_working_notes, vendor_lock_proposals → suppliers) now pass a helper with Edit there; the rest keep the
  plain refusal.
- `app/dashboard/[eventId]/_components/view-only-line.tsx`: one line on every event page — "You can view this event but
  not change it." or "You can view this event and change only: Guest list." (a thrown server-action message is replaced
  by a generic one in production, so the page says it itself).
- Guests: a delegate whose guest-list area is not Edit gets the list with nothing that writes offered (Select, Remove,
  Add, row verbs) — the same seam as the phone's last copy (`writesOff` in `guests-screen.tsx`).
- Tests: the per-function AST guard (area included; sabotage-proved) · `lib/limited-helper-gate.test.ts` · db tests:
  `is_limited_helper` is a viewer seat never a co-host; a helper with guest list = Edit edits guests (and checks guests
  in) but not the seat plan; an all-View helper edits nothing.

Not done here: the guest CARD (opened from a row) still draws its edit controls for a view-only helper — the server
refuses each write and the view-only line explains why.

SPEC IMPACT: DECISION_LOG row 2026-10-26 "Limited helper capabilities follow Event Details › Event access" (the owner's
refinement of the 2026-09-28 ruling). No locked decision changed.
