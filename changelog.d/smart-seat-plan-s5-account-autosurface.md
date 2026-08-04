## 2026-07-08 · feat(events): account auto-surface scaffolding, FLAG-OFF (Smart Seat-Plan · S5, #7b)

Smart Seat-Plan guest-reactive program, **PR S5** (point #7b) — ships the full
mechanism **behind `FEATURE_ACCOUNT_AUTOSURFACE` (default OFF)**, **blocked on
external PH counsel** for the RA 10173 consent model. Inert in production: no
`auto_surfaced` rows exist while the flag is off.

Owner model (2026-07-08): the event is surfaced to a guest's already-claimed
Setnayan account **regardless of acceptance** (inclusion-by-default); only an
explicit **"no"** removes it — where "no" = declining the RSVP OR leaving.

- **Migration** `20270525141561` — `event_members.auto_surfaced BOOLEAN DEFAULT FALSE` + `hidden_at TIMESTAMPTZ`; `hide_autosurfaced_on_decline` trigger (the RSVP-decline "no" path, one chokepoint over every decline route, SECURITY DEFINER, inert while off).
- **`lib/account-autosurface-flag.ts`** — `accountAutosurfaceEnabled()` (server env, default off).
- **`lib/account-autosurface.ts`** — `maybeAutoSurfaceEventForGuest(admin, eventId, guestId)`: guest `person_id` → `people.claimed_by_user_id` → upsert an `event_members` guest row (`auto_surfaced=true`, `ON CONFLICT DO NOTHING` so a real membership is never touched). Best-effort; flag-guarded. RA 10173 "you were added" notice left as an explicit counsel-gated `TODO`.
- **`lib/account-autosurface-actions.ts`** — `leaveAutoSurfacedEvent()` (the "leave" opt-out; sets `hidden_at`, guarded to the caller's own auto-surfaced row).
- **Wiring** — `createGuest` calls the surface fn (flag-gated); `fetchUserEvents` (the picker) now excludes `hidden_at` rows.

Typecheck + lint clean. No behavior change in production (flag off).

SPEC IMPACT: Implements PR S5 of `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md` (#7b), flag-off/counsel-gated as the spec requires. The notice copy + notification type are the remaining counsel-defined piece (TODO in code). Corpus already carries the spec.
