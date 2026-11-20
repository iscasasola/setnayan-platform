## 2026-11-20 · feat(front-door): the 20 Nov front page — photo opening, one picker row, guest view, plan, keep, plans

The signed-out `/` is rebuilt to the approved drawing `prototypes/front_page_home_2026-11-19/` v5 (owner 20 Nov
"APPROVED. you can build this", specs ef5df0b5; brief `FRONT_PAGES_BUILD_BRIEF_2026-11-20.md`), in Discover's parts
(`fd-sechead`, `fd-chips`, `fd-btn-terra`, Discover tokens). Photo opening with the brand line, "What are you
planning?" swipe row → each type's own onboarding, guest-view screenshots, one Papic album, free planning tools,
"kept for life" thread, three doors (hosting · supplier · coordinator), plans folded behind one link, close and a
sticky "Start your event — free" bar. 10,867 px → 3,591 px at 390 (3.3 swipes).

- Removed: `front-door-hero.tsx` (4 Nov turning-word hero) and `front-door-landing-client.tsx` (the page needs no script).
- Plans read the live catalog (`planPricesFrom`) and the live plan peeks; the 20 Nov plan re-cut (#7978/#8004) is not
  live, so each plan row shows today's product, never "Coming".
- Guards moved, not loosened: house words (two brand lines named), says-event, tells-the-truth, coordinator door,
  closed ⓘ, hero photo first, w5 walk, service cover.

SPEC IMPACT: None — builds an approved drawing; no decision changed.

- fix: a plan whose price could not be read (Event Plus / Pro / Ultra) is no longer drawn — never a figureless "per event" line; the "See the N plans" count follows the rows actually drawn. Guarded in `the-plan-prices-come-from-the-list.test.ts`.

- feat: front page v6 (owner "Approve v6", 20 Nov; specs DECISION_LOG f29c85b3 + the live-wording gift row). New hero line "One link for your whole event: your guests, your suppliers, your photos — from the first idea to the memories."; Papic now reads "Everyone you love, in one place. And every photo of them." / "Every guest's phone is a camera. Every photo they take lands in one album."; a new text-only "Plan it · Suppliers — Suppliers you can trust." part with four rows (Badges are earned · Nothing is a screenshot · You pay them directly · A Setnayan gift, in its live wording). No new data read. Guarded in `the-front-door-tells-the-truth.test.ts`.

- fix(copy): the badges row reads "Every badge and seal is earned: real bookings, real inquiries, checked papers." (Quick Responder and Trending Now count inquiries; Verified comes from checked papers); the gift row says "Some bookings", since "many" is not measured. Header now cites v6. Both guarded in `the-front-door-tells-the-truth.test.ts`.

- fix: the gift row quotes `SETNAYAN_GIFT_PHOTOS`, now exported from `setnayan-gift-line.tsx` (the card copy is built from it), so the gift sentence is typed once (`the-gift-reaches-couples-while-choosing`).
