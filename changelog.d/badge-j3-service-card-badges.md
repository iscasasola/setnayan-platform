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
- **Verified Partner (DECISION_LOG 11d044c0):** on a Verified Partner shop's cards the 6th medal reads
  "Verified Partner · for life" in place of Setnayan Verified. The seal itself is badge build J2's and is stored nowhere
  yet, so no shop shows it today; the page passes `false` until J2 records the award.
- **Losing a badge (DECISION_LOG 7fbff0cd):** the medal leaves the row once the card no longer qualifies; the span is
  closed (`lost_at`), never deleted, so the time held stays in the shop's record; the card can earn it again (a new
  span, a new congratulations). **Queue order** (same ruling) = the row's order.
- **Imports never count (owner 16 Nov, DECISION_LOG fd5814dc):** Hot Booking, Generous Giver and Rave Reviews
  count only bookings Setnayan sourced — the shop's invite, Locked QR, a reused booking or a `?src=own` arrival is an
  import. One rule: the booking fee's own `booking_fee_attribution_for`.
- **What a supplier gets:** a Today notice (`card_badge_earned`, in-app + push, not email) the first time a card earns
  a badge — exactly once per earning.
- **Data:** migrations `20271348664988_notification_type_card_badge_earned` (enum value; J0 adds the same one with
  IF NOT EXISTS) and `20271348906302_service_card_badge_holds_and_facts` — table `service_card_badge_holds`, functions
  `service_card_badge_facts` (raw 30-day numbers per card) and `service_card_badge_settle` (held-since + announce once).
  Service-role only, RLS on. The thresholds live once, in `lib/card-badges.ts`.
- **A failed read says so** above the cards ("We couldn’t check these cards’ badges just now.") — never an empty row.
- Guards: `lib/card-badges.test.ts` (8) · `tests/db/service-card-badges.db.test.ts` (5) — each red on its sabotage.

SPEC IMPACT: None — implements the approved v86 design and rulings 7fbff0cd · 11d044c0. Known gaps are named in the PR body.

## 2026-11-17 · fix(badges): J3 audit fixes — the render reads, the sweep settles

- **A render never writes.** `readCardBadges` (the public `/v/[slug]` read) now only reads: the facts (STABLE) and
  the open holds. The settle and the Today notice moved to `settleCardBadges`, called only from `sweepShopBadges` —
  after() on a moved count and the daily backstop, which now also visits every shop holding a card badge and every
  shop asked about recently. `the-shop-render-never-writes` test 4 holds it (broken on purpose: red).
- **Verified Partner** is read from `readShopSeals` (J2), not hard-coded `false`; a failed seals read is a failed badge read.
- **One key list:** the keys and names come from `CARD_MEDALS` (lib/public-badges.ts); the holds' CHECK and the
  settle now use those keys (`hot_booking`, `quick_responder`, `trending_now`, `rave_reviews`, `generous_giver`).
- **Main's award kit, filled:** the rules pop-up is `CardBadgeRules` (the branch's explainer is deleted); the Today
  line is `cardCongratsTodayLine` and links to `CardBadgeCongrats` (opened on Today from `?card_badge=`), with v86's tags.
- **The row is on the full card too** (`ServiceDetailsSheet` `cardBadgeRow` slot).
- **Colours are tokens** (`--sn-cb-*` in globals.css, light + `html.dark`); no hex left in `card-badges-art.ts`.

SPEC IMPACT: None — implements v86 / DECISION_LOG rows already logged.
