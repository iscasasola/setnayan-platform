## 2026-11-18 · fix(onboarding): three type faults the full typecheck found (no visible change)

`create-location-picker` was missing its `MAX_EVENT_AREAS` import, the dates sheet's state did not admit the `months` mode, and the "Not sure yet" toggle had no `icon` (an empty element, so nothing is drawn).

SPEC IMPACT: None
