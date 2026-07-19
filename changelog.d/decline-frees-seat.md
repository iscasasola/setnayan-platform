## 2026-06-22 · feat(seating): a declined guest automatically frees their seat

Owner: "decline auto removes them." When a guest's RSVP flips to **declined**, their seat assignment is now dropped automatically, so the chair opens up for someone else.

- **Migration** `20270212992703_decline_frees_seat_assignment.sql` — a `SECURITY DEFINER` `AFTER UPDATE OF rsvp_status` trigger on `guests` that DELETEs the guest's `event_seat_assignments` row when `rsvp_status` transitions to `declined`. A DB trigger is the one chokepoint that covers **every** decline path (public RSVP page, dashboard guest edit, bulk, import, admin, v1 API) — patching each call site would drift. `SECURITY DEFINER` is required because the public-RSVP path runs as the guest, who has no RLS write on `event_seat_assignments`.
- **Decline beats lock:** a declined guest's seat is freed even if it was locked (Phase 4) — declining is a stronger signal than a manual pin (owner's "auto removes them").
- **Idempotent + cheap:** the `WHEN (NEW='declined' AND OLD IS DISTINCT FROM 'declined')` guard fires only on the real edge — re-saving an already-declined guest is a no-op, and a later declined→attending re-flip just leaves the seat freed (auto-seat already re-includes them). Hard-deleting a guest already frees the seat via FK `ON DELETE CASCADE`, so this only handles the status case.

Applied to prod (clean lineage after the pipeline unjam) and **functionally verified**: seated a guest → set declined → seat row deleted (`before=1 after=0`), test rolled back so nothing persisted.

No app-code change. SPEC IMPACT: iteration 0008 — decline now auto-frees the seat. Logged in corpus DECISION_LOG.
