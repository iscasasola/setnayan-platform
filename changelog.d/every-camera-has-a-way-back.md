## 2026-10-31 · fix(papic): every camera has a ✕ back to the Event Hub

Owner, on the full-screen camera (#7107): "needs exit to return to event hub". The guest camera's ✕ now falls back to the event's own hub when it was not opened from a hub tab, and the seat camera gets the same ✕ (the event's own slug, read on the server and re-checked; never a query param). Guard: `app/papic/every-camera-has-a-way-back.test.ts`.

SPEC IMPACT: None (implements the owner's ask on #7107).
