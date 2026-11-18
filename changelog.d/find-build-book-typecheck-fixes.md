## 2026-11-18 · fix(onboarding): three type faults the full typecheck found (no visible change)

`create-location-picker` was missing its `MAX_EVENT_AREAS` import, the dates sheet's state did not admit the `months` mode, and the "Not sure yet" toggle had no `icon` (an empty element, so nothing is drawn).

SPEC IMPACT: None

## 2026-11-18 · fix(suppliers): the step row no longer fades its colour

House motion rule (18 Nov, `MOTION_STANDARD_2026-11-18.md`): animate transform and opacity only, named motions only. The new step row carried `transition-colors`; its colour now changes at once.

SPEC IMPACT: None
