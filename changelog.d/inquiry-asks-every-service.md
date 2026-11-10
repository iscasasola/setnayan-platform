## 2026-11-10 · fix(inquiry): the supplier sees every service asked, the real celebrant, and the Inquire sheet picks only what was tapped

Build 5 F3 + F4 (Step 0 rows 21–26, Lane W walk 2).

- **Service requested lists every service asked.** `lib/supplier-event-lines.server.ts` now reads the thread's `thread_service_interests` (round two, beside the names — Today's depth unchanged) and `requestedServices` (pure, `lib/supplier-event-lines.ts`) unions them with the plan row: the couple's `initial` + `couple_added` asks, cards by name, card-less services by taxonomy name, once each; `linked` / `vendor_offered` / `withdrawn` are not "asked". A refused interests read says "couldn't load", never a short list. "You also offer" no longer offers back a card whose kind was asked.
- **Celebrant is who the event is for, not its name.** `eventCelebrantWords`: the guest-list honorees (main role celebrant · bride · groom, the product's one rule), else `signature_details.celebrant_name` / `celebrant_names` (what onboarding asked), else `honoree_label`, else "Not named yet". Never `display_name`.
- **First message names the services and is honest about the date.** `startServiceInquiry` appends "Services: Mobile bar · Photo booth" (`inquiryServicesLine`), and `supplierInquiryBody(profile, { dated })` says "no date yet" instead of "for our date" when the event has no date (also on the dashboard unlock path).
- **Inquire sheet:** nothing is preselected unless that card was tapped (`inquireOpeningPicks`, no `services[0]` default); a kind whose priced card is not live says "Price shown once the card is live" instead of "Price on request" (`inquireRowNote`, unless the shop hides prices).
- **"1 new inquiry · 1 unread thread"** on the supplier's Clients badge (`countNoun`).
- Not changed: the ✕-over-the-toggle at 436 px (row 27) was not reproduced and is left open. No chat title builds "X's Birthday" in the supplier path (both titles read `events.display_name`).

Tests: `lib/the-supplier-sees-every-service-asked.test.ts`, `lib/the-inquire-sheet-picks-only-what-was-tapped.test.ts` (both fail on `origin/main`).

SPEC IMPACT: None
