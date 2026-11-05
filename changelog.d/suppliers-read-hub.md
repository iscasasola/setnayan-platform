## 2026-11-05 · fix(supplier-copy): a supplier reads "Hub", never "Event Hub"

Owner rule (the For Suppliers / For Coordinators brief, 2026-11-05): "Event Hub" is a couple-side word for the front page only — never in supplier or coordinator material. The demo shop's real screenshots showed it on supplier screens ("The Event Hub is its own page for this event…").

- The supplier's day page is the **Hub** — the word their tab already uses: "Open the Hub", "The Hub opens here on …", "Hub · <event> · <day>", "Back to the Hub", the crew QR hints ("land on your Hub for this event only", "This phone leaves the Hub now"), the crew phone's own lines (`lib/crew-pass.ts`), Today's row (`lib/supplier-today-view.ts`), the supplier mini-tour's stop ("Your Hub"), page titles ("Hub · Supplier", "Live · Hub", "Papic capture · Hub"), and Papic credits "in its Hub" on Plans.
- Where a supplier's words or photos land on the GUESTS' page, they now read "the guests' page" (the announcement sheet, the portfolio-album notice). The coordinator's Maker row reads "The Maker".
- Not changed: the hosts' own screens. A Full-access coordinator works inside the hosts' dashboard (`/dashboard/<eventId>`), which keeps its words.
- Guard: `app/vendor-dashboard/suppliers-read-hub-not-event-hub.test.ts` reads every file under `app/vendor-dashboard` plus the two lib modules with comments stripped (sabotage: putting "Open the Event Hub from your own dashboard" back in `crew-pass.ts` turns it red). Wording pins updated in `the-hub-is-set-up-per-event.test.ts` and `the-fee-unlocks-the-event.test.ts`; the supplier lab (`/dev/supplier-lab?s=hub`) mirrors the page.

SPEC IMPACT: Applies the owner's "Event Hub is couple-side only" rule to supplier screens, with "Hub" as the supplier word (picked here because the supplier tab is already "Hub"; the owner had no preference when asked). For the corpus DECISION_LOG: suppliers read "Hub"; the guests' page is "the guests' page" in supplier copy.
