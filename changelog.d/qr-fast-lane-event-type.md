## 2026-07-02 · feat(onboarding): QR fast-lane — the scan pre-answers the event type (PR4)

A Locked/Shortlist QR already knows the event type, so a scanning couple no
longer re-picks it. Owner 2026-07: *"when someone scans, this will just directly
log in and bypass the onboarding for user and the type of event."*

- **`create-event`** accepts `?event_type=` (validated against the creatable
  roster) and passes it to `EventTypePicker`.
- **`EventTypePicker`** gains a `preselect` prop: once, on mount, it auto-advances
  straight into that type's flow (wedding → its onboarding, non-wedding →
  inline/experience), skipping the type carousel.
- **Locked-QR scan** (`/vendor/lock/[token]`): the no-event branch now routes to
  `create-event?event_type=<from QR, default wedding>&next=<lock>`, so the couple
  lands mid-setup instead of at the type carousel. "Bypass the user onboarding" is
  already covered — signup carries `next` and returns to the lock page rather than
  the persona quiz.

SPEC IMPACT: Onboarding — QR-seeded event type. Logged in DECISION_LOG.md.
⚠ Owner note (lock boundary): weddings still require `ceremony_type` (Task #44
lock — no silent default), so a wedding QR pre-answers the TYPE but the couple
still completes the short wedding setup; it is not a zero-tap wedding create.
Fully bypassing that would override a locked decision — flagged, not done.
