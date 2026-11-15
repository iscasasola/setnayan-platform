## 2026-11-15 · feat(badges): J3 — each service card earns its own badges

Badge build J3 (owner-approved prototypes 15 Nov: `prototypes/supplier_badges_2026-11-15/badge-milestones_v86` ·
`badge-flow-walkthrough_v5`; DECISION_LOG rows 7d6c8129 · 4b8cc3a3 · 50566f42 · a33fd894 · 068c8ed4).

- **What a couple sees:** on a shop's page, each service card carries a row of up to six medals in layout D (no
  ribbon, no binder): Hot Booking · Quick Responder · Trending Now · Rave Reviews · Generous Giver · Setnayan Verified
  (always last). Every 2.6 s the next medal lifts with a gold rim and the label beside it names that badge and how long
  it has been held ("Hot Booking · 4 mos"), in its colour. Reduced motion: nothing turns. One badge: still.
  A tap on the row opens the rules explainer (the house Sheet, loaded on the first tap).
- **Setnayan Verified is the shop's:** every card of a verified shop shows it, from the SAME fact as the blue check by
  the shop's name (which stays), and its time held runs from the date the shop was verified.
- **What a supplier gets:** a Today notice (`card_badge_earned`, in-app + push, not email) the first time a card earns
  a badge — exactly once per earning.
- **Data:** migrations `20271348664988_notification_type_card_badge_earned` (enum value; J0 adds the same one with
  IF NOT EXISTS) and `20271348906302_service_card_badge_holds_and_facts` — table `service_card_badge_holds`, functions
  `service_card_badge_facts` (raw 30-day numbers per card) and `service_card_badge_settle` (held-since + announce once).
  Service-role only, RLS on. The thresholds live once, in `lib/card-badges.ts`.
- **A failed read says so** above the cards ("We couldn’t check these cards’ badges just now.") — never an empty row.
- Guards: `lib/card-badges.test.ts` (8) · `tests/db/service-card-badges.db.test.ts` (5) — each red on its sabotage.

SPEC IMPACT: None — implements the approved v86 design. Known gaps and the two unruled items are named in the PR body.
