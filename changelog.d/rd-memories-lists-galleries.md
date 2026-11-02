## 2026-10-02 · feat(memories): every event you host gets a Gallery door on Memories

Memories (`/dashboard/library`) now lists each event the signed-in person hosts or
co-hosts under the album shelf, one row each, and each row opens that event's Gallery
(`/dashboard/[eventId]/galleries`). Papic is not a condition, so an event without Papic
has a normal way to its gallery. Nothing is copied; Memories links, the gallery stays in
one place. Reuses the shelf's existing event list (`getPhotosAlbums`) — no new query.
Rows are 48px tall tap targets. Render-level guard: `gallery-doors.test.ts`.

SPEC IMPACT: None (implements DECISION_LOG 2026-10-02 "MEMORIES LISTS EVERY EVENT WITH ITS GALLERY").
