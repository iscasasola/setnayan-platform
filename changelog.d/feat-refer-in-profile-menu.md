## 2026-07-10 · feat(dashboard): move "Refer a couple" into the event profile menu

Follow-up to flattening the Overview sidebar item to a leaf. The couple referral
entry (`/dashboard/[eventId]/refer`) now lives in the event section of the topbar
ProfileMenu — alongside Hosts + Personalization — so the referral funnel stays
reachable without a sidebar sub-item. Event-scoped (renders only when an eventId
is in context). No route/schema change.

SPEC IMPACT: None.
